package services

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	procurementReferenceType = "PROCUREMENT"

	procurementActionReceived    = "RECEIVED"
	procurementActionReversed    = "REVERSED"
	procurementActionForceClosed = "FORCE_CLOSED"
	procurementActionUpdated     = "UPDATED"
)

var (
	ErrCreatePurchaseOrderFailed    = errors.New("unable to create purchase order")
	ErrListProcurementOrdersFailed  = errors.New("unable to list procurement orders")
	ErrListProcurementBatchesFailed = errors.New("unable to list procurement batches")
	ErrGetProcurementDetailFailed   = errors.New("unable to get procurement detail")
	ErrReceiveGoodsFailed           = errors.New("unable to receive goods")
	ErrReverseReceiptFailed         = errors.New("unable to reverse receipt")
	ErrClosePurchaseOrderFailed     = errors.New("unable to close purchase order")
	ErrUpdatePurchaseOrderFailed    = errors.New("unable to update purchase order")

	ErrInvalidProcurementOrderPayload   = errors.New("invalid procurement order payload")
	ErrInvalidProcurementReceiptPayload = errors.New("invalid procurement receipt payload")
	ErrInvalidReceivedWeight            = errors.New("invalid received quantity")
	ErrPurchaseOrderNotFound            = errors.New("purchase order not found")
	ErrProcurementBatchNotFound         = errors.New("procurement batch not found")
	ErrReceivedQuantityExceedsOrdered   = errors.New("received quantity exceeds remaining order quantity")
	ErrPurchaseOrderStateConflict       = errors.New("purchase order is not in a valid state for this operation")
	ErrProcurementBatchStateConflict    = errors.New("procurement batch is not in a valid state for this operation")
	ErrProcurementEditReasonRequired    = errors.New("edit_reason is required")
	ErrProcurementUpdateRestricted      = errors.New("cannot update item_id or ordered_qty once receiving has started")
)

type ProcurementService struct {
	pool *pgxpool.Pool
}

type CreatePurchaseOrderResult struct {
	PurchaseOrderID string  `json:"purchase_order_id"`
	PONumber        string  `json:"po_number"`
	TransactionID   string  `json:"transaction_id"`
	VendorName      string  `json:"vendor_name"`
	VendorCode      string  `json:"vendor_code"`
	Status          string  `json:"status"`
	PaymentStatus   string  `json:"payment_status"`
	TotalValue      float64 `json:"total_value"`
	PaidAmount      float64 `json:"paid_amount"`
	DueAmount       float64 `json:"due_amount"`
}

type ReceiveGoodsResult struct {
	PurchaseOrderID string  `json:"purchase_order_id"`
	BatchID         string  `json:"batch_id"`
	BatchCode       string  `json:"batch_code"`
	TransactionID   string  `json:"transaction_id"`
	MovementGroupID string  `json:"movement_group_id"`
	ReceivedQty     float64 `json:"received_qty"`
	Status          string  `json:"status"`
}

type ReverseReceiptResult struct {
	PurchaseOrderID    string  `json:"purchase_order_id"`
	BatchID            string  `json:"batch_id,omitempty"`
	ReversedBatchCount int     `json:"reversed_batch_count"`
	ReceivedQty        float64 `json:"received_qty"`
	Status             string  `json:"status"`
}

type CloseOrderResult struct {
	PurchaseOrderID string `json:"purchase_order_id"`
	Status          string `json:"status"`
}

type ProcurementListRow struct {
	ID               string  `json:"id"`
	PONumber         string  `json:"po_number"`
	TransactionID    string  `json:"transaction_id"`
	VendorName       string  `json:"vendor_name"`
	VendorCode       string  `json:"vendor_code,omitempty"`
	VendorID         string  `json:"vendor_id,omitempty"`
	VendorShortName  string  `json:"vendor_short_name,omitempty"`
	ItemID           string  `json:"item_id"`
	ItemName         string  `json:"item_name"`
	ItemSKU          string  `json:"item_sku,omitempty"`
	OrderedQty       float64 `json:"ordered_qty"`
	ReceivedQty      float64 `json:"received_qty"`
	UnitPrice        float64 `json:"unit_price"`
	VendorInvoiceRef string  `json:"vendor_invoice_ref,omitempty"`
	PaymentStatus    string  `json:"payment_status,omitempty"`
	TotalValue       float64 `json:"total_value"`
	PaidAmount       float64 `json:"paid_amount"`
	DueAmount        float64 `json:"due_amount"`
	Status           string  `json:"status"`
	CreatedAt        string  `json:"created_at,omitempty"`
	UpdatedAt        string  `json:"updated_at,omitempty"`
	LastAction       string  `json:"last_action,omitempty"`
	LastActionAt     string  `json:"last_action_at,omitempty"`
}

