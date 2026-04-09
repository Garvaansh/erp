package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidInventoryPayload = errors.New("invalid inventory payload")
	ErrInvalidItemID           = errors.New("invalid item")
	ErrReceiveStockFailed      = errors.New("unable to receive stock")
	ErrGetActiveBatchesFailed  = errors.New("unable to get active batches")
	ErrGetInventoryViewFailed  = errors.New("unable to get inventory view")
)

type InventoryService struct {
	pool        *pgxpool.Pool
	itemService *ItemService
}

type ReceiveStockResult struct {
	BatchID         string `json:"batch_id"`
	MovementGroupID string `json:"movement_group_id"`
	TransactionID   string `json:"transaction_id"`
}

type ActiveBatchOption struct {
	BatchID         string  `json:"batch_id"`
	BatchCode       string  `json:"batch_code"`
	ArrivalDate     string  `json:"arrival_date"`
	InitialWeight   float64 `json:"initial_weight"`
	RemainingWeight float64 `json:"remaining_weight"`
	Status          string  `json:"status"`
}

type InventoryViewRow struct {
	ItemID   string  `json:"item_id"`
	SKU      string  `json:"sku,omitempty"`
	Name     string  `json:"name"`
	Specs    any     `json:"specs"`
	TotalQty float64 `json:"total_qty"`
}

func NewInventoryService(pool *pgxpool.Pool, itemService *ItemService) *InventoryService {
	return &InventoryService{pool: pool, itemService: itemService}
}

func (s *InventoryService) ReceiveStock(ctx context.Context, req models.ReceiveStockRequest, performedBy string) (*ReceiveStockResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrReceiveStockFailed
	}

	itemID, ok := parseUUID(req.ItemID)
	if !ok {
		return nil, ErrInvalidInventoryPayload
	}

	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidInventoryPayload
	}

	quantity, ok := numericFromFloat(req.Quantity)
	if !ok {
		return nil, ErrInvalidInventoryPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, ErrReceiveStockFailed
	}

	committed := false
	defer func() {
		if !committed {
			if rollbackErr := tx.Rollback(ctx); rollbackErr != nil && !errors.Is(rollbackErr, pgx.ErrTxClosed) {
				log.Printf("WARN: inventory receive rollback failed: %v", rollbackErr)
			}
		}
	}()

	qtx := db.New(tx)
	item, err := qtx.GetItem(ctx, itemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidItemID
		}
		return nil, ErrReceiveStockFailed
	}

	if !item.Sku.Valid || strings.TrimSpace(item.Sku.String) == "" {
		return nil, ErrReceiveStockFailed
	}

	batchCode, err := nextDailyBatchCode(ctx, tx, itemID, item.Sku.String)
	if err != nil {
		return nil, ErrReceiveStockFailed
	}

	batch, err := qtx.CreateBatch(ctx, db.CreateBatchParams{
		ItemID:       itemID,
		BatchCode:    batchCode,
		InitialQty:   quantity,
		RemainingQty: quantity,
		Status:       db.BatchStatusNEW,
	})
	if err != nil {
		return nil, ErrReceiveStockFailed
	}

	movementGroup := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroup), Valid: true}

	txn, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          itemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        quantity,
		ReferenceType:   db.TxReferenceTypePURCHASERECEIPT,
		ReferenceID:     movementGroupID,
		PerformedBy:     performedByID,
		Notes:           pgtype.Text{String: "Stock receipt", Valid: true},
	})
	if err != nil {
		return nil, ErrReceiveStockFailed
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, ErrReceiveStockFailed
	}
	committed = true

	return &ReceiveStockResult{
		BatchID:         uuidString(batch.ID),
		MovementGroupID: movementGroup.String(),
		TransactionID:   uuidString(txn.ID),
	}, nil
}

