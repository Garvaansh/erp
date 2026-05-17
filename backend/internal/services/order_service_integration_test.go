package services_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func orderTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping order integration tests")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(pool.Close)

	var tableName string
	if err := pool.QueryRow(context.Background(), `SELECT COALESCE(to_regclass('public.sales_orders')::text, '')`).Scan(&tableName); err != nil {
		t.Fatalf("check sales_orders table: %v", err)
	}
	if tableName == "" {
		t.Skip("sales_orders table not found; apply order migrations before running integration tests")
	}

	return pool
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

func seedFinishedItem(t *testing.T, pool *pgxpool.Pool, name string) pgtype.UUID {
	t.Helper()

	var itemID pgtype.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO items (name, category, base_unit, is_active, category_code, low_stock_threshold)
		 VALUES ($1, 'FINISHED'::item_category, 'WEIGHT'::base_unit_type, TRUE, 'FGP', 0)
		 RETURNING id`,
		name,
	).Scan(&itemID)
	if err != nil {
		t.Fatalf("seed finished item: %v", err)
	}
	return itemID
}

func seedFinishedBatch(t *testing.T, pool *pgxpool.Pool, itemID pgtype.UUID, qty float64, batchCode string, status string, batchType string, createdAt time.Time) pgtype.UUID {
	t.Helper()

	var batchID pgtype.UUID
	err := pool.QueryRow(context.Background(),
		`INSERT INTO inventory_batches (
			item_id, batch_code, daily_sequence, initial_qty, remaining_qty, reserved_qty, status, type, unit_cost, created_at, updated_at
		) VALUES (
			$1, $2, 1, $3, $3, 0, $4::batch_status, $5::batch_type, 0, $6, $6
		) RETURNING id`,
		itemID,
		batchCode,
		fmt.Sprintf("%.4f", qty),
		status,
		batchType,
		createdAt.UTC(),
	).Scan(&batchID)
	if err != nil {
		t.Fatalf("seed finished batch %s: %v", batchCode, err)
	}
	return batchID
}

func cleanupSalesOrder(pool *pgxpool.Pool, orderID string) {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `DELETE FROM inventory_transactions WHERE reference_id = $1::uuid`, orderID)
	_, _ = pool.Exec(ctx, `DELETE FROM sales_orders WHERE id = $1::uuid`, orderID)
}

func cleanupFinishedItem(pool *pgxpool.Pool, itemID pgtype.UUID) {
	ctx := context.Background()
	_, _ = pool.Exec(ctx, `DELETE FROM inventory_transactions WHERE item_id = $1`, itemID)
	_, _ = pool.Exec(ctx, `DELETE FROM sales_batch_allocations WHERE inventory_batch_id IN (SELECT id FROM inventory_batches WHERE item_id = $1)`, itemID)
	_, _ = pool.Exec(ctx, `DELETE FROM inventory_batches WHERE item_id = $1`, itemID)
	_, _ = pool.Exec(ctx, `DELETE FROM sales_order_lines WHERE finished_good_item_id = $1`, itemID)
	_, _ = pool.Exec(ctx, `DELETE FROM items WHERE id = $1`, itemID)
}

func fetchBatchState(t *testing.T, pool *pgxpool.Pool, batchID pgtype.UUID) (remaining float64, reserved float64, status string) {
	t.Helper()

	var remainingNumeric pgtype.Numeric
	var reservedNumeric pgtype.Numeric
	err := pool.QueryRow(context.Background(),
		`SELECT remaining_qty, reserved_qty, status FROM inventory_batches WHERE id = $1`,
		batchID,
	).Scan(&remainingNumeric, &reservedNumeric, &status)
	if err != nil {
		t.Fatalf("fetch batch state: %v", err)
	}
	return numericFloat(t, remainingNumeric), numericFloat(t, reservedNumeric), status
}

func countInventoryTransactions(t *testing.T, pool *pgxpool.Pool, orderID string, referenceType string) int {
	t.Helper()

	var count int
	if err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM inventory_transactions WHERE reference_id = $1::uuid AND reference_type = $2`,
		orderID,
		referenceType,
	).Scan(&count); err != nil {
		t.Fatalf("count inventory transactions: %v", err)
	}
	return count
}