type ProcurementLogRow struct {
	Action    string `json:"action"`
	Note      string `json:"note,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
}

type ProcurementDetail struct {
	ID               string              `json:"id"`
	PONumber         string              `json:"po_number"`
	TransactionID    string              `json:"transaction_id"`
	VendorName       string              `json:"vendor_name"`
	VendorCode       string              `json:"vendor_code,omitempty"`
	VendorID         string              `json:"vendor_id,omitempty"`
	VendorShortName  string              `json:"vendor_short_name,omitempty"`
	VendorContact    string              `json:"vendor_contact_person,omitempty"`
	VendorPhone      string              `json:"vendor_phone,omitempty"`
	ItemID           string              `json:"item_id"`
	ItemName         string              `json:"item_name"`
	ItemSKU          string              `json:"item_sku,omitempty"`
	OrderedQty       float64             `json:"ordered_qty"`
	ReceivedQty      float64             `json:"received_qty"`
	UnitPrice        float64             `json:"unit_price"`
	VendorInvoiceRef string              `json:"vendor_invoice_ref,omitempty"`
	PaymentStatus    string              `json:"payment_status,omitempty"`
	TotalValue       float64             `json:"total_value"`
	PaidAmount       float64             `json:"paid_amount"`
	DueAmount        float64             `json:"due_amount"`
	Notes            string              `json:"notes,omitempty"`
	Status           string              `json:"status"`
	CreatedBy        string              `json:"created_by"`
	CreatedAt        string              `json:"created_at,omitempty"`
	UpdatedAt        string              `json:"updated_at,omitempty"`
	TotalBatches     int32               `json:"total_batches"`
	ActiveBatches    int32               `json:"active_batches"`
	ReversedBatches  int32               `json:"reversed_batches"`
	LastAction       string              `json:"last_action,omitempty"`
	LastLogNote      string              `json:"last_log_note,omitempty"`
	LastActionAt     string              `json:"last_action_at,omitempty"`
	Logs             []ProcurementLogRow `json:"logs,omitempty"`
}

type ProcurementBatchRow struct {
	BatchID       string  `json:"batch_id"`
	BatchCode     string  `json:"batch_code"`
	InitialQty    float64 `json:"initial_qty"`
	RemainingQty  float64 `json:"remaining_qty"`
	Status        string  `json:"status"`
	UnitCost      float64 `json:"unit_cost"`
	TransactionID string  `json:"transaction_id,omitempty"`
	ReceivedAt    string  `json:"received_at,omitempty"`
}

type UpdatePurchaseOrderResult struct {
	PurchaseOrderID  string  `json:"purchase_order_id"`
	ItemID           string  `json:"item_id"`
	OrderedQty       float64 `json:"ordered_qty"`
	ReceivedQty      float64 `json:"received_qty"`
	UnitPrice        float64 `json:"unit_price"`
	VendorInvoiceRef string  `json:"vendor_invoice_ref,omitempty"`
	PaymentStatus    string  `json:"payment_status,omitempty"`
	TotalValue       float64 `json:"total_value"`
	PaidAmount       float64 `json:"paid_amount"`
	DueAmount        float64 `json:"due_amount"`
	Notes            string  `json:"notes,omitempty"`
	Status           string  `json:"status"`
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

	vendorIDRaw := strings.TrimSpace(req.VendorID)
	vendorID, ok := parseUUID(vendorIDRaw)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
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

	var vendorName string
	var vendorCode string
	if err := tx.QueryRow(ctx, `
		SELECT name, vendor_code
		FROM vendors
		WHERE id = $1
	`, vendorID).Scan(&vendorName, &vendorCode); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidProcurementOrderPayload
		}

		return nil, fmt.Errorf("load vendor for purchase order: %w", err)
	}

	vendorName = strings.TrimSpace(vendorName)
	vendorCode = normalizeVendorCodeToken(vendorCode)
	if vendorName == "" || vendorCode == "" {
		return nil, ErrInvalidProcurementOrderPayload
	}

	poNumber, transactionID, err := utils.GenerateProcurementIDs(ctx, tx, vendorCode)
	if err != nil {
		return nil, fmt.Errorf("generate procurement identifiers: %w", err)
	}

	createdPO, err := qtx.CreatePurchaseOrder(ctx, db.CreatePurchaseOrderParams{
		PoNumber:         poNumber,
		TransactionID:    transactionID,
		VendorID:         vendorID,
		VendorName:       textOrNull(vendorName),
		ItemID:           itemID,
		OrderedQty:       orderedQty,
		UnitPrice:        unitPrice,
		ReceivedQty:      zeroNumeric(),
		VendorInvoiceRef: textOrNull(req.VendorInvoiceRef),
		Notes:            textOrNull(req.Notes),
		Status:           db.PurchaseOrderStatusPENDING,
		CreatedBy:        createdByID,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			return nil, ErrCreatePurchaseOrderFailed
		}
		return nil, fmt.Errorf("create purchase order: %w", err)
	}

	if _, err := qtx.InsertPurchaseOrderLog(ctx, db.InsertPurchaseOrderLogParams{
		PoID:   createdPO.ID,
		UserID: createdByID,
		Action: "CREATED",
		Note:   pgtype.Text{String: "Purchase order created", Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("insert purchase order log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	paymentSummary, err := loadPaymentSummaryForPO(ctx, s.pool, uuidString(createdPO.ID))
	if err != nil {
		return nil, fmt.Errorf("load payment summary: %w", err)
	}

	return &CreatePurchaseOrderResult{
		PurchaseOrderID: uuidString(createdPO.ID),
		PONumber:        createdPO.PoNumber,
		TransactionID:   createdPO.TransactionID,
		VendorName:      vendorName,
		VendorCode:      vendorCode,
		Status:          string(createdPO.Status),
		PaymentStatus:   paymentSummary.PaymentStatus,
		TotalValue:      paymentSummary.TotalValue,
		PaidAmount:      paymentSummary.PaidAmount,
		DueAmount:       paymentSummary.DueAmount,
	}, nil
}

func (s *ProcurementService) ListProcurement(ctx context.Context, limit, offset int32) ([]ProcurementListRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrListProcurementOrdersFailed
	}

	if limit <= 0 || limit > 200 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	queries := db.New(s.pool)
	rows, err := queries.GetProcurementList(ctx, db.GetProcurementListParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, ErrListProcurementOrdersFailed
	}

	poIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		poIDs = append(poIDs, uuidString(row.ID))
	}

	paymentSummaryByPO, err := loadPaymentSummaryMapForPOs(ctx, s.pool, poIDs)
	if err != nil {
		return nil, ErrListProcurementOrdersFailed
	}

	out := make([]ProcurementListRow, 0, len(rows))
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

		paymentSummary := paymentSummaryByPO[uuidString(row.ID)]
		if paymentSummary.PaymentStatus == "" {
			paymentSummary.PaymentStatus = paymentStatusUnpaid
		}

		vendorName := strings.TrimSpace(row.VendorName)
		vendorCode := normalizeVendorCodeToken(row.VendorCode)
		vendorShort := vendorCode
		if vendorShort == "" {
			vendorShort = buildVendorShortName(vendorName)
		}

		out = append(out, ProcurementListRow{
			ID:               uuidString(row.ID),
			PONumber:         row.PoNumber,
			TransactionID:    row.TransactionID,
			VendorName:       vendorName,
			VendorCode:       vendorCode,
			VendorID:         uuidString(row.VendorID),
			VendorShortName:  vendorShort,
			ItemID:           uuidString(row.ItemID),
			ItemName:         row.ItemName,
			ItemSKU:          textValue(row.Sku),
			OrderedQty:       orderedQty,
			ReceivedQty:      receivedQty,
			UnitPrice:        unitPrice,
			VendorInvoiceRef: textValue(row.VendorInvoiceRef),
			PaymentStatus:    paymentSummary.PaymentStatus,
			TotalValue:       paymentSummary.TotalValue,
			PaidAmount:       paymentSummary.PaidAmount,
			DueAmount:        paymentSummary.DueAmount,
			Status:           string(row.Status),
			CreatedAt:        timestampValue(row.CreatedAt),
			UpdatedAt:        timestampValue(row.UpdatedAt),
			LastAction:       row.LastAction,
			LastActionAt:     timestampValue(row.LastActionAt),
		})
	}

	return out, nil
}

func (s *ProcurementService) GetProcurementDetail(ctx context.Context, poID string) (*ProcurementDetail, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetProcurementDetailFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	queries := db.New(s.pool)
	row, err := queries.GetProcurementDetail(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, ErrGetProcurementDetailFailed
	}

	orderedQty, ok := numericToFloat64(row.OrderedQty)
	if !ok {
		return nil, ErrGetProcurementDetailFailed
	}
	receivedQty, ok := numericToFloat64(row.ReceivedQty)
	if !ok {
		return nil, ErrGetProcurementDetailFailed
	}
	unitPrice, ok := numericToFloat64(row.UnitPrice)
	if !ok {
		return nil, ErrGetProcurementDetailFailed
	}

	vendorName := strings.TrimSpace(row.VendorName)
	vendorCode := normalizeVendorCodeToken(row.VendorCode)
	vendorShortName := vendorCode
	if vendorShortName == "" {
		vendorShortName = buildVendorShortName(vendorName)
	}

	paymentSummary, err := loadPaymentSummaryForPO(ctx, s.pool, uuidString(row.ID))
	if err != nil {
		return nil, ErrGetProcurementDetailFailed
	}

	logRows, err := s.pool.Query(ctx, `
		SELECT action, note, created_at
		FROM purchase_order_logs
		WHERE po_id = $1
		ORDER BY created_at DESC, id DESC
	`, parsedPOID)
	if err != nil {
		return nil, ErrGetProcurementDetailFailed
	}
	defer logRows.Close()

	logs := make([]ProcurementLogRow, 0)
	for logRows.Next() {
		var action string
		var note pgtype.Text
		var createdAt pgtype.Timestamptz

		if err := logRows.Scan(&action, &note, &createdAt); err != nil {
			return nil, ErrGetProcurementDetailFailed
		}

		logs = append(logs, ProcurementLogRow{
			Action:    strings.TrimSpace(action),
			Note:      textValue(note),
			CreatedAt: timestampValue(createdAt),
		})
	}

	if err := logRows.Err(); err != nil {
		return nil, ErrGetProcurementDetailFailed
	}

	return &ProcurementDetail{
		ID:               uuidString(row.ID),
		PONumber:         row.PoNumber,
		TransactionID:    row.TransactionID,
		VendorName:       vendorName,
		VendorCode:       vendorCode,
		VendorID:         uuidString(row.VendorID),
		VendorShortName:  vendorShortName,
		VendorContact:    strings.TrimSpace(row.VendorContactPerson),
		VendorPhone:      strings.TrimSpace(row.VendorPhone),
		ItemID:           uuidString(row.ItemID),
		ItemName:         row.ItemName,
		ItemSKU:          textValue(row.Sku),
		OrderedQty:       orderedQty,
		ReceivedQty:      receivedQty,
		UnitPrice:        unitPrice,
		VendorInvoiceRef: textValue(row.VendorInvoiceRef),
		PaymentStatus:    paymentSummary.PaymentStatus,
		TotalValue:       paymentSummary.TotalValue,
		PaidAmount:       paymentSummary.PaidAmount,
		DueAmount:        paymentSummary.DueAmount,
		Notes:            textValue(row.Notes),
		Status:           string(row.Status),
		CreatedBy:        uuidString(row.CreatedBy),
		CreatedAt:        timestampValue(row.CreatedAt),
		UpdatedAt:        timestampValue(row.UpdatedAt),
		TotalBatches:     row.TotalBatches,
		ActiveBatches:    row.ActiveBatches,
		ReversedBatches:  row.ReversedBatches,
		LastAction:       row.LastAction,
		LastLogNote:      textValue(row.LastLogNote),
		LastActionAt:     timestampValue(row.LastActionAt),
		Logs:             logs,
	}, nil
}

func (s *ProcurementService) ListProcurementBatches(ctx context.Context, poID string) ([]ProcurementBatchRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrListProcurementBatchesFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	const listBatchesQuery = `
		SELECT
			b.id,
			b.batch_code,
			b.initial_qty,
			b.remaining_qty,
			b.status,
			b.unit_cost,
			b.created_at,
			tx.id
		FROM inventory_batches b
		LEFT JOIN LATERAL (
			SELECT it.id
			FROM inventory_transactions it
			WHERE it.batch_id = b.id
			  AND it.reference_type = $2
			  AND it.reference_id = b.parent_po_id
			ORDER BY it.created_at DESC
			LIMIT 1
		) tx ON TRUE
		WHERE b.parent_po_id = $1
		ORDER BY b.created_at DESC, b.batch_code DESC
	`

	rows, err := s.pool.Query(ctx, listBatchesQuery, parsedPOID, procurementReferenceType)
	if err != nil {
		return nil, ErrListProcurementBatchesFailed
	}
	defer rows.Close()

	out := make([]ProcurementBatchRow, 0)
	for rows.Next() {
		var batchID pgtype.UUID
		var batchCode string
		var initialQtyNumeric pgtype.Numeric
		var remainingQtyNumeric pgtype.Numeric
		var status db.BatchStatus
		var unitCostNumeric pgtype.Numeric
		var receivedAt pgtype.Timestamptz
		var transactionID pgtype.UUID

		if err := rows.Scan(
			&batchID,
			&batchCode,
			&initialQtyNumeric,
			&remainingQtyNumeric,
			&status,
			&unitCostNumeric,
			&receivedAt,
			&transactionID,
		); err != nil {
			return nil, ErrListProcurementBatchesFailed
		}

		initialQty, ok := numericToFloat64(initialQtyNumeric)
		if !ok {
			return nil, ErrListProcurementBatchesFailed
		}

		remainingQty, ok := numericToFloat64(remainingQtyNumeric)
		if !ok {
			return nil, ErrListProcurementBatchesFailed
		}

		unitCost := 0.0
		if unitCostNumeric.Valid {
			parsedUnitCost, ok := numericToFloat64(unitCostNumeric)
			if !ok {
				return nil, ErrListProcurementBatchesFailed
			}
			unitCost = parsedUnitCost
		}

		out = append(out, ProcurementBatchRow{
			BatchID:       uuidString(batchID),
			BatchCode:     batchCode,
			InitialQty:    initialQty,
			RemainingQty:  remainingQty,
			Status:        string(status),
			UnitCost:      unitCost,
			TransactionID: uuidString(transactionID),
			ReceivedAt:    timestampValue(receivedAt),
		})
	}

	if err := rows.Err(); err != nil {
		return nil, ErrListProcurementBatchesFailed
	}

	return out, nil
}

func (s *ProcurementService) ReceiveGoods(ctx context.Context, poID string, qty float64, performedBy string) (*ReceiveGoodsResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrReceiveGoodsFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}
	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}
	receivedQty, ok := numericFromFloat(qty)
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
	po, err := qtx.GetPurchaseOrderByIDForUpdate(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, fmt.Errorf("get purchase order for update: %w", err)
	}

	if po.Status == db.PurchaseOrderStatusCOMPLETED || po.Status == db.PurchaseOrderStatusCLOSED {
		return nil, ErrPurchaseOrderStateConflict
	}

	unitPriceCmp, err := compareNumerics(po.UnitPrice, zeroNumeric())
	if err != nil || unitPriceCmp <= 0 {
		return nil, ErrPurchaseOrderStateConflict
	}

	remainingQty, err := subNumerics(po.OrderedQty, po.ReceivedQty)
	if err != nil {
		return nil, fmt.Errorf("compute remaining quantity: %w", err)
	}

	remainingCmp, err := compareNumerics(remainingQty, zeroNumeric())
	if err != nil {
		return nil, fmt.Errorf("validate remaining quantity: %w", err)
	}
	if remainingCmp <= 0 {
		return nil, ErrPurchaseOrderStateConflict
	}

	if exceeds, err := compareNumerics(receivedQty, remainingQty); err != nil {
		return nil, fmt.Errorf("compare received quantity: %w", err)
	} else if exceeds > 0 {
		return nil, ErrReceivedQuantityExceedsOrdered
	}

	batchCode, dailySequence, err := utils.GenerateBatchID(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("generate batch code: %w", err)
	}

	batch, err := qtx.CreateInventoryBatch(ctx, db.CreateInventoryBatchParams{
		ItemID:        po.ItemID,
		BatchCode:     batchCode,
		DailySequence: dailySequence,
		InitialQty:    receivedQty,
		RemainingQty:  receivedQty,
		ReservedQty:   zeroNumeric(),
		UnitCost:      po.UnitPrice,
		ParentPoID:    po.ID,
		Status:        db.BatchStatusACTIVE,
	})
	if err != nil {
		return nil, fmt.Errorf("create inventory batch: %w", err)
	}

	movementGroupUUID := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	txn, err := qtx.CreateInventoryTransaction(ctx, db.CreateInventoryTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          po.ItemID,
		BatchID:         batch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        receivedQty,
		ReferenceType:   procurementReferenceType,
		ReferenceID:     po.ID,
		PerformedBy:     performedByID,
		Notes: pgtype.Text{
			String: fmt.Sprintf("Receive goods against %s", po.PoNumber),
			Valid:  true,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create inventory transaction: %w", err)
	}

	updatedReceivedQty, err := addNumerics(po.ReceivedQty, receivedQty)
	if err != nil {
		return nil, fmt.Errorf("update received quantity: %w", err)
	}

	newStatus := db.PurchaseOrderStatusPARTIAL
	if cmp, err := compareNumerics(updatedReceivedQty, po.OrderedQty); err != nil {
		return nil, fmt.Errorf("derive purchase order status: %w", err)
	} else if cmp == 0 {
		newStatus = db.PurchaseOrderStatusCOMPLETED
	}

	updatedPO, err := qtx.UpdatePurchaseOrder(ctx, db.UpdatePurchaseOrderParams{
		ID:               po.ID,
		ItemID:           po.ItemID,
		OrderedQty:       po.OrderedQty,
		UnitPrice:        po.UnitPrice,
		ReceivedQty:      updatedReceivedQty,
		VendorInvoiceRef: po.VendorInvoiceRef,
		Notes:            po.Notes,
		Status:           newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("update purchase order: %w", err)
	}

	if _, err := qtx.InsertPurchaseOrderLog(ctx, db.InsertPurchaseOrderLogParams{
		PoID:   po.ID,
		UserID: performedByID,
		Action: procurementActionReceived,
		Note: pgtype.Text{
			String: fmt.Sprintf("Received qty %s", mustNumericString(receivedQty)),
			Valid:  true,
		},
	}); err != nil {
		return nil, fmt.Errorf("insert receive log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	qtyOut, ok := numericToFloat64(updatedPO.ReceivedQty)
	if !ok {
		return nil, ErrReceiveGoodsFailed
	}

	return &ReceiveGoodsResult{
		PurchaseOrderID: uuidString(updatedPO.ID),
		BatchID:         uuidString(batch.ID),
		BatchCode:       batch.BatchCode,
		TransactionID:   uuidString(txn.ID),
		MovementGroupID: movementGroupUUID.String(),
		ReceivedQty:     qtyOut,
		Status:          string(updatedPO.Status),
	}, nil
}

func (s *ProcurementService) ReverseReceipt(ctx context.Context, poID string, batchIDs []string, reason string, performedBy string) (*ReverseReceiptResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrReverseReceiptFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}
	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	if len(batchIDs) == 0 {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	parsedBatchIDs := make([]pgtype.UUID, 0, len(batchIDs))
	seenBatchIDs := make(map[string]struct{}, len(batchIDs))
	for _, rawBatchID := range batchIDs {
		trimmed := strings.TrimSpace(rawBatchID)
		if trimmed == "" {
			continue
		}

		parsedBatchID, ok := parseUUID(trimmed)
		if !ok {
			return nil, ErrInvalidProcurementReceiptPayload
		}

		batchKey := uuidString(parsedBatchID)
		if _, exists := seenBatchIDs[batchKey]; exists {
			continue
		}

		seenBatchIDs[batchKey] = struct{}{}
		parsedBatchIDs = append(parsedBatchIDs, parsedBatchID)
	}

	if len(parsedBatchIDs) == 0 {
		return nil, ErrInvalidProcurementReceiptPayload
	}

	reason = strings.TrimSpace(reason)
	if reason == "" {
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
	po, err := qtx.GetPurchaseOrderByIDForUpdate(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, fmt.Errorf("get purchase order for update: %w", err)
	}

	for _, parsedBatchID := range parsedBatchIDs {
		batch, err := qtx.GetBatchForUpdate(ctx, parsedBatchID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrProcurementBatchNotFound
			}
			return nil, fmt.Errorf("get batch for update: %w", err)
		}

		if !batch.ParentPoID.Valid || batch.ParentPoID != po.ID {
			return nil, ErrProcurementBatchStateConflict
		}

		if batch.Status == db.BatchStatusREVERSED {
			return nil, ErrProcurementBatchStateConflict
		}

		if reservedCmp, err := compareNumerics(batch.ReservedQty, zeroNumeric()); err != nil {
			return nil, fmt.Errorf("validate reserved quantity: %w", err)
		} else if reservedCmp != 0 {
			return nil, ErrProcurementBatchStateConflict
		}

		if initialVsRemaining, err := compareNumerics(batch.RemainingQty, batch.InitialQty); err != nil {
			return nil, fmt.Errorf("validate batch consumption state: %w", err)
		} else if initialVsRemaining != 0 {
			return nil, ErrProcurementBatchStateConflict
		}

		reversalQty := batch.RemainingQty

		if _, err := qtx.UpdateInventoryBatchStatus(ctx, db.UpdateInventoryBatchStatusParams{
			ID:           batch.ID,
			Status:       db.BatchStatusREVERSED,
			RemainingQty: zeroNumeric(),
		}); err != nil {
			return nil, fmt.Errorf("reverse batch status: %w", err)
		}

		movementGroupUUID := uuid.New()
		movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}
		if _, err := qtx.CreateInventoryTransaction(ctx, db.CreateInventoryTransactionParams{
			MovementGroupID: movementGroupID,
			ItemID:          batch.ItemID,
			BatchID:         batch.ID,
			Direction:       db.TxDirectionOUT,
			Quantity:        reversalQty,
			ReferenceType:   procurementReferenceType,
			ReferenceID:     po.ID,
			PerformedBy:     performedByID,
			Notes: pgtype.Text{
				String: "Reversal: " + reason,
				Valid:  true,
			},
		}); err != nil {
			return nil, fmt.Errorf("create reversal transaction: %w", err)
		}

		updatedReceivedQty, err := subNumerics(po.ReceivedQty, reversalQty)
		if err != nil {
			return nil, fmt.Errorf("compute received quantity after reversal: %w", err)
		}

		if cmp, err := compareNumerics(updatedReceivedQty, zeroNumeric()); err != nil {
			return nil, fmt.Errorf("validate received quantity after reversal: %w", err)
		} else if cmp < 0 {
			return nil, ErrProcurementBatchStateConflict
		}

		newStatus := db.PurchaseOrderStatusPARTIAL
		if cmp, err := compareNumerics(updatedReceivedQty, zeroNumeric()); err != nil {
			return nil, fmt.Errorf("derive status after reversal: %w", err)
		} else if cmp == 0 {
			newStatus = db.PurchaseOrderStatusPENDING
		}

		updatedPO, err := qtx.UpdatePurchaseOrder(ctx, db.UpdatePurchaseOrderParams{
			ID:               po.ID,
			ItemID:           po.ItemID,
			OrderedQty:       po.OrderedQty,
			UnitPrice:        po.UnitPrice,
			ReceivedQty:      updatedReceivedQty,
			VendorInvoiceRef: po.VendorInvoiceRef,
			Notes:            po.Notes,
			Status:           newStatus,
		})
		if err != nil {
			return nil, fmt.Errorf("update purchase order after reversal: %w", err)
		}

		po = updatedPO
	}

	var paidAmountNumeric pgtype.Numeric
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM purchase_order_payments
		WHERE po_id = $1
	`, po.ID).Scan(&paidAmountNumeric); err != nil {
		return nil, fmt.Errorf("load paid amount before reversal log: %w", err)
	}

	paidAmount := mustNumericString(paidAmountNumeric)
	logNote := formatReverseLogNote(reason, len(parsedBatchIDs))
	if cmp, err := compareNumerics(paidAmountNumeric, zeroNumeric()); err != nil {
		return nil, fmt.Errorf("compare paid amount before reversal log: %w", err)
	} else if cmp > 0 {
		logNote = fmt.Sprintf("%s | WARNING: existing payments remain attached (paid=%s)", logNote, paidAmount)
	}

	if _, err := qtx.InsertPurchaseOrderLog(ctx, db.InsertPurchaseOrderLogParams{
		PoID:   po.ID,
		UserID: performedByID,
		Action: procurementActionReversed,
		Note:   pgtype.Text{String: logNote, Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("insert reversal log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	receivedQtyOut, ok := numericToFloat64(po.ReceivedQty)
	if !ok {
		return nil, ErrReverseReceiptFailed
	}

	return &ReverseReceiptResult{
		PurchaseOrderID:    uuidString(po.ID),
		BatchID:            uuidString(parsedBatchIDs[0]),
		ReversedBatchCount: len(parsedBatchIDs),
		ReceivedQty:        receivedQtyOut,
		Status:             string(po.Status),
	}, nil
}

func (s *ProcurementService) CloseOrder(ctx context.Context, poID string, reason string, performedBy string) (*CloseOrderResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrClosePurchaseOrderFailed
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}
	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}

	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrInvalidProcurementOrderPayload
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
	po, err := qtx.GetPurchaseOrderByIDForUpdate(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, fmt.Errorf("get purchase order for close: %w", err)
	}

	if po.Status == db.PurchaseOrderStatusCLOSED || po.Status == db.PurchaseOrderStatusCOMPLETED {
		return nil, ErrPurchaseOrderStateConflict
	}

	if cmp, err := compareNumerics(po.ReceivedQty, zeroNumeric()); err != nil {
		return nil, fmt.Errorf("validate received quantity for close: %w", err)
	} else if cmp <= 0 {
		return nil, ErrPurchaseOrderStateConflict
	}

	updatedPO, err := qtx.UpdatePurchaseOrder(ctx, db.UpdatePurchaseOrderParams{
		ID:               po.ID,
		ItemID:           po.ItemID,
		OrderedQty:       po.OrderedQty,
		UnitPrice:        po.UnitPrice,
		ReceivedQty:      po.ReceivedQty,
		VendorInvoiceRef: po.VendorInvoiceRef,
		Notes:            po.Notes,
		Status:           db.PurchaseOrderStatusCLOSED,
	})
	if err != nil {
		return nil, fmt.Errorf("close purchase order: %w", err)
	}

	if _, err := qtx.InsertPurchaseOrderLog(ctx, db.InsertPurchaseOrderLogParams{
		PoID:   po.ID,
		UserID: performedByID,
		Action: procurementActionForceClosed,
		Note:   pgtype.Text{String: reason, Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("insert close log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return &CloseOrderResult{
		PurchaseOrderID: uuidString(updatedPO.ID),
		Status:          string(updatedPO.Status),
	}, nil
}

func (s *ProcurementService) UpdatePurchaseOrder(ctx context.Context, poID string, req models.UpdatePurchaseOrderRequest, performedBy string) (*UpdatePurchaseOrderResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrUpdatePurchaseOrderFailed
	}

	if strings.TrimSpace(req.EditReason) == "" {
		return nil, ErrProcurementEditReasonRequired
	}

	parsedPOID, ok := parseUUID(poID)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
	}
	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return nil, ErrInvalidProcurementOrderPayload
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
	po, err := qtx.GetPurchaseOrderByIDForUpdate(ctx, parsedPOID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPurchaseOrderNotFound
		}
		return nil, fmt.Errorf("get purchase order for update: %w", err)
	}

	updatedItemID := po.ItemID
	updatedOrderedQty := po.OrderedQty
	updatedUnitPrice := po.UnitPrice
	updatedVendorInvoiceRef := po.VendorInvoiceRef
	updatedNotes := po.Notes

	if req.ItemID != nil {
		newItemID, ok := parseUUID(*req.ItemID)
		if !ok {
			return nil, ErrInvalidProcurementOrderPayload
		}
		if po.Status != db.PurchaseOrderStatusPENDING && newItemID != po.ItemID {
			return nil, ErrProcurementUpdateRestricted
		}
		updatedItemID = newItemID
	}

	if req.OrderedQty != nil {
		newOrderedQty, ok := numericFromFloat(*req.OrderedQty)
		if !ok {
			return nil, ErrInvalidProcurementOrderPayload
		}

		if po.Status != db.PurchaseOrderStatusPENDING {
			if cmp, err := compareNumerics(newOrderedQty, po.OrderedQty); err != nil {
				return nil, fmt.Errorf("compare ordered quantity: %w", err)
			} else if cmp != 0 {
				return nil, ErrProcurementUpdateRestricted
			}
		}

		if cmp, err := compareNumerics(newOrderedQty, po.ReceivedQty); err != nil {
			return nil, fmt.Errorf("validate ordered quantity >= received quantity: %w", err)
		} else if cmp < 0 {
			return nil, ErrPurchaseOrderStateConflict
		}

		updatedOrderedQty = newOrderedQty
	}

	if req.UnitPrice != nil {
		newUnitPrice, ok := numericFromFloat(*req.UnitPrice)
		if !ok {
			return nil, ErrInvalidProcurementOrderPayload
		}
		updatedUnitPrice = newUnitPrice
	}

	if req.VendorInvoiceRef != nil {
		updatedVendorInvoiceRef = textOrNull(*req.VendorInvoiceRef)
	}

	// payment_status is derived from payments and is intentionally ignored for updates.

	if req.Notes != nil {
		updatedNotes = textOrNull(*req.Notes)
	}

	updatedPO, err := qtx.UpdatePurchaseOrder(ctx, db.UpdatePurchaseOrderParams{
		ID:               po.ID,
		ItemID:           updatedItemID,
		OrderedQty:       updatedOrderedQty,
		UnitPrice:        updatedUnitPrice,
		ReceivedQty:      po.ReceivedQty,
		VendorInvoiceRef: updatedVendorInvoiceRef,
		Notes:            updatedNotes,
		Status:           po.Status,
	})
	if err != nil {
		return nil, fmt.Errorf("update purchase order fields: %w", err)
	}

	if _, err := qtx.InsertPurchaseOrderLog(ctx, db.InsertPurchaseOrderLogParams{
		PoID:   po.ID,
		UserID: performedByID,
		Action: procurementActionUpdated,
		Note:   pgtype.Text{String: strings.TrimSpace(req.EditReason), Valid: true},
	}); err != nil {
		return nil, fmt.Errorf("insert update log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	paymentSummary, err := loadPaymentSummaryForPO(ctx, s.pool, uuidString(updatedPO.ID))
	if err != nil {
		return nil, ErrUpdatePurchaseOrderFailed
	}

	orderedQtyOut, ok := numericToFloat64(updatedPO.OrderedQty)
	if !ok {
		return nil, ErrUpdatePurchaseOrderFailed
	}
	receivedQtyOut, ok := numericToFloat64(updatedPO.ReceivedQty)
	if !ok {
		return nil, ErrUpdatePurchaseOrderFailed
	}
	unitPriceOut, ok := numericToFloat64(updatedPO.UnitPrice)
	if !ok {
		return nil, ErrUpdatePurchaseOrderFailed
	}

	return &UpdatePurchaseOrderResult{
		PurchaseOrderID:  uuidString(updatedPO.ID),
		ItemID:           uuidString(updatedPO.ItemID),
		OrderedQty:       orderedQtyOut,
		ReceivedQty:      receivedQtyOut,
		UnitPrice:        unitPriceOut,
		VendorInvoiceRef: textValue(updatedPO.VendorInvoiceRef),
		PaymentStatus:    paymentSummary.PaymentStatus,
		TotalValue:       paymentSummary.TotalValue,
		PaidAmount:       paymentSummary.PaidAmount,
		DueAmount:        paymentSummary.DueAmount,
		Notes:            textValue(updatedPO.Notes),
		Status:           string(updatedPO.Status),
	}, nil
}

func formatReverseLogNote(reason string, reversedBatchCount int) string {
	trimmedReason := strings.TrimSpace(reason)
	if reversedBatchCount <= 1 {
		return trimmedReason
	}

	return fmt.Sprintf("%s (bulk reverse: %d batches)", trimmedReason, reversedBatchCount)
}

func buildVendorShortName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return ""
	}

	words := strings.Fields(trimmed)
	if len(words) > 1 {
		initials := make([]rune, 0, 4)
		for _, word := range words {
			for _, char := range word {
				if (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') {
					initials = append(initials, char)
					break
				}
			}
			if len(initials) == 4 {
				break
			}
		}

		if len(initials) > 0 {
			return strings.ToUpper(string(initials))
		}
	}

	letters := make([]rune, 0, 4)
	for _, char := range trimmed {
		if (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') {
			letters = append(letters, char)
		}
		if len(letters) == 4 {
			break
		}
	}

	if len(letters) == 0 {
		return ""
	}

	return strings.ToUpper(string(letters))
}

func normalizeVendorCodeToken(raw string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, r := range trimmed {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
		}
	}

	return builder.String()
}

