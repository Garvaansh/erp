package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type fakeNextActiveBatchQuerier struct {
	row db.GetNextActiveBatchRow
	err error
}

func (f fakeNextActiveBatchQuerier) GetNextActiveBatch(_ context.Context, _ pgtype.UUID) (db.GetNextActiveBatchRow, error) {
	return f.row, f.err
}

func mustNumeric(t *testing.T, value float64) pgtype.Numeric {
	t.Helper()

	numeric, ok := numericFromSignedFloat(value)
	if !ok {
		t.Fatalf("numericFromSignedFloat(%v) failed", value)
	}

	return numeric
}

func TestComputeRawMaterialStatus(t *testing.T) {
	tests := []struct {
		name      string
		available float64
		threshold float64
		want      string
	}{
		{name: "below threshold is low", available: 99, threshold: 100, want: "LOW"},
		{name: "at threshold is ok", available: 100, threshold: 100, want: "OK"},
		{name: "zero threshold is ok", available: 0, threshold: 0, want: "OK"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := computeRawMaterialStatus(tt.available, tt.threshold); got != tt.want {
				t.Fatalf("computeRawMaterialStatus(%v, %v) = %q, want %q", tt.available, tt.threshold, got, tt.want)
			}
		})
	}
}

func TestComputeFinishedGoodsStatus(t *testing.T) {
	tests := []struct {
		name      string
		available float64
		threshold float64
		want      string
	}{
		{name: "zero stock is out", available: 0, threshold: 10, want: "OUT"},
		{name: "below threshold is low", available: 5, threshold: 10, want: "LOW"},
		{name: "positive stock without threshold is ok", available: 5, threshold: 0, want: "OK"},
		{name: "above threshold is ok", available: 25, threshold: 10, want: "OK"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := computeFinishedGoodsStatus(tt.available, tt.threshold); got != tt.want {
				t.Fatalf("computeFinishedGoodsStatus(%v, %v) = %q, want %q", tt.available, tt.threshold, got, tt.want)
			}
		})
	}
}

func TestGetNextActiveBatchRecord_FIFOOrderAndQuantity(t *testing.T) {
	batchID := mustUUID(t, "11111111-1111-1111-1111-111111111111")
	itemID := mustUUID(t, "22222222-2222-2222-2222-222222222222")
	row := db.GetNextActiveBatchRow{
		ID:           batchID,
		ItemID:       itemID,
		BatchCode:    "BAT260506-001",
		InitialQty:   mustNumeric(t, 100),
		RemainingQty: mustNumeric(t, 100),
		ReservedQty:  mustNumeric(t, 20),
		Status:       db.BatchStatusACTIVE,
		CreatedAt:    pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}

	got, availableQty, err := getNextActiveBatchRecord(context.Background(), fakeNextActiveBatchQuerier{row: row}, itemID, 50)
	if err != nil {
		t.Fatalf("getNextActiveBatchRecord() error = %v", err)
	}

	if got.BatchCode != "BAT260506-001" {
		t.Fatalf("unexpected batch code %q", got.BatchCode)
	}
	if availableQty != 80 {
		t.Fatalf("availableQty = %v, want 80", availableQty)
	}
}

func TestGetNextActiveBatchRecord_HoldExcludedAndInsufficientQty(t *testing.T) {
	itemID := mustUUID(t, "33333333-3333-3333-3333-333333333333")

	_, _, err := getNextActiveBatchRecord(
		context.Background(),
		fakeNextActiveBatchQuerier{err: pgx.ErrNoRows},
		itemID,
		10,
	)
	if !errors.Is(err, ErrFIFOBatchUnavailable) {
		t.Fatalf("expected ErrFIFOBatchUnavailable, got %v", err)
	}

	row := db.GetNextActiveBatchRow{
		ID:           mustUUID(t, "44444444-4444-4444-4444-444444444444"),
		ItemID:       itemID,
		BatchCode:    "BAT260506-002",
		InitialQty:   mustNumeric(t, 50),
		RemainingQty: mustNumeric(t, 50),
		ReservedQty:  mustNumeric(t, 45),
		Status:       db.BatchStatusACTIVE,
	}

	_, _, err = getNextActiveBatchRecord(
		context.Background(),
		fakeNextActiveBatchQuerier{row: row},
		itemID,
		10,
	)
	if !errors.Is(err, ErrInsufficientBatchQty) {
		t.Fatalf("expected ErrInsufficientBatchQty, got %v", err)
	}
}

