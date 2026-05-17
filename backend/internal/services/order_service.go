package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SalesOrderCommandService struct {
	pool        *pgxpool.Pool
	reservation *OrderReservationService
	dispatch    *OrderDispatchService
}

func NewSalesOrderCommandService(pool *pgxpool.Pool) *SalesOrderCommandService {
	if pool == nil {
		return &SalesOrderCommandService{}
	}
	return &SalesOrderCommandService{
		pool:        pool,
		reservation: NewOrderReservationService(),
		dispatch:    NewOrderDispatchService(),
	}
}

func (s *SalesOrderCommandService) CreateSalesOrder(ctx context.Context, req models.CreateSalesOrderRequest, createdBy string) (*SalesOrderMutationResult, error) {
	if s == nil || s.pool == nil || s.reservation == nil {
		return nil, ErrCreateSalesOrderFailed
	}

	customerID, ok := parseUUID(strings.TrimSpace(req.CustomerID))
	if !ok {
		return nil, ErrInvalidSalesOrderPayload
	}
	createdByID, ok := parseUUID(strings.TrimSpace(createdBy))
	if !ok {
		return nil, ErrInvalidSalesOrderPayload
	}
	if len(req.Lines) == 0 {
		return nil, ErrInvalidSalesOrderPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, ErrCreateSalesOrderFailed
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	customer, err := qtx.GetCustomerByID(ctx, customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidSalesOrderPayload
		}
		return nil, ErrCreateSalesOrderFailed
	}
	if !customer.IsActive {
		return nil, ErrInvalidSalesOrderPayload
	}

	orderNumber, err := utils.GenerateSalesOrderID(ctx, tx)
	if err != nil {
		return nil, ErrCreateSalesOrderFailed
	}

	order, err := qtx.CreateSalesOrder(ctx, db.CreateSalesOrderParams{
		OrderNumber: orderNumber,
		CustomerID:  customerID,
		Status:      salesOrderStatusDraft,
		Notes:       textOrNull(strings.TrimSpace(req.Notes)),
		CreatedBy:   createdByID,
	})
	if err != nil {
		return nil, ErrCreateSalesOrderFailed
	}

	createdLines := make([]db.SalesOrderLine, 0, len(req.Lines))
	for _, lineReq := range req.Lines {
		itemID, ok := parseUUID(strings.TrimSpace(lineReq.FinishedGoodItemID))
		if !ok {
			return nil, ErrInvalidSalesOrderPayload
		}

		item, err := qtx.GetItem(ctx, itemID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrInvalidSalesOrderPayload
			}
			return nil, ErrCreateSalesOrderFailed
		}
		if item.Category != db.ItemCategoryFINISHED || !item.IsActive {
			return nil, ErrInvalidSalesOrderPayload
		}

		orderedQty, ok := numericFromFloat(lineReq.OrderedQty)
		if !ok {
			return nil, ErrInvalidSalesOrderPayload
		}

		lineParams := db.CreateSalesOrderLineParams{
			SalesOrderID:       order.ID,
			FinishedGoodItemID: itemID,
			OrderedQty:         orderedQty,
		}

		if unitPrice, valid, ok := optionalNonNegativeNumeric(lineReq.UnitPrice); !ok {
			return nil, ErrInvalidSalesOrderPayload
		} else if valid {
			lineParams.UnitPrice = unitPrice
			lineTotal, err := multiplyNumerics(orderedQty, unitPrice)
			if err != nil {
				return nil, ErrCreateSalesOrderFailed
			}
			lineParams.LineTotal = lineTotal
		}

		line, err := qtx.CreateSalesOrderLine(ctx, lineParams)
		if err != nil {
			return nil, ErrCreateSalesOrderFailed
		}
		createdLines = append(createdLines, line)
	}

	if _, err := s.reservation.ReserveOrder(ctx, qtx, order, createdLines, createdByID); err != nil {
		if errors.Is(err, ErrSalesOrderInsufficientInventory) {
			return nil, err
		}
		return nil, ErrCreateSalesOrderFailed
	}

	order, err = qtx.UpdateSalesOrderStatus(ctx, db.UpdateSalesOrderStatusParams{
		Status:     salesOrderStatusReserved,
		ReservedAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ID:         order.ID,
	})
	if err != nil {
		return nil, ErrCreateSalesOrderFailed
	}

	detail, err := buildSalesOrderDetail(ctx, qtx, order.ID)
	if err != nil {
		return nil, ErrCreateSalesOrderFailed
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, ErrCreateSalesOrderFailed
	}
	committed = true

	return &SalesOrderMutationResult{Order: detail}, nil
}

