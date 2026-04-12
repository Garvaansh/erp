package services

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidProcurementReceiptPayload = errors.New("invalid procurement receipt payload")
	ErrInvalidProcurementOrderPayload   = errors.New("invalid procurement order payload")
	ErrInvalidReceivedWeight            = errors.New("invalid received weight")
	ErrPurchaseOrderNotFound            = errors.New("purchase order not found")
	ErrPurchaseOrderNotPending          = errors.New("purchase order is not pending")
	ErrReceivedQuantityExceedsOrdered   = errors.New("received quantity exceeds ordered quantity")
	ErrProcurementReceiptNotFound       = errors.New("procurement receipt transaction not found")
	ErrCreatePurchaseOrderFailed        = errors.New("unable to create purchase order")
	ErrListProcurementOrdersFailed      = errors.New("unable to list procurement orders")
	ErrGetProcurementOrderDetailsFailed = errors.New("unable to get procurement order details")
	ErrVoidProcurementReceiptFailed     = errors.New("unable to void procurement receipt")
	ErrExecuteProcurementReceiptFailed  = errors.New("unable to execute procurement receipt")
)

type ProcurementService struct {
	pool *pgxpool.Pool
}

type ExecuteProcurementReceiptResult struct {
	PurchaseOrderID string `json:"purchase_order_id"`
	PONumber        string `json:"po_number"`
	BatchID         string `json:"batch_id"`
	BatchCode       string `json:"batch_code"`
	MovementGroupID string `json:"movement_group_id"`
	TransactionID   string `json:"transaction_id"`
}

type CreatePurchaseOrderResult struct {
	PurchaseOrderID string `json:"purchase_order_id"`
	PONumber        string `json:"po_number"`
}

type ProcurementOrderListRow struct {
	ID           string  `json:"id"`
	PONumber     string  `json:"po_number"`
	SupplierName string  `json:"supplier_name"`
	ItemID       string  `json:"item_id"`
	ItemName     string  `json:"item_name"`
	ItemSKU      string  `json:"item_sku,omitempty"`
	OrderedQty   float64 `json:"ordered_qty"`
	ReceivedQty  float64 `json:"received_qty"`
	UnitPrice    float64 `json:"unit_price"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at,omitempty"`
}

type ProcurementBatchRow struct {
	BatchID       string  `json:"batch_id"`
	BatchCode     string  `json:"batch_code"`
	InitialQty    float64 `json:"initial_qty"`
	RemainingQty  float64 `json:"remaining_qty"`
	TransactionID string  `json:"transaction_id,omitempty"`
	ReceivedAt    string  `json:"received_at,omitempty"`
}

type VoidProcurementReceiptResult struct {
	PurchaseOrderID string `json:"po_id"`
	TransactionID   string `json:"transaction_id"`
	Reverted        bool   `json:"reverted"`
}

func NewProcurementService(pool *pgxpool.Pool) *ProcurementService {
	return &ProcurementService{pool: pool}
}

func (s *ProcurementService) CreatePurchaseOrder(ctx context.Context, req models.CreatePurchaseOrderRequest, createdBy string) (*CreatePurchaseOrderResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrCreatePurchaseOrderFailed
	}

	itemID, ok := parseUUID(req.ItemID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	createdByID, ok := parseUUID(createdBy)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	orderedQty, ok := numericFromFloat(req.OrderedQty)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	unitPrice, ok := numericFromFloat(req.UnitPrice)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	poNumber := generatePONumber()
	queries := db.New(s.pool)

	po, err := queries.DraftPurchaseOrder(ctx, db.DraftPurchaseOrderParams{
		PoNumber:   poNumber,
		VendorName: strings.TrimSpace(req.SupplierName),
		ItemID:     itemID,
		OrderedQty: orderedQty,
		UnitPrice:  unitPrice,
		CreatedBy:  createdByID,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrCreatePurchaseOrderFailed
		}

		return nil, ErrCreatePurchaseOrderFailed
	}

	return &CreatePurchaseOrderResult{
		PurchaseOrderID: uuidString(po.ID),
		PONumber:        po.PoNumber,
	}, nil
}