type inventoryTransactionFact struct {
	ReferenceType string
	Direction     string
	BatchCode     string
	Quantity      float64
}

func listInventoryTransactionFacts(t *testing.T, pool *pgxpool.Pool, orderID string) []inventoryTransactionFact {
	t.Helper()

	rows, err := pool.Query(context.Background(),
		`SELECT it.reference_type, it.direction, ib.batch_code, it.quantity
		 FROM inventory_transactions it
		 JOIN inventory_batches ib ON ib.id = it.batch_id
		 WHERE it.reference_id = $1::uuid
		 ORDER BY it.created_at ASC, it.id ASC`,
		orderID,
	)
	if err != nil {
		t.Fatalf("list inventory transactions: %v", err)
	}
	defer rows.Close()

	facts := make([]inventoryTransactionFact, 0)
	for rows.Next() {
		var fact inventoryTransactionFact
		var quantity pgtype.Numeric
		if err := rows.Scan(&fact.ReferenceType, &fact.Direction, &fact.BatchCode, &quantity); err != nil {
			t.Fatalf("scan inventory transaction: %v", err)
		}
		fact.Quantity = numericFloat(t, quantity)
		facts = append(facts, fact)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate inventory transactions: %v", err)
	}
	return facts
}

func TestCreateSalesOrderReservesSingleBatch(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-single@example.com")
	customerID := seedCustomer(t, pool, "Acme Orders Single")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-SINGLE")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	batchID := seedFinishedBatch(t, pool, itemID, 100, "BNDL-ORD-SINGLE", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	svc := services.NewSalesOrderCommandService(pool)

	result, err := svc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 40},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	if result == nil || result.Order == nil {
		t.Fatal("expected order response")
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, result.Order.ID) })

	if result.Order.Status != "RESERVED" {
		t.Fatalf("expected RESERVED status, got %q", result.Order.Status)
	}
	if len(result.Order.Allocations) != 1 {
		t.Fatalf("expected 1 allocation, got %d", len(result.Order.Allocations))
	}
	if result.Order.Allocations[0].BatchCode != "BNDL-ORD-SINGLE" {
		t.Fatalf("expected reserved batch BNDL-ORD-SINGLE, got %q", result.Order.Allocations[0].BatchCode)
	}

	remaining, reserved, status := fetchBatchState(t, pool, batchID)
	if remaining != 100 || reserved != 40 || status != "ACTIVE" {
		t.Fatalf("unexpected batch state remaining=%v reserved=%v status=%s", remaining, reserved, status)
	}
	if countInventoryTransactions(t, pool, result.Order.ID, "SALES_ORDER_RESERVATION") != 1 {
		t.Fatal("expected exactly 1 reservation inventory transaction")
	}
}

func TestCreateSalesOrderReservesMultipleBatchesFIFO(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-fifo@example.com")
	customerID := seedCustomer(t, pool, "Acme Orders FIFO")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-FIFO")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	olderBatchID := seedFinishedBatch(t, pool, itemID, 30, "BNDL-ORD-OLD", "ACTIVE", "FINISHED", time.Now().Add(-3*time.Hour))
	newerBatchID := seedFinishedBatch(t, pool, itemID, 50, "BNDL-ORD-NEW", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	svc := services.NewSalesOrderCommandService(pool)

	result, err := svc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 60},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, result.Order.ID) })

	if len(result.Order.Allocations) != 2 {
		t.Fatalf("expected 2 allocations, got %d", len(result.Order.Allocations))
	}
	if result.Order.Allocations[0].BatchCode != "BNDL-ORD-OLD" || result.Order.Allocations[0].ReservedQty != 30 {
		t.Fatalf("expected older batch to be fully reserved first, got %+v", result.Order.Allocations[0])
	}
	if result.Order.Allocations[1].BatchCode != "BNDL-ORD-NEW" || result.Order.Allocations[1].ReservedQty != 30 {
		t.Fatalf("expected newer batch to reserve the remainder, got %+v", result.Order.Allocations[1])
	}

	_, oldReserved, _ := fetchBatchState(t, pool, olderBatchID)
	_, newReserved, _ := fetchBatchState(t, pool, newerBatchID)
	if oldReserved != 30 || newReserved != 30 {
		t.Fatalf("unexpected reserved quantities old=%v new=%v", oldReserved, newReserved)
	}
}

