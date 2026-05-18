package services_test

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/erp/backend/internal/invoices/repository"
	"github.com/erp/backend/internal/invoices/services"
	"github.com/erp/backend/internal/settings/dto"
	settingsRepo "github.com/erp/backend/internal/settings/repository"
	settingsService "github.com/erp/backend/internal/settings/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func invoiceTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping invoice integration tests")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func seedUser(t *testing.T, pool *pgxpool.Pool, email string) pgtype.UUID {
	t.Helper()
	var userID pgtype.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, role_code) VALUES ($1, 'hash', 'ADMIN') RETURNING id`,
		email,
	).Scan(&userID)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, userID)
	})
	return userID
}

func seedCustomer(t *testing.T, pool *pgxpool.Pool, displayName string) pgtype.UUID {
	t.Helper()

	var customerID pgtype.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO customers (display_name, normalized_name, is_active)
		 VALUES ($1::text, LOWER($1::text), TRUE)
		 RETURNING id`,
		displayName,
	).Scan(&customerID)
	if err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM customers WHERE id = $1`, customerID)
	})
	return customerID
}

func seedOrder(t *testing.T, pool *pgxpool.Pool, customerID pgtype.UUID) pgtype.UUID {
	t.Helper()
	var orderID pgtype.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO sales_orders (customer_id, order_number, status, total_amount, created_at, updated_at) 
		 VALUES ($1, 'ORD-TEST-123', 'DRAFT', 100, $2, $2) RETURNING id`,
		customerID, time.Now(),
	).Scan(&orderID)
	if err != nil {
		t.Fatalf("seed order: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM invoices WHERE order_id = $1`, orderID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM sales_orders WHERE id = $1`, orderID)
	})
	return orderID
}

func TestConcurrentInvoiceNumbering(t *testing.T) {
	pool := invoiceTestPool(t)
	repo := repository.NewInvoiceRepository(pool)
	svc := services.NewInvoiceService(repo, pool)

	operatorID := uuid.New()
	customerID := seedCustomer(t, pool, "Concurrent Customer")

	var wg sync.WaitGroup
	numRequests := 5
	results := make(chan string, numRequests)

	// Create multiple orders to generate invoices concurrently
	orders := make([]pgtype.UUID, numRequests)
	for i := 0; i < numRequests; i++ {
		orders[i] = seedOrder(t, pool, customerID)
	}

	start := make(chan struct{})

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(orderIdx int) {
			defer wg.Done()
			<-start

			orderUUID, _ := uuid.Parse(orders[orderIdx].String())

			invoice, err := svc.GenerateInvoice(context.Background(), orderUUID, operatorID)
			if err != nil {
				t.Errorf("GenerateInvoice failed: %v", err)
				return
			}
			results <- invoice.InvoiceNumber
		}(i)
	}

	close(start) // release all goroutines
	wg.Wait()
	close(results)

	invoiceNumbers := make(map[string]bool)
	for num := range results {
		if invoiceNumbers[num] {
			t.Errorf("Duplicate invoice number generated: %s", num)
		}
		invoiceNumbers[num] = true
	}

	if len(invoiceNumbers) != numRequests {
		t.Errorf("Expected %d unique invoices, got %d", numRequests, len(invoiceNumbers))
	}
}

func TestInvoiceImmutability(t *testing.T) {
	pool := invoiceTestPool(t)
	repo := repository.NewInvoiceRepository(pool)
	svc := services.NewInvoiceService(repo, pool)
	setRepo := settingsRepo.NewSettingsRepository(pool)
	setSvc := settingsService.NewSettingsService(setRepo)

	operatorUUID := uuid.New()
	customerID := seedCustomer(t, pool, "Immutability Customer")
	orderID := seedOrder(t, pool, customerID)
	orderUUID, _ := uuid.Parse(orderID.String())

	// Set initial settings
	err := setSvc.UpdateBusinessSettings(context.Background(), &dto.BusinessSettings{
		CompanyName: "Original Company",
		GSTIN:       "29ABCDE1234F1Z5",
	}, operatorUUID)
	if err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}

	// Generate invoice
	invoice, err := svc.GenerateInvoice(context.Background(), orderUUID, operatorUUID)
	if err != nil {
		t.Fatalf("GenerateInvoice failed: %v", err)
	}

	if invoice.Snapshot.Company.CompanyName != "Original Company" {
		t.Errorf("Expected Original Company, got %s", invoice.Snapshot.Company.CompanyName)
	}

	// Change settings
	err = setSvc.UpdateBusinessSettings(context.Background(), &dto.BusinessSettings{
		CompanyName: "New Company",
		GSTIN:       "29ABCDE1234F1Z5",
	}, operatorUUID)
	if err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}

	// Fetch invoice again and verify it hasn't changed
	fetched, err := svc.GetInvoice(context.Background(), invoice.ID)
	if err != nil {
		t.Fatalf("GetInvoice failed: %v", err)
	}

	if fetched.Snapshot.Company.CompanyName != "Original Company" {
		t.Errorf("Invoice snapshot was mutated! Expected Original Company, got %s", fetched.Snapshot.Company.CompanyName)
	}
}

func TestDuplicateInvoicePrevention(t *testing.T) {
	pool := invoiceTestPool(t)
	repo := repository.NewInvoiceRepository(pool)
	svc := services.NewInvoiceService(repo, pool)

	operatorUUID := uuid.New()
	customerID := seedCustomer(t, pool, "Duplicate Customer")
	orderID := seedOrder(t, pool, customerID)
	orderUUID, _ := uuid.Parse(orderID.String())

	invoice1, err := svc.GenerateInvoice(context.Background(), orderUUID, operatorUUID)
	if err != nil {
		t.Fatalf("GenerateInvoice failed: %v", err)
	}

	invoice2, err := svc.GenerateInvoice(context.Background(), orderUUID, operatorUUID)
	if err != nil {
		t.Fatalf("Second GenerateInvoice failed: %v", err)
	}

	if invoice1.ID != invoice2.ID {
		t.Errorf("Expected the same invoice ID, got %s and %s", invoice1.ID, invoice2.ID)
	}
}