func (s *ProcurementService) ListPurchaseOrders(ctx context.Context) ([]ProcurementOrderListRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrListProcurementOrdersFailed
	}

	queries := db.New(s.pool)
	rows, err := queries.ListProcurementOrders(ctx)
	if err != nil {
		return nil, ErrListProcurementOrdersFailed
	}

	out := make([]ProcurementOrderListRow, 0, len(rows))
	for _, row := range rows {
		orderedQty, ok := numericToFloat64(row.OrderedQty)
		if !ok {
			return nil, ErrListProcurementOrdersFailed
		}

		receivedQty, ok := numericToFloat64(row.ReceivedQty)
		if !ok {
			return nil, ErrListProcurementOrdersFailed
		}

		unitPrice, ok := numericToFloat64(row.UnitPrice)
		if !ok {
			return nil, ErrListProcurementOrdersFailed
		}

		createdAt := ""
		if row.CreatedAt.Valid {
			createdAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		out = append(out, ProcurementOrderListRow{
			ID:           uuidString(row.ID),
			PONumber:     row.PoNumber,
			SupplierName: row.VendorName,
			ItemID:       uuidString(row.ItemID),
			ItemName:     row.ItemName,
			ItemSKU:      row.Sku.String,
			OrderedQty:   orderedQty,
			ReceivedQty:  receivedQty,
			UnitPrice:    unitPrice,
			Status:       string(row.Status),
			CreatedAt:    createdAt,
		})
	}

	return out, nil
}