func textOrNull(value string) pgtype.Text {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: trimmed, Valid: true}
}

func textValue(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return strings.TrimSpace(value.String)
}

func timestampValue(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}

func mustNumericString(value pgtype.Numeric) string {
	floatValue, ok := numericToFloat64(value)
	if !ok {
		return "0"
	}
	return fmt.Sprintf("%.4f", floatValue)
}

func addNumerics(left, right pgtype.Numeric) (pgtype.Numeric, error) {
	leftRat, err := numericToRat(left)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	rightRat, err := numericToRat(right)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	result := new(big.Rat).Add(leftRat, rightRat)
	return numericFromRat(result)
}

func subNumerics(left, right pgtype.Numeric) (pgtype.Numeric, error) {
	leftRat, err := numericToRat(left)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	rightRat, err := numericToRat(right)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	result := new(big.Rat).Sub(leftRat, rightRat)
	return numericFromRat(result)
}

func numericFromRat(value *big.Rat) (pgtype.Numeric, error) {
	if value == nil {
		return pgtype.Numeric{}, errors.New("nil rational value")
	}

	asDecimal := value.FloatString(4)
	var out pgtype.Numeric
	if err := out.Scan(asDecimal); err != nil {
		return pgtype.Numeric{}, err
	}
	return out, nil
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
