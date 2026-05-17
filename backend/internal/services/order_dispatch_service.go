package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type OrderDispatchService struct{}

func NewOrderDispatchService() *OrderDispatchService {
	return &OrderDispatchService{}
}

func (s *OrderDispatchService) DispatchOrder(
	ctx context.Context,
	qtx *db.Queries,
	order db.SalesOrder,
	req models.DispatchSalesOrderRequest,
	performedBy pgtype.UUID,
) ([]db.SalesOrderLine, error) {
	if qtx == nil {
		return nil, ErrDispatchSalesOrderFailed
	}

	lines, err := qtx.ListSalesOrderLinesByOrderForUpdate(ctx, order.ID)
	if err != nil {
		return nil, err
	}

	lineByID := make(map[string]db.SalesOrderLine, len(lines))
	for _, line := range lines {
		lineByID[uuidString(line.ID)] = line
	}

	movementGroupID := pgtype.UUID{Bytes: [16]byte(uuid.New()), Valid: true}
	dispatchedAt := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}

	for _, dispatchLine := range req.Lines {
		line, ok := lineByID[dispatchLine.SalesOrderLineID]
		if !ok {
			return nil, ErrSalesOrderLineNotFound
		}

		dispatchQty, ok := numericFromFloat(dispatchLine.DispatchQty)
		if !ok {
			return nil, ErrSalesOrderDispatchQtyInvalid
		}

		outstandingLineQty, err := subNumerics(line.OrderedQty, line.DispatchedQty)
		if err != nil {
			return nil, err
		}
		if cmp, err := compareNumerics(dispatchQty, outstandingLineQty); err != nil {
			return nil, err
		} else if cmp > 0 {
			return nil, ErrSalesOrderDispatchQtyInvalid
		}

		allocations, err := qtx.ListAllocationsForLineForUpdate(ctx, line.ID)
		if err != nil {
			return nil, err
		}

		remainingDispatch := dispatchQty
		for _, allocation := range allocations {
			if cmp, err := compareNumerics(remainingDispatch, zeroNumeric()); err != nil {
				return nil, err
			} else if cmp == 0 {
				break
			}

			if allocation.Status == salesAllocationStatusReleased || allocation.Status == salesAllocationStatusDispatched {
				continue
			}

			outstandingReservedQty, err := allocationOutstandingReserved(allocation.Status, allocation.AllocatedQty, allocation.DispatchedQty)
			if err != nil {
				return nil, err
			}
			if cmp, err := compareNumerics(outstandingReservedQty, zeroNumeric()); err != nil {
				return nil, err
			} else if cmp <= 0 {
				continue
			}

			dispatchPart, err := minNumericValue(remainingDispatch, outstandingReservedQty)
			if err != nil {
				return nil, err
			}

			if _, err := qtx.DeductBatchRemainingQty(ctx, db.DeductBatchRemainingQtyParams{
				Qty: dispatchPart,
				ID:  allocation.InventoryBatchID,
			}); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, ErrSalesOrderStateConflict
				}
				return nil, err
			}

			if _, err := qtx.DecrementBatchReservedQty(ctx, db.DecrementBatchReservedQtyParams{
				Qty: dispatchPart,
				ID:  allocation.InventoryBatchID,
			}); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, ErrSalesOrderStateConflict
				}
				return nil, err
			}

			nextAllocationDispatchedQty, err := addNumerics(allocation.DispatchedQty, dispatchPart)
			if err != nil {
				return nil, err
			}
			nextAllocationStatus, err := mapAllocationStatusAfterDispatch(allocation.AllocatedQty, nextAllocationDispatchedQty)
			if err != nil {
				return nil, err
			}

			if _, err := qtx.UpdateAllocationDispatch(ctx, db.UpdateAllocationDispatchParams{
				DispatchedQty: nextAllocationDispatchedQty,
				Status:        nextAllocationStatus,
				DispatchedAt:  dispatchedAt,
				ID:            allocation.ID,
			}); err != nil {
				return nil, err
			}

			if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
				MovementGroupID: movementGroupID,
				ItemID:          line.FinishedGoodItemID,
				BatchID:         allocation.InventoryBatchID,
				Direction:       db.TxDirectionOUT,
				Quantity:        dispatchPart,
				ReferenceType:   salesOrderReferenceTypeDispatch,
				ReferenceID:     order.ID,
				PerformedBy:     performedBy,
				Notes: pgtype.Text{
					String: fmt.Sprintf("Dispatch %s for order %s against batch %s", mustNumericString(dispatchPart), order.OrderNumber, allocation.BatchCode),
					Valid:  true,
				},
			}); err != nil {
				return nil, err
			}

			remainingDispatch, err = subNumerics(remainingDispatch, dispatchPart)
			if err != nil {
				return nil, err
			}
		}

		if cmp, err := compareNumerics(remainingDispatch, zeroNumeric()); err != nil {
			return nil, err
		} else if cmp > 0 {
			return nil, ErrSalesOrderDispatchQtyInvalid
		}

		nextLineDispatchedQty, err := addNumerics(line.DispatchedQty, dispatchQty)
		if err != nil {
			return nil, err
		}
		updatedLine, err := qtx.UpdateOrderDispatchProgress(ctx, db.UpdateOrderDispatchProgressParams{
			DispatchedQty: nextLineDispatchedQty,
			ID:            line.ID,
		})
		if err != nil {
			return nil, err
		}
		lineByID[dispatchLine.SalesOrderLineID] = updatedLine
	}

	updatedLines := make([]db.SalesOrderLine, 0, len(lineByID))
	for _, line := range lines {
		updatedLines = append(updatedLines, lineByID[uuidString(line.ID)])
	}
	return updatedLines, nil
}
