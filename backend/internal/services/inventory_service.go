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
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxBatchCodeInsertAttempts = 5

var (
	ErrInvalidInventoryPayload = errors.New("invalid inventory payload")
	ErrInvalidItemID           = errors.New("invalid item")
	ErrInvalidBatchTypeFilter  = errors.New("invalid batch type filter")
	ErrBatchQueryFilterMissing = errors.New("batch lookup requires item_id or type")
	ErrReceiveStockFailed      = errors.New("unable to receive stock")
	ErrGetActiveBatchesFailed  = errors.New("unable to get active batches")
	ErrGetInventoryViewFailed  = errors.New("unable to get inventory view")
	ErrUpdateBatchStatusFailed = errors.New("unable to update batch status")
	ErrBatchNotFound           = errors.New("batch not found")
	ErrInvalidBatchStatus      = errors.New("invalid batch status transition")
	ErrInvalidBatchFlow        = errors.New("batch does not belong to raw inventory flow")
	ErrGetRawMaterialsFailed   = errors.New("unable to get raw materials")
	ErrGetBatchesByItemFailed  = errors.New("unable to get batches for item")
	ErrRawMaterialNotFound     = errors.New("raw material not found")
	ErrFIFOBatchUnavailable    = errors.New("no active fifo batch available")
	ErrFIFOAllocationRequired  = errors.New("batch allocation must follow fifo order")
	ErrInsufficientBatchQty    = errors.New("insufficient batch quantity")
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

type RawMaterialMasterRow struct {
	ItemID            string  `json:"item_id"`
	SKU               string  `json:"sku"`
	Name              string  `json:"name"`
	Specification     string  `json:"specification"`
	Specs             any     `json:"specs"`
	AvailableQty      float64 `json:"available_qty"`
	ReservedQty       float64 `json:"reserved_qty"`
	Threshold         float64 `json:"threshold"`
	PendingDeliveries float64 `json:"pending_deliveries"`
	Status            string  `json:"status"`
}

type RawMaterialSummary struct {
	ItemID            string  `json:"item_id"`
	SKU               string  `json:"sku"`
	Name              string  `json:"name"`
	Specification     string  `json:"specification"`
	Specs             any     `json:"specs"`
	AvailableQty      float64 `json:"available_qty"`
	ReservedQty       float64 `json:"reserved_qty"`
	HoldQty           float64 `json:"hold_qty"`
	PendingDeliveries float64 `json:"pending_deliveries"`
	Threshold         float64 `json:"threshold"`
}

type RawMaterialBatchRow struct {
	BatchID      string  `json:"batch_id"`
	BatchCode    string  `json:"batch_code"`
	VendorName   string  `json:"vendor_name,omitempty"`
	PONumber     string  `json:"po_number,omitempty"`
	ParentPOID   string  `json:"parent_po_id,omitempty"`
	ReceivedAt   string  `json:"received_at"`
	InitialQty   float64 `json:"initial_qty"`
	RemainingQty float64 `json:"remaining_qty"`
	ReservedQty  float64 `json:"reserved_qty"`
	AvailableQty float64 `json:"available_qty"`
	Status       string  `json:"status"`
}

type nextActiveBatchQuerier interface {
	GetNextActiveBatch(ctx context.Context, itemID pgtype.UUID) (db.GetNextActiveBatchRow, error)
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
	if _, err := qtx.GetItem(ctx, itemID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidItemID
		}
		return nil, fmt.Errorf("fetch item: %w", err)
	}

	batch, err := createBatchWithRetry(ctx, tx, qtx, itemID, quantity)
	if err != nil {
		return nil, err
	}

	movementGroup := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroup), Valid: true}

	txn, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          itemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        quantity,
		ReferenceType:   string(db.TxReferenceTypePURCHASEORDER),
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

