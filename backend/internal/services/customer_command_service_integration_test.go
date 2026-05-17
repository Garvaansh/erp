package services_test

import (
	"context"
	"os"
	"sync"
	"testing"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/jackc/pgx/v5/pgxpool"
)

func customerTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping customer integration tests")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(pool.Close)

	var tableName string
	if err := pool.QueryRow(context.Background(), `SELECT COALESCE(to_regclass('public.customers')::text, '')`).Scan(&tableName); err != nil {
		t.Fatalf("check customers table: %v", err)
	}
	if tableName == "" {
		t.Skip("customers table not found; apply customer migrations before running integration tests")
	}

	return pool
}

func TestCreateCustomerConcurrentPhoneRace(t *testing.T) {
	pool := customerTestPool(t)
	service := services.NewCustomerCommandService(pool)
	ctx := context.Background()

	type result struct {
		response *models.CustomerCreateResponse
		err      error
	}

	start := make(chan struct{})
	results := make(chan result, 2)
	var wg sync.WaitGroup

	requests := []models.CreateCustomerRequest{
		{DisplayName: "Acme Traders", PhoneNumber: "9876543210"},
		{DisplayName: "ACME Traders LLP", PhoneNumber: "+91-98765-43210"},
	}

	for _, req := range requests {
		req := req
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			resp, err := service.CreateCustomer(ctx, req)
			results <- result{response: resp, err: err}
		}()
	}

	close(start)
	wg.Wait()
	close(results)

	var customerID string
	for res := range results {
		if res.err != nil {
			t.Fatalf("CreateCustomer() error = %v", res.err)
		}
		if res.response == nil || res.response.Customer == nil {
			t.Fatalf("expected customer response, got %+v", res.response)
		}
		if customerID == "" {
			customerID = res.response.Customer.ID
			t.Cleanup(func() { cleanupCustomerByID(pool, customerID) })
		}
		if res.response.Customer.ID != customerID {
			t.Fatalf("expected both concurrent creates to resolve to the same customer, got %q and %q", customerID, res.response.Customer.ID)
		}
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE normalized_phone = '+919876543210'`).Scan(&count); err != nil {
		t.Fatalf("count customers by phone: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 customer row after phone race, got %d", count)
	}
}

func TestCreateCustomerDuplicateGSTRace(t *testing.T) {
	pool := customerTestPool(t)
	service := services.NewCustomerCommandService(pool)
	ctx := context.Background()

	type result struct {
		response *models.CustomerCreateResponse
		err      error
	}

	start := make(chan struct{})
	results := make(chan result, 2)
	var wg sync.WaitGroup

	requests := []models.CreateCustomerRequest{
		{DisplayName: "Balaji Pipes", GSTNumber: "29ABCDE1234F2Z5"},
		{DisplayName: "Balaji Pipe Works", GSTNumber: "29 abcde1234f2z5"},
	}

	for _, req := range requests {
		req := req
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			resp, err := service.CreateCustomer(ctx, req)
			results <- result{response: resp, err: err}
		}()
	}

	close(start)
	wg.Wait()
	close(results)

	var customerID string
	for res := range results {
		if res.err != nil {
			t.Fatalf("CreateCustomer() error = %v", res.err)
		}
		if res.response == nil || res.response.Customer == nil {
			t.Fatalf("expected customer response, got %+v", res.response)
		}
		if customerID == "" {
			customerID = res.response.Customer.ID
			t.Cleanup(func() { cleanupCustomerByID(pool, customerID) })
		}
		if res.response.Customer.ID != customerID {
			t.Fatalf("expected both concurrent creates to resolve to the same customer, got %q and %q", customerID, res.response.Customer.ID)
		}
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE normalized_gst = '29ABCDE1234F2Z5'`).Scan(&count); err != nil {
		t.Fatalf("count customers by gst: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 customer row after GST race, got %d", count)
	}
}

func cleanupCustomerByID(pool *pgxpool.Pool, customerID string) {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `DELETE FROM customer_aliases WHERE customer_id = $1::uuid`, customerID)
	_, _ = pool.Exec(ctx, `DELETE FROM customers WHERE id = $1::uuid`, customerID)
}
