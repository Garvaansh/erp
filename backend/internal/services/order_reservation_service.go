package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type OrderReservationService struct{}

func NewOrderReservationService() *OrderReservationService {
	return &OrderReservationService{}
}

func (s *OrderReservationService) ReserveOrder(
	ctx context.Context,
	qtx *db.Queries,
	order db.SalesOrder,
	lines []db.SalesOrderLine,
	performedBy pgtype.UUID,
) ([]db.SalesBatchAllocation, error) {
	if qtx == nil {
		return nil, ErrCreateSalesOrderFailed
	}

	movementGroupID := pgtype.UUID{Bytes: [16]byte(uuid.New()), Valid: true}
	reservedAt := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	allocations := make([]db.SalesBatchAllocation, 0)

	for _, line := range lines {
		item, err := qtx.GetItem(ctx, line.FinishedGoodItemID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrInvalidSalesOrderPayload
			}
			return nil, err
		}
		if item.Category != db.ItemCategoryFINISHED || !item.IsActive {
			return nil, ErrInvalidSalesOrderPayload
		}

		batches, err := qtx.GetReservableFinishedBatchesForUpdate(ctx, line.FinishedGoodItemID)
		if err != nil {
			return nil, err
		}

		remainingNeed := line.OrderedQty
		totalAvailable := zeroNumeric()
		for _, batch := range batches {
			availableQty, err := subNumerics(batch.RemainingQty, batch.ReservedQty)
			if err != nil {
				return nil, err
			}
			totalAvailable, err = addNumerics(totalAvailable, availableQty)
			if err != nil {
				return nil, err
			}
		}

		if cmp, err := compareNumerics(totalAvailable, remainingNeed); err != nil {
			return nil, err
		} else if cmp < 0 {
			return nil, ErrSalesOrderInsufficientInventory
		}

		for _, batch := range batches {
			if cmp, err := compareNumerics(remainingNeed, zeroNumeric()); err != nil {
				return nil, err
			} else if cmp == 0 {
				break
			}

			availableQty, err := subNumerics(batch.RemainingQty, batch.ReservedQty)
			if err != nil {
				return nil, err
			}
			if cmp, err := compareNumerics(availableQty, zeroNumeric()); err != nil {
				return nil, err
			} else if cmp <= 0 {
				continue
			}

			allocationQty, err := minNumericValue(remainingNeed, availableQty)
			if err != nil {
				return nil, err
			}

			if _, err := qtx.IncrementBatchReservedQty(ctx, db.IncrementBatchReservedQtyParams{
				Qty: allocationQty,
				ID:  batch.ID,
			}); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, ErrSalesOrderInsufficientInventory
				}
				return nil, err
			}

			allocation, err := qtx.CreateSalesBatchAllocation(ctx, db.CreateSalesBatchAllocationParams{
				SalesOrderLineID: line.ID,
				InventoryBatchID: batch.ID,
				AllocatedQty:     allocationQty,
				Status:           salesAllocationStatusReserved,
				ReservedAt:       reservedAt,
			})
			if err != nil {
				return nil, err
			}
			allocations = append(allocations, allocation)

			if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
				MovementGroupID: movementGroupID,
				ItemID:          line.FinishedGoodItemID,
				BatchID:         batch.ID,
				Direction:       db.TxDirectionOUT,
				Quantity:        allocationQty,
				ReferenceType:   salesOrderReferenceTypeReservation,
				ReferenceID:     order.ID,
				PerformedBy:     performedBy,
				Notes: pgtype.Text{
					String: fmt.Sprintf("Reserve %s for order %s against batch %s", mustNumericString(allocationQty), order.OrderNumber, batch.BatchCode),
					Valid:  true,
				},
			}); err != nil {
				return nil, err
			}

			remainingNeed, err = subNumerics(remainingNeed, allocationQty)
			if err != nil {
				return nil, err
			}
		}

		if cmp, err := compareNumerics(remainingNeed, zeroNumeric()); err != nil {
			return nil, err
		} else if cmp > 0 {
			return nil, ErrSalesOrderInsufficientInventory
		}
	}

	return allocations, nil
}

func minNumericValue(left, right pgtype.Numeric) (pgtype.Numeric, error) {
	cmp, err := compareNumerics(left, right)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if cmp <= 0 {
		return left, nil
	}
	return right, nil
}

func mergeSalesOrderNotes(base string, extra string) pgtype.Text {
	merged := appendOrderNote(strings.TrimSpace(base), strings.TrimSpace(extra))
	if merged == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: merged, Valid: true}
}