func (s *SalesOrderCommandService) DispatchSalesOrder(ctx context.Context, orderID string, req models.DispatchSalesOrderRequest, performedBy string) (*SalesOrderMutationResult, error) {
	if s == nil || s.pool == nil || s.dispatch == nil {
		return nil, ErrDispatchSalesOrderFailed
	}

	parsedOrderID, ok := parseUUID(strings.TrimSpace(orderID))
	if !ok {
		return nil, ErrInvalidSalesOrderIdentifier
	}
	performedByID, ok := parseUUID(strings.TrimSpace(performedBy))
	if !ok {
		return nil, ErrInvalidSalesOrderPayload
	}
	if len(req.Lines) == 0 {
		return nil, ErrInvalidSalesOrderPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, ErrDispatchSalesOrderFailed
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	order, err := qtx.GetSalesOrderByIDForUpdate(ctx, parsedOrderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSalesOrderNotFound
		}
		return nil, ErrDispatchSalesOrderFailed
	}
	if order.Status == salesOrderStatusCancelled || order.Status == salesOrderStatusClosed || order.Status == salesOrderStatusDispatched {
		return nil, ErrSalesOrderStateConflict
	}
	if order.Status != salesOrderStatusReserved && order.Status != salesOrderStatusPartiallyDispatched {
		return nil, ErrInvalidSalesOrderTransition
	}

	lines, err := s.dispatch.DispatchOrder(ctx, qtx, order, req, performedByID)
	if err != nil {
		return nil, err
	}

	nextStatus, err := deriveSalesOrderStatus(lines)
	if err != nil {
		return nil, ErrDispatchSalesOrderFailed
	}
	if !validateSalesOrderTransition(order.Status, nextStatus) {
		return nil, ErrInvalidSalesOrderTransition
	}

	orderStatusParams := db.UpdateSalesOrderStatusParams{
		Status: nextStatus,
		Notes:  mergeSalesOrderNotes(textValue(order.Notes), strings.TrimSpace(req.Notes)),
		ID:     order.ID,
	}
	if nextStatus == salesOrderStatusDispatched {
		orderStatusParams.DispatchedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	}

	if _, err := qtx.UpdateSalesOrderStatus(ctx, orderStatusParams); err != nil {
		return nil, ErrDispatchSalesOrderFailed
	}

	detail, err := buildSalesOrderDetail(ctx, qtx, order.ID)
	if err != nil {
		return nil, ErrDispatchSalesOrderFailed
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, ErrDispatchSalesOrderFailed
	}
	committed = true

	return &SalesOrderMutationResult{Order: detail}, nil
}

func (s *SalesOrderCommandService) CancelSalesOrder(ctx context.Context, orderID string, reason string, performedBy string) (*SalesOrderMutationResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrCancelSalesOrderFailed
	}

	parsedOrderID, ok := parseUUID(strings.TrimSpace(orderID))
	if !ok {
		return nil, ErrInvalidSalesOrderIdentifier
	}
	performedByID, ok := parseUUID(strings.TrimSpace(performedBy))
	if !ok {
		return nil, ErrInvalidSalesOrderPayload
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, ErrInvalidSalesOrderPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	order, err := qtx.GetSalesOrderByIDForUpdate(ctx, parsedOrderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSalesOrderNotFound
		}
		return nil, ErrCancelSalesOrderFailed
	}
	if order.Status == salesOrderStatusCancelled || order.Status == salesOrderStatusClosed || order.Status == salesOrderStatusDispatched {
		return nil, ErrSalesOrderStateConflict
	}

	lines, err := qtx.ListSalesOrderLinesByOrderForUpdate(ctx, order.ID)
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}
	derivedStatus, err := deriveSalesOrderStatus(lines)
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}
	if derivedStatus == salesOrderStatusDispatched {
		return nil, ErrSalesOrderStateConflict
	}

	allocations, err := qtx.ListAllocationsForOrderForUpdate(ctx, order.ID)
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}

	movementGroupID := pgtype.UUID{Bytes: [16]byte(uuid.New()), Valid: true}
	for _, allocation := range allocations {
		outstandingReservedQty, err := allocationOutstandingReserved(allocation.Status, allocation.AllocatedQty, allocation.DispatchedQty)
		if err != nil {
			return nil, ErrCancelSalesOrderFailed
		}
		if cmp, err := compareNumerics(outstandingReservedQty, zeroNumeric()); err != nil {
			return nil, ErrCancelSalesOrderFailed
		} else if cmp <= 0 {
			continue
		}

		if _, err := qtx.DecrementBatchReservedQty(ctx, db.DecrementBatchReservedQtyParams{
			Qty: outstandingReservedQty,
			ID:  allocation.InventoryBatchID,
		}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrSalesOrderStateConflict
			}
			return nil, ErrCancelSalesOrderFailed
		}

		if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
			MovementGroupID: movementGroupID,
			ItemID:          allocation.FinishedGoodItemID,
			BatchID:         allocation.InventoryBatchID,
			Direction:       db.TxDirectionIN,
			Quantity:        outstandingReservedQty,
			ReferenceType:   salesOrderReferenceTypeRelease,
			ReferenceID:     order.ID,
			PerformedBy:     performedByID,
			Notes: pgtype.Text{
				String: fmt.Sprintf("Release %s for cancelled order %s: %s", mustNumericString(outstandingReservedQty), order.OrderNumber, reason),
				Valid:  true,
			},
		}); err != nil {
			return nil, ErrCancelSalesOrderFailed
		}
	}

	if _, err := qtx.ReleaseAllocations(ctx, db.ReleaseAllocationsParams{
		ReleasedAt:   pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		SalesOrderID: order.ID,
	}); err != nil {
		return nil, ErrCancelSalesOrderFailed
	}

	order, err = qtx.UpdateSalesOrderStatus(ctx, db.UpdateSalesOrderStatusParams{
		Status:      salesOrderStatusCancelled,
		Notes:       mergeSalesOrderNotes(textValue(order.Notes), "Cancellation: "+reason),
		CancelledAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ID:          order.ID,
	})
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}

	detail, err := buildSalesOrderDetail(ctx, qtx, order.ID)
	if err != nil {
		return nil, ErrCancelSalesOrderFailed
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, ErrCancelSalesOrderFailed
	}
	committed = true

	return &SalesOrderMutationResult{Order: detail}, nil
}