func TestValidateBatchReservationCapacity(t *testing.T) {
	err := validateBatchReservationCapacity(
		mustNumeric(t, 100),
		mustNumeric(t, 20),
		mustNumeric(t, 30),
	)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}

	err = validateBatchReservationCapacity(
		mustNumeric(t, 100),
		mustNumeric(t, 80),
		mustNumeric(t, 25),
	)
	if !errors.Is(err, ErrInsufficientBatchQty) {
		t.Fatalf("expected ErrInsufficientBatchQty, got %v", err)
	}
}

func TestIsBatchCodeConflict(t *testing.T) {
	conflict := &pgconn.PgError{
		Code:           "23505",
		ConstraintName: "inventory_batches_batch_code_key",
	}

	if !isBatchCodeConflict(conflict) {
		t.Fatal("expected batch code conflict to be retryable")
	}

	other := &pgconn.PgError{
		Code:           "23505",
		ConstraintName: "items_sku_key",
	}
	if isBatchCodeConflict(other) {
		t.Fatal("unexpected retryable conflict for non-batch constraint")
	}
}

func TestIsValidBatchStatusTransition(t *testing.T) {
	if !isValidBatchStatusTransition(db.BatchStatusACTIVE, db.BatchStatusHOLD) {
		t.Fatal("expected ACTIVE -> HOLD to be valid")
	}
	if !isValidBatchStatusTransition(db.BatchStatusHOLD, db.BatchStatusACTIVE) {
		t.Fatal("expected HOLD -> ACTIVE to be valid")
	}
	if isValidBatchStatusTransition(db.BatchStatusREVERSED, db.BatchStatusACTIVE) {
		t.Fatal("expected REVERSED -> ACTIVE to be invalid")
	}
	if isValidBatchStatusTransition(db.BatchStatusEXHAUSTED, db.BatchStatusHOLD) {
		t.Fatal("expected EXHAUSTED -> HOLD to be invalid")
	}
}

func TestHoldBatchSuccess(t *testing.T) {
	err := validateBatchStatusUpdate(
		db.InventoryBatch{
			Status: db.BatchStatusACTIVE,
			Type:   db.BatchTypeRAW,
		},
		db.BatchStatusHOLD,
	)
	if err != nil {
		t.Fatalf("validateBatchStatusUpdate() error = %v, want nil", err)
	}
}

func TestHoldReversedBatchRejected(t *testing.T) {
	err := validateBatchStatusUpdate(
		db.InventoryBatch{
			Status: db.BatchStatusREVERSED,
			Type:   db.BatchTypeRAW,
		},
		db.BatchStatusHOLD,
	)
	if !errors.Is(err, ErrInvalidBatchStatus) {
		t.Fatalf("validateBatchStatusUpdate() error = %v, want %v", err, ErrInvalidBatchStatus)
	}
}

func TestHoldNonRawBatchRejected(t *testing.T) {
	err := validateBatchStatusUpdate(
		db.InventoryBatch{
			Status: db.BatchStatusACTIVE,
			Type:   db.BatchTypeFINISHED,
		},
		db.BatchStatusHOLD,
	)
	if !errors.Is(err, ErrInvalidBatchFlow) {
		t.Fatalf("validateBatchStatusUpdate() error = %v, want %v", err, ErrInvalidBatchFlow)
	}
}

func TestHoldBatchNotVisibleInFIFO(t *testing.T) {
	itemID := mustUUID(t, "55555555-5555-5555-5555-555555555555")

	_, _, err := getNextActiveBatchRecord(
		context.Background(),
		fakeNextActiveBatchQuerier{err: pgx.ErrNoRows},
		itemID,
		10,
	)
	if !errors.Is(err, ErrFIFOBatchUnavailable) {
		t.Fatalf("expected ErrFIFOBatchUnavailable when FIFO query skips HOLD batches, got %v", err)
	}
}

func mustUUID(t *testing.T, raw string) pgtype.UUID {
	t.Helper()

	parsed, ok := parseUUID(raw)
	if !ok {
		t.Fatalf("parseUUID(%q) failed", raw)
	}

	return parsed
}