func (s *InventoryService) UpdateBatchStatus(ctx context.Context, batchID string, req models.UpdateBatchStatusRequest, performedBy string) error {
	if s == nil || s.pool == nil {
		return ErrUpdateBatchStatusFailed
	}

	parsedBatchID, ok := parseUUID(batchID)
	if !ok {
		return ErrBatchNotFound
	}

	targetStatus := db.BatchStatus(strings.ToUpper(strings.TrimSpace(req.Status)))
	if targetStatus != db.BatchStatusHOLD && targetStatus != db.BatchStatusACTIVE {
		return ErrInvalidBatchStatus
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	batch, err := qtx.GetBatchForUpdate(ctx, parsedBatchID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrBatchNotFound
		}
		return fmt.Errorf("get batch for update: %w", err)
	}

	if err := validateBatchStatusUpdate(batch, targetStatus); err != nil {
		return err
	}
	if batch.Status == targetStatus {
		return nil
	}

	if _, err := qtx.SetBatchStatus(ctx, db.SetBatchStatusParams{
		ID:     parsedBatchID,
		Status: targetStatus,
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			return ErrInvalidBatchStatus
		}
		return fmt.Errorf("set batch status: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return nil
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

		rows, err := queries.GetActiveBatchesByType(ctx, parsedBatchType)
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

	parsedItemID, ok := parseUUID(trimmedItemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	if hasBatchType {
		rows, err := queries.GetActiveBatchesByItemAndType(ctx, db.GetActiveBatchesByItemAndTypeParams{
			ItemID: parsedItemID,
			Type:   parsedBatchType,
		})
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

func (s *InventoryService) GetNextActiveBatch(ctx context.Context, itemID string, requiredQty float64) (*ActiveBatchOption, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetActiveBatchesFailed
	}

	parsedItemID, ok := parseUUID(itemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	row, availableQty, err := getNextActiveBatchRecord(ctx, db.New(s.pool), parsedItemID, requiredQty)
	if err != nil {
		return nil, err
	}

	initialQty, ok := numericToFloat64(row.InitialQty)
	if !ok {
		return nil, ErrGetActiveBatchesFailed
	}

	return &ActiveBatchOption{
		ID:              uuidString(row.ID),
		BatchID:         uuidString(row.ID),
		BatchCode:       row.BatchCode,
		RemainingQty:    availableQty,
		ArrivalDate:     timestampValue(row.CreatedAt),
		InitialWeight:   initialQty,
		RemainingWeight: availableQty,
		Status:          string(row.Status),
	}, nil
}

func (s *InventoryService) GetInventoryView(ctx context.Context) (map[string][]InventoryViewRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetInventoryViewFailed
	}

	rows, err := db.New(s.pool).GetInventoryAggregated(ctx)
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

func (s *InventoryService) GetRawMaterialMaster(ctx context.Context) ([]RawMaterialMasterRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetRawMaterialsFailed
	}

	rows, err := db.New(s.pool).GetRawMaterialMaster(ctx)
	if err != nil {
		return nil, ErrGetRawMaterialsFailed
	}

	out := make([]RawMaterialMasterRow, 0, len(rows))
	for _, row := range rows {
		availableQty, _ := numericToFloat64(row.AvailableQty)
		reservedQty, _ := numericToFloat64(row.ReservedQty)
		pendingDeliveries, _ := numericToFloat64(row.PendingDeliveries)
		threshold, _ := numericToFloat64(row.LowStockThreshold)

		out = append(out, RawMaterialMasterRow{
			ItemID:            uuidString(row.ItemID),
			SKU:               row.Sku,
			Name:              row.Name,
			Specification:     utils.FormatSpecification(row.Specs),
			Specs:             decodeSpecs(row.Specs),
			AvailableQty:      availableQty,
			ReservedQty:       reservedQty,
			Threshold:         threshold,
			PendingDeliveries: pendingDeliveries,
			Status:            computeRawMaterialStatus(availableQty, threshold),
		})
	}

	return out, nil
}

func (s *InventoryService) GetRawMaterialSummary(ctx context.Context, itemID string) (*RawMaterialSummary, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetRawMaterialsFailed
	}

	parsedItemID, ok := parseUUID(itemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	row, err := db.New(s.pool).GetRawMaterialSummary(ctx, parsedItemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRawMaterialNotFound
		}
		return nil, ErrGetRawMaterialsFailed
	}

	availableQty, _ := numericToFloat64(row.AvailableQty)
	reservedQty, _ := numericToFloat64(row.ReservedQty)
	holdQty, _ := numericToFloat64(row.HoldQty)
	pendingDeliveries, _ := numericToFloat64(row.PendingDeliveries)
	threshold, _ := numericToFloat64(row.LowStockThreshold)

	return &RawMaterialSummary{
		ItemID:            uuidString(row.ItemID),
		SKU:               row.Sku,
		Name:              row.Name,
		Specification:     utils.FormatSpecification(row.Specs),
		Specs:             decodeSpecs(row.Specs),
		AvailableQty:      availableQty,
		ReservedQty:       reservedQty,
		HoldQty:           holdQty,
		PendingDeliveries: pendingDeliveries,
		Threshold:         threshold,
	}, nil
}

func (s *InventoryService) GetRawMaterialBatches(ctx context.Context, itemID string) ([]RawMaterialBatchRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetBatchesByItemFailed
	}

	parsedItemID, ok := parseUUID(itemID)
	if !ok {
		return nil, ErrInvalidItemID
	}

	rows, err := db.New(s.pool).GetRawMaterialBatches(ctx, parsedItemID)
	if err != nil {
		return nil, ErrGetBatchesByItemFailed
	}

	out := make([]RawMaterialBatchRow, 0, len(rows))
	for _, row := range rows {
		initialQty, ok := numericToFloat64(row.InitialQty)
		if !ok {
			return nil, ErrGetBatchesByItemFailed
		}

		remainingQty, ok := numericToFloat64(row.RemainingQty)
		if !ok {
			return nil, ErrGetBatchesByItemFailed
		}

		reservedQty, ok := numericToFloat64(row.ReservedQty)
		if !ok {
			return nil, ErrGetBatchesByItemFailed
		}

		availableQty, ok := numericToFloat64(row.AvailableQty)
		if !ok {
			return nil, ErrGetBatchesByItemFailed
		}

		out = append(out, RawMaterialBatchRow{
			BatchID:      uuidString(row.ID),
			BatchCode:    row.BatchCode,
			VendorName:   row.VendorName,
			PONumber:     row.PoNumber,
			ParentPOID:   uuidString(row.ParentPoID),
			ReceivedAt:   timestampValue(row.CreatedAt),
			InitialQty:   initialQty,
			RemainingQty: remainingQty,
			ReservedQty:  reservedQty,
			AvailableQty: availableQty,
			Status:       string(row.Status),
		})
	}

	return out, nil
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

func getNextActiveBatchRecord(ctx context.Context, queries nextActiveBatchQuerier, itemID pgtype.UUID, requiredQty float64) (db.GetNextActiveBatchRow, float64, error) {
	row, err := queries.GetNextActiveBatch(ctx, itemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.GetNextActiveBatchRow{}, 0, ErrFIFOBatchUnavailable
		}
		return db.GetNextActiveBatchRow{}, 0, ErrGetActiveBatchesFailed
	}

	remainingQty, ok := numericToFloat64(row.RemainingQty)
	if !ok {
		return db.GetNextActiveBatchRow{}, 0, ErrGetActiveBatchesFailed
	}

	reservedQty, ok := numericToFloat64(row.ReservedQty)
	if !ok {
		return db.GetNextActiveBatchRow{}, 0, ErrGetActiveBatchesFailed
	}

	availableQty := remainingQty - reservedQty
	if availableQty < 0 {
		availableQty = 0
	}

	if requiredQty > 0 && availableQty < requiredQty {
		return db.GetNextActiveBatchRow{}, 0, ErrInsufficientBatchQty
	}

	return row, availableQty, nil
}

func createBatchWithRetry(ctx context.Context, tx pgx.Tx, queries *db.Queries, itemID pgtype.UUID, quantity pgtype.Numeric) (db.InventoryBatch, error) {
	var lastErr error

	for attempt := 0; attempt < maxBatchCodeInsertAttempts; attempt++ {
		batchCode, dailySequence, err := utils.GenerateBatchID(ctx, tx)
		if err != nil {
			return db.InventoryBatch{}, fmt.Errorf("generate batch code: %w", err)
		}

		batch, err := queries.CreateBatch(ctx, db.CreateBatchParams{
			ItemID:        itemID,
			BatchCode:     batchCode,
			DailySequence: dailySequence,
			InitialQty:    quantity,
			RemainingQty:  quantity,
		})
		if err == nil {
			return batch, nil
		}
		if !isBatchCodeConflict(err) {
			return db.InventoryBatch{}, fmt.Errorf("create batch: %w", err)
		}
		lastErr = err
	}

	return db.InventoryBatch{}, fmt.Errorf("create batch: %w", lastErr)
}

func computeRawMaterialStatus(available float64, threshold float64) string {
	if threshold > 0 && available < threshold {
		return "LOW"
	}
	return "OK"
}

func isValidBatchStatusTransition(current db.BatchStatus, target db.BatchStatus) bool {
	if current == db.BatchStatusEXHAUSTED || current == db.BatchStatusREVERSED {
		return false
	}

	return target == db.BatchStatusACTIVE || target == db.BatchStatusHOLD
}

func validateBatchStatusUpdate(batch db.InventoryBatch, target db.BatchStatus) error {
	if !isValidBatchStatusTransition(batch.Status, target) {
		return ErrInvalidBatchStatus
	}
	if batch.Type != db.BatchTypeRAW {
		return ErrInvalidBatchFlow
	}
	return nil
}

func computeStockStatus(available float64, threshold float64) string {
	if available <= 0 {
		return "OUT_OF_STOCK"
	}
	if threshold > 0 && available <= threshold {
		return "LOW_STOCK"
	}
	return "HEALTHY"
}

func isBatchCodeConflict(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}

	if pgErr.Code != "23505" {
		return false
	}

	const batchCodeConstraint = "inventory_batches_batch_code_key"
	return pgErr.ConstraintName == "" || pgErr.ConstraintName == batchCodeConstraint
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

func numericToFloat64(value pgtype.Numeric) (float64, bool) {
	floatValue, err := value.Float64Value()
	if err != nil || !floatValue.Valid {
		return 0, false
	}
	if math.IsNaN(floatValue.Float64) || math.IsInf(floatValue.Float64, 0) {
		return 0, false
	}
	return floatValue.Float64, true
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