func (s *ProcurementService) GetPurchaseOrderDetails(ctx context.Context, poID string) (*ProcurementOrderListRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	queries := db.New(s.pool)
	row, err := queries.GetProcurementOrderDetails(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	orderedQty, ok := numericToFloat64(row.OrderedQty)
	if !ok {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	receivedQty, ok := numericToFloat64(row.ReceivedQty)
	if !ok {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	unitPrice, ok := numericToFloat64(row.UnitPrice)
	if !ok {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	createdAt := ""
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
	}

	return &ProcurementOrderListRow{
		ID:           uuidString(row.ID),
		PONumber:     row.PoNumber,
		SupplierName: row.VendorName,
		ItemID:       uuidString(row.ItemID),
		ItemName:     row.ItemName,
		ItemSKU:      row.Sku.String,
		OrderedQty:   orderedQty,
		ReceivedQty:  receivedQty,
		UnitPrice:    unitPrice,
		Status:       string(row.Status),
		CreatedAt:    createdAt,
	}, nil
}

func (s *ProcurementService) ListPurchaseOrderBatches(ctx context.Context, poID string) ([]ProcurementBatchRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	queries := db.New(s.pool)
	rows, err := queries.ListProcurementBatchesByOrder(ctx, parsedPOID)
	if err != nil {
		return nil, ErrGetProcurementOrderDetailsFailed
	}

	out := make([]ProcurementBatchRow, 0, len(rows))
	for _, row := range rows {
		initialQty, ok := numericToFloat64(row.InitialQty)
		if !ok {
			return nil, ErrGetProcurementOrderDetailsFailed
		}

		remainingQty, ok := numericToFloat64(row.RemainingQty)
		if !ok {
			return nil, ErrGetProcurementOrderDetailsFailed
		}

		receivedAt := ""
		if row.ReceivedAt.Valid {
			receivedAt = row.ReceivedAt.Time.UTC().Format(time.RFC3339)
		}

		out = append(out, ProcurementBatchRow{
			BatchID:       uuidString(row.BatchID),
			BatchCode:     row.BatchCode,
			InitialQty:    initialQty,
			RemainingQty:  remainingQty,
			TransactionID: uuidString(row.TransactionID),
			ReceivedAt:    receivedAt,
		})
	}

	return out, nil
}

func (s *ProcurementService) VoidProcurementReceipt(ctx context.Context, poID string, transactionID string, performedBy string) (*VoidProcurementReceiptResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrVoidProcurementReceiptFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	parsedTransactionID, ok := parseUUID(transactionID)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	txn, err := qtx.GetProcurementReceiptTransactionForUpdate(ctx, parsedTransactionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProcurementReceiptNotFound
		}
		return nil, fmt.Errorf("fetch procurement receipt transaction: %w", err)
	}

	if !txn.ReferenceID.Valid || txn.ReferenceID != parsedPOID {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	if !txn.BatchID.Valid {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	if _, err = qtx.ExhaustBatchByID(ctx, txn.BatchID); err != nil {
		return nil, fmt.Errorf("exhaust batch: %w", err)
	}

	movementGroupUUID := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	if _, err = qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          txn.ItemID,
		BatchID:         txn.BatchID,
		Direction:       db.TxDirectionOUT,
		Quantity:        txn.Quantity,
		ReferenceType:   db.TxReferenceTypePURCHASEORDER,
		ReferenceID:     parsedPOID,
		PerformedBy:     performedByID,
		Notes: pgtype.Text{
			String: "Void procurement receipt",
			Valid:  true,
		},
	}); err != nil {
		return nil, fmt.Errorf("record void transaction: %w", err)
	}

	if _, err = qtx.MarkPurchaseOrderPending(ctx, parsedPOID); err != nil {
		return nil, fmt.Errorf("mark purchase order pending: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return &VoidProcurementReceiptResult{
		PurchaseOrderID: uuidString(parsedPOID),
		TransactionID:   uuidString(parsedTransactionID),
		Reverted:        true,
	}, nil
}

func (s *ProcurementService) ExecuteProcurementReceipt(ctx context.Context, poID string, actualWeightReceived string) (*ExecuteProcurementReceiptResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrExecuteProcurementReceiptFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	receivedQty, ok := numericFromDecimalString(actualWeightReceived)
	if !ok {
		return nil, ErrInvalidReceivedWeight
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	po, err := qtx.GetPurchaseOrderForUpdate(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, fmt.Errorf("fetch purchase order: %w", err)
	}

	if po.Status != db.PurchaseOrderStatusPENDING {
		return nil, ErrPurchaseOrderNotPending
	}

	receivedVsOrdered, err := compareNumerics(receivedQty, po.OrderedQty)
	if err != nil {
		return nil, fmt.Errorf("compare received and ordered quantity: %w", err)
	}
	if receivedVsOrdered > 0 {
		return nil, ErrReceivedQuantityExceedsOrdered
	}

	item, err := qtx.GetItem(ctx, po.ItemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("fetch item: %w", ErrInvalidProcurementReceiptPayload)
		}
		return nil, fmt.Errorf("fetch item: %w", err)
	}

	if !item.Sku.Valid || strings.TrimSpace(item.Sku.String) == "" {
		return nil, fmt.Errorf("fetch item: %w", ErrExecuteProcurementReceiptFailed)
	}

	batchCode, dailySequence, err := nextProcurementLotCode(ctx, tx, po.ItemID, item.Sku.String)
	if err != nil {
		return nil, fmt.Errorf("generate batch code: %w", err)
	}

	batch, err := qtx.CreateBatch(ctx, db.CreateBatchParams{
		ItemID:        po.ItemID,
		BatchCode:     batchCode,
		DailySequence: dailySequence,
		InitialQty:    receivedQty,
		RemainingQty:  receivedQty,
		Status:        db.BatchStatusNEW,
	})
	if err != nil {
		return nil, fmt.Errorf("create batch: %w", err)
	}

	movementGroupUUID := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	txn, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          po.ItemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        receivedQty,
		ReferenceType:   db.TxReferenceTypePURCHASEORDER,
		ReferenceID:     po.ID,
		PerformedBy:     po.CreatedBy,
		Notes: pgtype.Text{
			String: fmt.Sprintf("Procurement receipt against %s", po.PoNumber),
			Valid:  true,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("record transaction: %w", err)
	}

	_, err = qtx.MarkPurchaseOrderDelivered(ctx, po.ID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotPending
		}
		return nil, fmt.Errorf("mark purchase order delivered: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return &ExecuteProcurementReceiptResult{
		PurchaseOrderID: uuidString(po.ID),
		PONumber:        po.PoNumber,
		BatchID:         uuidString(batch.ID),
		BatchCode:       batch.BatchCode,
		MovementGroupID: movementGroupUUID.String(),
		TransactionID:   uuidString(txn.ID),
	}, nil
}

func nextProcurementLotCode(ctx context.Context, tx pgx.Tx, _ pgtype.UUID, itemSKU string) (string, int32, error) {
	skuToken := sanitizeLotSKUToken(itemSKU)
	if skuToken == "" {
		return "", 0, errors.New("missing item sku")
	}

	nowUTC := time.Now().UTC()
	dateToken := nowUTC.Format("20060102")
	prefix := fmt.Sprintf("LOT-RAW-%s-%s", skuToken, dateToken)
	lockKey := fmt.Sprintf("lot-seq:RAW:%s", dateToken)

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return "", 0, err
	}

	dayStartUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	dayEndUTC := dayStartUTC.Add(24 * time.Hour)

	var nextIndex int32
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(daily_sequence), 0) + 1
		FROM inventory_batches
		WHERE type = 'RAW'::batch_type
		  AND created_at >= $1
		  AND created_at < $2
	`, dayStartUTC, dayEndUTC).Scan(&nextIndex)
	if err != nil {
		return "", 0, err
	}

	return fmt.Sprintf("%s-%02d", prefix, nextIndex), nextIndex, nil
}

func sanitizeLotSKUToken(value string) string {
	token := strings.ToUpper(strings.TrimSpace(value))
	token = strings.ReplaceAll(token, " ", "")
	return token
}

func numericFromDecimalString(value string) (pgtype.Numeric, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return pgtype.Numeric{}, false
	}

	var numeric pgtype.Numeric
	if err := numeric.Scan(trimmed); err != nil {
		return pgtype.Numeric{}, false
	}

	cmp, err := compareNumerics(numeric, zeroNumeric())
	if err != nil || cmp <= 0 {
		return pgtype.Numeric{}, false
	}

	return numeric, true
}

func compareNumerics(left pgtype.Numeric, right pgtype.Numeric) (int, error) {
	leftRat, err := numericToRat(left)
	if err != nil {
		return 0, err
	}

	rightRat, err := numericToRat(right)
	if err != nil {
		return 0, err
	}

	return leftRat.Cmp(rightRat), nil
}

func numericToRat(value pgtype.Numeric) (*big.Rat, error) {
	if !value.Valid {
		return nil, errors.New("numeric is invalid")
	}

	if value.NaN {
		return nil, errors.New("numeric is NaN")
	}

	if value.InfinityModifier == pgtype.Infinity || value.InfinityModifier == pgtype.NegativeInfinity {
		return nil, errors.New("numeric is infinite")
	}

	intPart := big.NewInt(0)
	if value.Int != nil {
		intPart = new(big.Int).Set(value.Int)
	}

	rat := new(big.Rat).SetInt(intPart)
	if value.Exp == 0 {
		return rat, nil
	}

	pow10 := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(absInt32(value.Exp))), nil)
	if value.Exp > 0 {
		rat.Mul(rat, new(big.Rat).SetInt(pow10))
		return rat, nil
	}

	rat.Quo(rat, new(big.Rat).SetInt(pow10))
	return rat, nil
}

func zeroNumeric() pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(0), Exp: 0, Valid: true}
}

func absInt32(value int32) int32 {
	if value < 0 {
		return -value
	}
	return value
}

func generatePONumber() string {
	return fmt.Sprintf("PO-IN-%s-%s", time.Now().UTC().Format("20060102"), strings.ToUpper(strconv.FormatInt(time.Now().UTC().UnixNano()%10000, 10)))
}