func (s *InventoryService) GetActiveBatchesByItem(ctx context.Context, itemID string) ([]ActiveBatchOption, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetActiveBatchesFailed
	}

	parsedItemID, ok := parseUUID(itemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	queries := db.New(s.pool)
	rows, err := queries.GetActiveBatchesByItem(ctx, parsedItemID)
	if err != nil {
		return nil, ErrGetActiveBatchesFailed
	}

	batches := make([]ActiveBatchOption, 0, len(rows))
	for _, row := range rows {
		initialQty, ok := numericToFloat64(row.InitialQty)
		if !ok {
			return nil, ErrGetActiveBatchesFailed
		}

		remainingQty, ok := numericToFloat64(row.RemainingQty)
		if !ok {
			return nil, ErrGetActiveBatchesFailed
		}

		status := "IN USE"
		if almostEqual(initialQty, remainingQty) {
			status = "NEW"
		}

		arrival := ""
		if row.CreatedAt.Valid {
			arrival = row.CreatedAt.Time.UTC().Format("2006-01-02")
		}

		batches = append(batches, ActiveBatchOption{
			BatchID:         uuidString(row.ID),
			BatchCode:       row.BatchCode,
			ArrivalDate:     arrival,
			InitialWeight:   initialQty,
			RemainingWeight: remainingQty,
			Status:          status,
		})
	}

	return batches, nil
}

func (s *InventoryService) GetInventoryView(ctx context.Context) (map[string][]InventoryViewRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetInventoryViewFailed
	}

	queries := db.New(s.pool)
	rows, err := queries.GetInventoryAggregated(ctx)
	if err != nil {
		return nil, ErrGetInventoryViewFailed
	}

	out := map[string][]InventoryViewRow{
		"RAW":           {},
		"SEMI_FINISHED": {},
		"FINISHED":      {},
		"SCRAP":         {},
	}

	for _, row := range rows {
		totalQty, ok := aggregatedQtyToFloat64(row.TotalQty)
		if !ok {
			return nil, ErrGetInventoryViewFailed
		}

		entry := InventoryViewRow{
			ItemID:   uuidString(row.ItemID),
			SKU:      row.Sku.String,
			Name:     row.Name,
			Specs:    decodeSpecs(row.Specs),
			TotalQty: totalQty,
		}

		category := string(row.Category)
		if _, exists := out[category]; !exists {
			out[category] = []InventoryViewRow{}
		}
		out[category] = append(out[category], entry)
	}

	return out, nil
}

func parseUUID(value string) (pgtype.UUID, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return pgtype.UUID{}, false
	}

	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return pgtype.UUID{}, false
	}

	return pgtype.UUID{Bytes: [16]byte(parsed), Valid: true}, true
}

func numericFromFloat(value float64) (pgtype.Numeric, bool) {
	if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
		return pgtype.Numeric{}, false
	}

	var numeric pgtype.Numeric
	if err := numeric.Scan(strconv.FormatFloat(value, 'f', 4, 64)); err != nil {
		return pgtype.Numeric{}, false
	}

	return numeric, true
}

func aggregatedQtyToFloat64(value any) (float64, bool) {
	switch typed := value.(type) {
	case int64:
		return float64(typed), true
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return 0, false
		}
		return typed, true
	case pgtype.Numeric:
		return numericToFloat64(typed)
	default:
		return 0, false
	}
}

func decodeSpecs(raw []byte) any {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return map[string]any{}
	}

	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		return trimmed
	}

	return out
}

func nextDailyBatchCode(ctx context.Context, tx pgx.Tx, itemID pgtype.UUID, sku string) (string, error) {
	trimmedSKU := strings.TrimSpace(sku)
	if trimmedSKU == "" {
		return "", errors.New("missing sku")
	}

	todayToken := time.Now().UTC().Format("20060102")
	prefix := fmt.Sprintf("%s-%s", trimmedSKU, todayToken)
	lockKey := fmt.Sprintf("inventory-batch:%s", prefix)

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return "", err
	}

	var nextSequence int
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX((regexp_match(batch_code, '-([0-9]+)$'))[1]::int), 0) + 1
		FROM inventory_batches
		WHERE item_id = $1
		  AND batch_code LIKE $2
	`, itemID, prefix+"-%").Scan(&nextSequence)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s-%02d", prefix, nextSequence), nil
}

func almostEqual(left, right float64) bool {
	return math.Abs(left-right) <= 0.000001
}
