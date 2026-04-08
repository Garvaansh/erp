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

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidInventoryPayload = errors.New("invalid inventory payload")
	ErrInvalidItemID           = errors.New("invalid item")
	ErrDuplicateBatchCode      = errors.New("duplicate batch code")
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
	BatchID      string  `json:"batch_id"`
	Label        string  `json:"label"`
	RemainingQty float64 `json:"remaining_qty"`
}

type InventoryViewRow struct {
	ItemID   string  `json:"item_id"`
	Name     string  `json:"name"`
	Specs    any     `json:"specs"`
	TotalQty float64 `json:"total_qty"`
}

func NewInventoryService(pool *pgxpool.Pool, itemService *ItemService) *InventoryService {
	return &InventoryService{pool: pool, itemService: itemService}
}

func (s *InventoryService) ReceiveStock(ctx context.Context, req models.ReceiveStockRequest, performedBy string) (*ReceiveStockResult, error) {
	var itemID pgtype.UUID
	trimmedItemID := strings.TrimSpace(req.ItemID)
	if trimmedItemID != "" {
		parsedItemID, ok := parseUUID(trimmedItemID)
		if !ok {
			return nil, ErrInvalidInventoryPayload
		}
		itemID = parsedItemID
	} else if req.Item != nil {
		if s.itemService == nil {
			return nil, ErrReceiveStockFailed
		}

		item, err := s.itemService.FindOrCreateItem(ctx, *req.Item)
		if err != nil {
			return nil, ErrReceiveStockFailed
		}
		itemID = item.ID
	} else {
		return nil, ErrInvalidInventoryPayload
	}

	referenceID, ok := parseUUID(req.ReferenceID)
	if !ok {
		return nil, ErrInvalidInventoryPayload
	}

	movementGroupID, ok := parseUUID(req.IdempotencyKey)
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

	unitCost, ok := numericFromFloat(req.UnitCost)
	if !ok {
		return nil, ErrInvalidInventoryPayload
	}

	qtx := db.New(s.pool)
	if _, err := qtx.GetItem(ctx, itemID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			log.Printf("Business Error: invalid item id: %s", strings.TrimSpace(req.ItemID))
			return nil, ErrInvalidItemID
		}
		return nil, ErrReceiveStockFailed
	}

	txnRecord, err := qtx.GetTransactionByMovementGroup(ctx, movementGroupID)
	if err == nil {
		return &ReceiveStockResult{
			BatchID:         uuidString(txnRecord.BatchID),
			MovementGroupID: uuidString(movementGroupID),
			TransactionID:   uuidString(txnRecord.ID),
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReceiveStockFailed
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

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", strings.TrimSpace(req.IdempotencyKey)); err != nil {
		return nil, ErrReceiveStockFailed
	}

	qtx = db.New(tx)

	txnRecord, err = qtx.GetTransactionByMovementGroup(ctx, movementGroupID)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, ErrReceiveStockFailed
		}
		committed = true
		return &ReceiveStockResult{
			BatchID:         uuidString(txnRecord.BatchID),
			MovementGroupID: uuidString(movementGroupID),
			TransactionID:   uuidString(txnRecord.ID),
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReceiveStockFailed
	}

	batch, err := qtx.CreateBatch(ctx, db.CreateBatchParams{
		ItemID:       itemID,
		BatchCode:    strings.TrimSpace(req.BatchCode),
		InitialQty:   quantity,
		RemainingQty: quantity,
		UnitCost:     unitCost,
		Status:       db.BatchStatusACTIVE,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "23505":
				log.Printf("Business Error: duplicate batch code: %s", strings.TrimSpace(req.BatchCode))
				return nil, ErrDuplicateBatchCode
			}
		}
		return nil, ErrReceiveStockFailed
	}

	notes := strings.TrimSpace(req.Notes)

	txn, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          itemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        quantity,
		ReferenceType:   db.TxReferenceType(req.ReferenceType),
		ReferenceID:     referenceID,
		PerformedBy:     performedByID,
		Notes:           pgtype.Text{String: notes, Valid: notes != ""},
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
		MovementGroupID: uuidString(movementGroupID),
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
		remainingQty, ok := numericToFloat64(row.RemainingQty)
		if !ok {
			return nil, ErrGetActiveBatchesFailed
		}

		batches = append(batches, ActiveBatchOption{
			BatchID:      uuidString(row.ID),
			Label:        fmt.Sprintf("%s (%skg available)", row.BatchCode, formatQtyLabel(remainingQty)),
			RemainingQty: remainingQty,
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

func formatQtyLabel(value float64) string {
	formatted := strconv.FormatFloat(value, 'f', 4, 64)
	formatted = strings.TrimRight(formatted, "0")
	formatted = strings.TrimRight(formatted, ".")
	if formatted == "" {
		return "0"
	}

	return formatted
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
