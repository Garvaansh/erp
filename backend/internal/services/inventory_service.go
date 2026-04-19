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
	"github.com/erp/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidInventoryPayload = errors.New("invalid inventory payload")
	ErrInvalidItemID           = errors.New("invalid item")
	ErrInvalidBatchTypeFilter  = errors.New("invalid batch type filter")
	ErrBatchQueryFilterMissing = errors.New("batch lookup requires item_id or type")
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
	ID              string  `json:"id"`
	BatchID         string  `json:"batch_id"`
	BatchCode       string  `json:"batch_code"`
	SKU             string  `json:"sku"`
	RemainingQty    float64 `json:"remaining_qty"`
	ArrivalDate     string  `json:"arrival_date"`
	InitialWeight   float64 `json:"initial_weight"`
	RemainingWeight float64 `json:"remaining_weight"`
	Status          string  `json:"status"`
}

type InventoryViewRow struct {
	ItemID       string  `json:"item_id"`
	SKU          string  `json:"sku,omitempty"`
	Name         string  `json:"name"`
	Specs        any     `json:"specs"`
	TotalQty     float64 `json:"total_qty"`
	AvailableQty float64 `json:"available_qty"`
	ReservedQty  float64 `json:"reserved_qty"`
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
		return nil, fmt.Errorf("begin transaction: %w", err)
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
	_, err = qtx.GetItem(ctx, itemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidItemID
		}
		return nil, fmt.Errorf("fetch item: %w", err)
	}

	batchCode, dailySequence, err := utils.GenerateBatchID(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("generate batch code: %w", err)
	}

	batch, err := qtx.CreateBatch(ctx, db.CreateBatchParams{
		ItemID:        itemID,
		BatchCode:     batchCode,
		DailySequence: dailySequence,
		InitialQty:    quantity,
		RemainingQty:  quantity,
		Status:        db.BatchStatusNEW,
	})
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}

	movementGroup := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroup), Valid: true}

	txn, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          itemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        quantity,
		ReferenceType:   string(db.TxReferenceTypePURCHASERECEIPT),
		ReferenceID:     movementGroupID,
		PerformedBy:     performedByID,
		Notes:           pgtype.Text{String: "Stock receipt", Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("record transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return &ReceiveStockResult{
		BatchID:         uuidString(batch.ID),
		MovementGroupID: movementGroup.String(),
		TransactionID:   uuidString(txn.ID),
	}, nil
}

func (s *InventoryService) GetActiveBatchesByItem(ctx context.Context, itemID string, batchType string) ([]ActiveBatchOption, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetActiveBatchesFailed
	}

	trimmedItemID := strings.TrimSpace(itemID)
	if trimmedItemID == "" && strings.TrimSpace(batchType) == "" {
		return nil, ErrBatchQueryFilterMissing
	}

	parsedBatchType, hasBatchType := parseBatchTypeFilter(batchType)
	if strings.TrimSpace(batchType) != "" && !hasBatchType {
		return nil, ErrInvalidBatchTypeFilter
	}

	queries := db.New(s.pool)

	batches := make([]ActiveBatchOption, 0)

	appendRow := func(id pgtype.UUID, batchCode string, sku string, initialQtyNumeric pgtype.Numeric, remainingQtyNumeric pgtype.Numeric, status db.BatchStatus, createdAt pgtype.Timestamptz) error {
		initialQty, ok := numericToFloat64(initialQtyNumeric)
		if !ok {
			return ErrGetActiveBatchesFailed
		}

		remainingQty, ok := numericToFloat64(remainingQtyNumeric)
		if !ok {
			return ErrGetActiveBatchesFailed
		}

		arrival := ""
		if createdAt.Valid {
			arrival = createdAt.Time.UTC().Format("2006-01-02")
		}

		idString := uuidString(id)
		batches = append(batches, ActiveBatchOption{
			ID:              idString,
			BatchID:         idString,
			BatchCode:       batchCode,
			SKU:             strings.TrimSpace(sku),
			RemainingQty:    remainingQty,
			ArrivalDate:     arrival,
			InitialWeight:   initialQty,
			RemainingWeight: remainingQty,
			Status:          string(status),
		})
		return nil
	}

	if trimmedItemID == "" {
		if !hasBatchType {
			return nil, ErrBatchQueryFilterMissing
		}

		typedRows, err := queries.GetActiveBatchesByType(ctx, parsedBatchType)
		if err != nil {
			return nil, ErrGetActiveBatchesFailed
		}

		for _, row := range typedRows {
			if err := appendRow(row.ID, row.BatchCode, row.Sku, row.InitialQty, row.RemainingQty, row.Status, row.CreatedAt); err != nil {
				return nil, err
			}
		}

		return batches, nil
	}

	parsedItemID, ok := parseUUID(trimmedItemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	if hasBatchType {
		typedRows, err := queries.GetActiveBatchesByItemAndType(ctx, db.GetActiveBatchesByItemAndTypeParams{
			ItemID: parsedItemID,
			Type:   parsedBatchType,
		})
		if err != nil {
			return nil, ErrGetActiveBatchesFailed
		}

		for _, row := range typedRows {
			if err := appendRow(row.ID, row.BatchCode, row.Sku, row.InitialQty, row.RemainingQty, row.Status, row.CreatedAt); err != nil {
				return nil, err
			}
		}

		return batches, nil
	}

	rows, err := queries.GetActiveBatchesByItem(ctx, parsedItemID)
	if err != nil {
		return nil, ErrGetActiveBatchesFailed
	}

	for _, row := range rows {
		if err := appendRow(row.ID, row.BatchCode, row.Sku, row.InitialQty, row.RemainingQty, row.Status, row.CreatedAt); err != nil {
			return nil, err
		}
	}

	return batches, nil
}

func parseBatchTypeFilter(raw string) (db.BatchType, bool) {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "RAW":
		return db.BatchTypeRAW, true
	case "MWIP", "MOLDED":
		return db.BatchTypeMOLDED, true
	case "BNDL", "FINISHED":
		return db.BatchTypeFINISHED, true
	default:
		return "", false
	}
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

		availableQty, ok := aggregatedQtyToFloat64(row.AvailableQty)
		if !ok {
			return nil, ErrGetInventoryViewFailed
		}

		reservedQty, ok := aggregatedQtyToFloat64(row.ReservedQty)
		if !ok {
			return nil, ErrGetInventoryViewFailed
		}

		entry := InventoryViewRow{
			ItemID:       uuidString(row.ItemID),
			SKU:          row.Sku.String,
			Name:         row.Name,
			Specs:        decodeSpecs(row.Specs),
			TotalQty:     totalQty,
			AvailableQty: availableQty,
			ReservedQty:  reservedQty,
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