func TestCreateSalesOrderRejectsInsufficientInventory(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-insufficient@example.com")
	customerID := seedCustomer(t, pool, "Acme Orders Insufficient")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-INSUFFICIENT")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 20, "BNDL-ORD-SHORT", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	svc := services.NewSalesOrderCommandService(pool)

	_, err := svc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 30},
		},
	}, uuidStr(operatorID))
	if !errors.Is(err, services.ErrSalesOrderInsufficientInventory) {
		t.Fatalf("expected ErrSalesOrderInsufficientInventory, got %v", err)
	}

	var count int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM sales_orders WHERE customer_id = $1`, customerID).Scan(&count); err != nil {
		t.Fatalf("count sales orders: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rollback with no sales orders, got %d", count)
	}
}

func TestCreateSalesOrderFiltersOnlyActiveFinishedBatches(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-filter@example.com")
	customerID := seedCustomer(t, pool, "Acme Orders Filter")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-FILTER")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 100, "BNDL-ORD-HOLD", "HOLD", "FINISHED", time.Now().Add(-4*time.Hour))
	seedFinishedBatch(t, pool, itemID, 100, "RAW-ORD-WRONG", "ACTIVE", "RAW", time.Now().Add(-3*time.Hour))
	activeFinishedBatchID := seedFinishedBatch(t, pool, itemID, 25, "BNDL-ORD-ACTIVE", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))

	svc := services.NewSalesOrderCommandService(pool)
	result, err := svc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 20},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, result.Order.ID) })

	if len(result.Order.Allocations) != 1 || result.Order.Allocations[0].BatchCode != "BNDL-ORD-ACTIVE" {
		t.Fatalf("expected only active finished batch to be reserved, got %+v", result.Order.Allocations)
	}
	_, reserved, _ := fetchBatchState(t, pool, activeFinishedBatchID)
	if reserved != 20 {
		t.Fatalf("expected 20 reserved on active finished batch, got %v", reserved)
	}
}

func TestDispatchSalesOrderFullDispatch(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-dispatch-full@example.com")
	customerID := seedCustomer(t, pool, "Acme Dispatch Full")
	itemID := seedFinishedItem(t, pool, "FG-DISPATCH-FULL")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	batchID := seedFinishedBatch(t, pool, itemID, 100, "BNDL-DISPATCH-FULL", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 40},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	lineID := createResult.Order.Lines[0].ID
	dispatchResult, err := commandSvc.DispatchSalesOrder(context.Background(), createResult.Order.ID, models.DispatchSalesOrderRequest{
		Lines: []models.DispatchSalesOrderLineRequest{
			{SalesOrderLineID: lineID, DispatchQty: 40},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("DispatchSalesOrder() error = %v", err)
	}

	if dispatchResult.Order.Status != "DISPATCHED" {
		t.Fatalf("expected DISPATCHED status, got %q", dispatchResult.Order.Status)
	}
	remaining, reserved, status := fetchBatchState(t, pool, batchID)
	if remaining != 60 || reserved != 0 || status != "ACTIVE" {
		t.Fatalf("unexpected batch state remaining=%v reserved=%v status=%s", remaining, reserved, status)
	}
	if countInventoryTransactions(t, pool, createResult.Order.ID, "SALES_ORDER_DISPATCH") != 1 {
		t.Fatal("expected exactly 1 dispatch inventory transaction")
	}
}

func TestDispatchSalesOrderPartialAndMultipleDispatches(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-dispatch-partial@example.com")
	customerID := seedCustomer(t, pool, "Acme Dispatch Partial")
	itemID := seedFinishedItem(t, pool, "FG-DISPATCH-PARTIAL")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	batchID := seedFinishedBatch(t, pool, itemID, 100, "BNDL-DISPATCH-PARTIAL", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 50},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	lineID := createResult.Order.Lines[0].ID
	firstDispatch, err := commandSvc.DispatchSalesOrder(context.Background(), createResult.Order.ID, models.DispatchSalesOrderRequest{
		Lines: []models.DispatchSalesOrderLineRequest{
			{SalesOrderLineID: lineID, DispatchQty: 20},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("first DispatchSalesOrder() error = %v", err)
	}
	if firstDispatch.Order.Status != "PARTIALLY_DISPATCHED" {
		t.Fatalf("expected PARTIALLY_DISPATCHED after first dispatch, got %q", firstDispatch.Order.Status)
	}
	remaining, reserved, _ := fetchBatchState(t, pool, batchID)
	if remaining != 80 || reserved != 30 {
		t.Fatalf("unexpected batch state after first dispatch remaining=%v reserved=%v", remaining, reserved)
	}

	secondDispatch, err := commandSvc.DispatchSalesOrder(context.Background(), createResult.Order.ID, models.DispatchSalesOrderRequest{
		Lines: []models.DispatchSalesOrderLineRequest{
			{SalesOrderLineID: lineID, DispatchQty: 15},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("second DispatchSalesOrder() error = %v", err)
	}
	if secondDispatch.Order.Status != "PARTIALLY_DISPATCHED" {
		t.Fatalf("expected PARTIALLY_DISPATCHED after second dispatch, got %q", secondDispatch.Order.Status)
	}
	remaining, reserved, _ = fetchBatchState(t, pool, batchID)
	if remaining != 65 || reserved != 15 {
		t.Fatalf("unexpected batch state after second dispatch remaining=%v reserved=%v", remaining, reserved)
	}

	finalDispatch, err := commandSvc.DispatchSalesOrder(context.Background(), createResult.Order.ID, models.DispatchSalesOrderRequest{
		Lines: []models.DispatchSalesOrderLineRequest{
			{SalesOrderLineID: lineID, DispatchQty: 15},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("final DispatchSalesOrder() error = %v", err)
	}
	if finalDispatch.Order.Status != "DISPATCHED" {
		t.Fatalf("expected DISPATCHED after final dispatch, got %q", finalDispatch.Order.Status)
	}
	remaining, reserved, _ = fetchBatchState(t, pool, batchID)
	if remaining != 50 || reserved != 0 {
		t.Fatalf("unexpected final batch state remaining=%v reserved=%v", remaining, reserved)
	}
}

func TestCancelSalesOrderReleasesReservations(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-cancel@example.com")
	customerID := seedCustomer(t, pool, "Acme Cancel")
	itemID := seedFinishedItem(t, pool, "FG-CANCEL")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	batchID := seedFinishedBatch(t, pool, itemID, 100, "BNDL-CANCEL", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 35},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	cancelResult, err := commandSvc.CancelSalesOrder(context.Background(), createResult.Order.ID, "customer requested cancellation", uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CancelSalesOrder() error = %v", err)
	}
	if cancelResult.Order.Status != "CANCELLED" {
		t.Fatalf("expected CANCELLED status, got %q", cancelResult.Order.Status)
	}

	remaining, reserved, _ := fetchBatchState(t, pool, batchID)
	if remaining != 100 || reserved != 0 {
		t.Fatalf("unexpected batch state after cancellation remaining=%v reserved=%v", remaining, reserved)
	}
	if cancelResult.Order.Allocations[0].Status != "RELEASED" {
		t.Fatalf("expected RELEASED allocation status, got %q", cancelResult.Order.Allocations[0].Status)
	}
	if countInventoryTransactions(t, pool, createResult.Order.ID, "SALES_ORDER_RELEASE") != 1 {
		t.Fatal("expected exactly 1 release inventory transaction")
	}
}

func TestCancelDispatchedSalesOrderRejected(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-cancel-dispatched@example.com")
	customerID := seedCustomer(t, pool, "Acme Cancel Dispatched")
	itemID := seedFinishedItem(t, pool, "FG-CANCEL-DISPATCHED")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 100, "BNDL-CANCEL-DISPATCHED", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 20},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	lineID := createResult.Order.Lines[0].ID
	if _, err := commandSvc.DispatchSalesOrder(context.Background(), createResult.Order.ID, models.DispatchSalesOrderRequest{
		Lines: []models.DispatchSalesOrderLineRequest{
			{SalesOrderLineID: lineID, DispatchQty: 20},
		},
	}, uuidStr(operatorID)); err != nil {
		t.Fatalf("DispatchSalesOrder() error = %v", err)
	}

	_, err = commandSvc.CancelSalesOrder(context.Background(), createResult.Order.ID, "too late", uuidStr(operatorID))
	if !errors.Is(err, services.ErrSalesOrderStateConflict) {
		t.Fatalf("expected ErrSalesOrderStateConflict, got %v", err)
	}
}

func TestConcurrentReservationsPreventOverAllocation(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-concurrent@example.com")
	customerID := seedCustomer(t, pool, "Acme Concurrent")
	itemID := seedFinishedItem(t, pool, "FG-CONCURRENT")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	batchID := seedFinishedBatch(t, pool, itemID, 100, "BNDL-CONCURRENT", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	type createResult struct {
		orderID string
		err     error
	}

	start := make(chan struct{})
	results := make(chan createResult, 2)
	var wg sync.WaitGroup

	for idx := 0; idx < 2; idx++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			<-start
			resp, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
				CustomerID: uuidStr(customerID),
				Lines: []models.CreateSalesOrderLineRequest{
					{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 60},
				},
				Notes: fmt.Sprintf("concurrent-%d", n),
			}, uuidStr(operatorID))
			if err != nil {
				results <- createResult{err: err}
				return
			}
			results <- createResult{orderID: resp.Order.ID}
		}(idx)
	}

	close(start)
	wg.Wait()
	close(results)

	successfulOrderIDs := make([]string, 0, 2)
	failures := 0
	for res := range results {
		if res.err != nil {
			if !errors.Is(res.err, services.ErrSalesOrderInsufficientInventory) {
				t.Fatalf("unexpected concurrent reservation error: %v", res.err)
			}
			failures++
			continue
		}
		successfulOrderIDs = append(successfulOrderIDs, res.orderID)
	}
	for _, orderID := range successfulOrderIDs {
		orderID := orderID
		t.Cleanup(func() { cleanupSalesOrder(pool, orderID) })
	}

	if len(successfulOrderIDs) != 1 || failures != 1 {
		t.Fatalf("expected exactly one successful order and one failure, got successes=%d failures=%d", len(successfulOrderIDs), failures)
	}

	remaining, reserved, _ := fetchBatchState(t, pool, batchID)
	if remaining != 100 || reserved != 60 {
		t.Fatalf("unexpected concurrent batch state remaining=%v reserved=%v", remaining, reserved)
	}
}

func TestOrderReadModelsExposeAllocationsAndReservations(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-readmodels@example.com")
	customerID := seedCustomer(t, pool, "Acme Read Models")
	itemID := seedFinishedItem(t, pool, "FG-READ-MODELS")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 25, "BNDL-READ-001", "ACTIVE", "FINISHED", time.Now().Add(-3*time.Hour))
	seedFinishedBatch(t, pool, itemID, 25, "BNDL-READ-002", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)
	querySvc := services.NewOrderQueryService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 30},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	detail, err := querySvc.GetSalesOrderDetail(context.Background(), createResult.Order.ID)
	if err != nil {
		t.Fatalf("GetSalesOrderDetail() error = %v", err)
	}
	if len(detail.Allocations) != 2 {
		t.Fatalf("expected 2 allocations in order detail, got %d", len(detail.Allocations))
	}

	allocations, err := querySvc.GetOrderAllocations(context.Background(), createResult.Order.ID)
	if err != nil {
		t.Fatalf("GetOrderAllocations() error = %v", err)
	}
	if len(allocations) != 2 {
		t.Fatalf("expected 2 allocation rows, got %d", len(allocations))
	}

	finishedReservations, err := querySvc.GetFinishedGoodReservations(context.Background(), uuidStr(itemID))
	if err != nil {
		t.Fatalf("GetFinishedGoodReservations() error = %v", err)
	}
	if finishedReservations.TotalReserved != 30 || len(finishedReservations.Reservations) != 1 {
		t.Fatalf("unexpected finished good reservations %+v", finishedReservations)
	}

	batchReservations, err := querySvc.GetBatchReservations(context.Background(), "BNDL-READ-001")
	if err != nil {
		t.Fatalf("GetBatchReservations() error = %v", err)
	}
	if len(batchReservations.Reservations) != 1 || batchReservations.Reservations[0].OrderNumber != createResult.Order.OrderNumber {
		t.Fatalf("unexpected batch reservation drilldown %+v", batchReservations)
	}
}

func TestListSalesOrdersIncludesReservationProgress(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-list@example.com")
	customerID := seedCustomer(t, pool, "Acme Order Listing")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-LIST")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 50, "BNDL-LIST-001", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)
	querySvc := services.NewOrderQueryService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 20},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	page, err := querySvc.ListSalesOrders(context.Background(), "", 1, 20)
	if err != nil {
		t.Fatalf("ListSalesOrders() error = %v", err)
	}

	var found *services.SalesOrderListRow
	for i := range page.Items {
		if page.Items[i].ID == createResult.Order.ID {
			found = &page.Items[i]
			break
		}
	}
	if found == nil {
		t.Fatalf("expected created order %s in list response", createResult.Order.ID)
	}
	if found.Status != "RESERVED" || found.TotalQty != 20 || found.ReservedQty != 20 || found.DispatchedQty != 0 {
		t.Fatalf("unexpected order list row %+v", *found)
	}
}

func TestReservationAuditTrailIntegrity(t *testing.T) {
	pool := orderTestPool(t)
	operatorID := seedOperatorUser(t, pool, "orders-audit@example.com")
	customerID := seedCustomer(t, pool, "Acme Audit Trail")
	itemID := seedFinishedItem(t, pool, "FG-ORDER-AUDIT")
	t.Cleanup(func() { cleanupFinishedItem(pool, itemID) })

	seedFinishedBatch(t, pool, itemID, 15, "BNDL-AUDIT-001", "ACTIVE", "FINISHED", time.Now().Add(-3*time.Hour))
	seedFinishedBatch(t, pool, itemID, 15, "BNDL-AUDIT-002", "ACTIVE", "FINISHED", time.Now().Add(-2*time.Hour))
	commandSvc := services.NewSalesOrderCommandService(pool)

	createResult, err := commandSvc.CreateSalesOrder(context.Background(), models.CreateSalesOrderRequest{
		CustomerID: uuidStr(customerID),
		Lines: []models.CreateSalesOrderLineRequest{
			{FinishedGoodItemID: uuidStr(itemID), OrderedQty: 20},
		},
	}, uuidStr(operatorID))
	if err != nil {
		t.Fatalf("CreateSalesOrder() error = %v", err)
	}
	t.Cleanup(func() { cleanupSalesOrder(pool, createResult.Order.ID) })

	if len(createResult.Order.Allocations) != 2 {
		t.Fatalf("expected 2 allocations, got %d", len(createResult.Order.Allocations))
	}
	if createResult.Order.Allocations[0].BatchCode != "BNDL-AUDIT-001" || createResult.Order.Allocations[0].ReservedQty != 15 {
		t.Fatalf("unexpected first allocation %+v", createResult.Order.Allocations[0])
	}
	if createResult.Order.Allocations[1].BatchCode != "BNDL-AUDIT-002" || createResult.Order.Allocations[1].ReservedQty != 5 {
		t.Fatalf("unexpected second allocation %+v", createResult.Order.Allocations[1])
	}

	facts := listInventoryTransactionFacts(t, pool, createResult.Order.ID)
	if len(facts) != 2 {
		t.Fatalf("expected 2 inventory transactions, got %d", len(facts))
	}
	if facts[0].ReferenceType != "SALES_ORDER_RESERVATION" || facts[0].Direction != "OUT" || facts[0].BatchCode != "BNDL-AUDIT-001" || facts[0].Quantity != 15 {
		t.Fatalf("unexpected first inventory transaction %+v", facts[0])
	}
	if facts[1].ReferenceType != "SALES_ORDER_RESERVATION" || facts[1].Direction != "OUT" || facts[1].BatchCode != "BNDL-AUDIT-002" || facts[1].Quantity != 5 {
		t.Fatalf("unexpected second inventory transaction %+v", facts[1])
	}
}
