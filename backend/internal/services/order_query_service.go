package services

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type salesOrderDetailReader interface {
	GetSalesOrderDetail(ctx context.Context, id pgtype.UUID) (db.GetSalesOrderDetailRow, error)
	GetSalesOrderLineDetails(ctx context.Context, salesOrderID pgtype.UUID) ([]db.GetSalesOrderLineDetailsRow, error)
	ListAllocationsForOrder(ctx context.Context, salesOrderID pgtype.UUID) ([]db.ListAllocationsForOrderRow, error)
}

type OrderQueryService struct {
	pool *pgxpool.Pool
}

func NewOrderQueryService(pool *pgxpool.Pool) *OrderQueryService {
	if pool == nil {
		return &OrderQueryService{}
	}
	return &OrderQueryService{pool: pool}
}

func (s *OrderQueryService) ListSalesOrders(ctx context.Context, status string, page int32, pageSize int32) (*SalesOrderListPage, error) {
	if s == nil || s.pool == nil {
		return nil, ErrListSalesOrdersFailed
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	params := db.ListSalesOrdersParams{
		PageOffset: (page - 1) * pageSize,
		PageLimit:  pageSize,
	}
	if normalized := strings.ToUpper(strings.TrimSpace(status)); normalized != "" {
		params.StatusFilter = pgtype.Text{String: normalized, Valid: true}
	}

	rows, err := db.New(s.pool).ListSalesOrders(ctx, params)
	if err != nil {
		return nil, ErrListSalesOrdersFailed
	}

	items := make([]SalesOrderListRow, 0, len(rows))
	for _, row := range rows {
		totalQty, _ := numericToFloat64(row.TotalQty)
		reservedQty, _ := numericToFloat64(row.ReservedQty)
		dispatchedQty, _ := numericToFloat64(row.DispatchedQty)

		items = append(items, SalesOrderListRow{
			ID:                  uuidString(row.ID),
			OrderNumber:         row.OrderNumber,
			CustomerID:          uuidString(row.CustomerID),
			CustomerDisplayName: strings.TrimSpace(row.CustomerDisplayName),
			CustomerCompanyName: strings.TrimSpace(row.CustomerCompanyName),
			TotalQty:            totalQty,
			ReservedQty:         reservedQty,
			DispatchedQty:       dispatchedQty,
			Status:              row.Status,
			OrderDate:           timestampValue(row.OrderDate),
		})
	}

	return &SalesOrderListPage{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *OrderQueryService) GetSalesOrderDetail(ctx context.Context, orderID string) (*SalesOrderDetail, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetSalesOrderDetailFailed
	}
	parsedOrderID, ok := parseUUID(strings.TrimSpace(orderID))
	if !ok {
		return nil, ErrInvalidSalesOrderIdentifier
	}
	return buildSalesOrderDetail(ctx, db.New(s.pool), parsedOrderID)
}

func (s *OrderQueryService) GetOrderAllocations(ctx context.Context, orderID string) ([]SalesOrderAllocationView, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetSalesOrderDetailFailed
	}
	parsedOrderID, ok := parseUUID(strings.TrimSpace(orderID))
	if !ok {
		return nil, ErrInvalidSalesOrderIdentifier
	}
	rows, err := db.New(s.pool).ListAllocationsForOrder(ctx, parsedOrderID)
	if err != nil {
		return nil, ErrGetSalesOrderDetailFailed
	}
	return mapSalesOrderAllocations(rows)
}

func (s *OrderQueryService) GetFinishedGoodReservations(ctx context.Context, itemID string) (*FinishedGoodReservationVisibility, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetFinishedReservationsFailed
	}
	parsedItemID, ok := parseUUID(strings.TrimSpace(itemID))
	if !ok {
		return nil, ErrInvalidItemID
	}

	queries := db.New(s.pool)
	summary, err := queries.GetFinishedGoodReservationSummary(ctx, parsedItemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFinishedReservationNotFound
		}
		return nil, ErrGetFinishedReservationsFailed
	}
	rows, err := queries.ListFinishedGoodReservations(ctx, parsedItemID)
	if err != nil {
		return nil, ErrGetFinishedReservationsFailed
	}

	totalReserved, _ := numericToFloat64(summary.TotalReserved)
	visibility := &FinishedGoodReservationVisibility{
		ItemID:          uuidString(summary.ItemID),
		TotalReserved:   totalReserved,
		BatchesInvolved: summary.BatchesInvolved,
		ReservingOrders: summary.ReservingOrders,
		Reservations:    make([]FinishedGoodReservationOrderView, 0, len(rows)),
	}

	for _, row := range rows {
		reservedQty, _ := numericToFloat64(row.ReservedQty)
		dispatchedQty, _ := numericToFloat64(row.DispatchedQty)
		visibility.Reservations = append(visibility.Reservations, FinishedGoodReservationOrderView{
			SalesOrderID:        uuidString(row.SalesOrderID),
			OrderNumber:         row.OrderNumber,
			OrderStatus:         row.OrderStatus,
			CustomerID:          uuidString(row.CustomerID),
			CustomerDisplayName: strings.TrimSpace(row.CustomerDisplayName),
			CustomerCompanyName: strings.TrimSpace(row.CustomerCompanyName),
			ReservedQty:         reservedQty,
			DispatchedQty:       dispatchedQty,
			AllocationStatuses:  stringSliceValue(row.AllocationStatuses),
		})
	}

	return visibility, nil
}

func (s *OrderQueryService) GetBatchReservations(ctx context.Context, batchCode string) (*BatchReservationDrillDown, error) {
	if s == nil || s.pool == nil {
		return nil, ErrGetBatchReservationsFailed
	}
	batchCode = strings.TrimSpace(batchCode)
	if batchCode == "" {
		return nil, ErrBatchReservationNotFound
	}

	queries := db.New(s.pool)
	batch, err := queries.GetBatchByCode(ctx, batchCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBatchReservationNotFound
		}
		return nil, ErrGetBatchReservationsFailed
	}

	rows, err := queries.ListAllocationsForBatch(ctx, batch.ID)
	if err != nil {
		return nil, ErrGetBatchReservationsFailed
	}

	result := &BatchReservationDrillDown{
		BatchID:      uuidString(batch.ID),
		BatchCode:    batch.BatchCode,
		ItemID:       uuidString(batch.ItemID),
		ItemName:     strings.TrimSpace(batch.ItemName),
		Reservations: make([]BatchReservationDrillDownRow, 0, len(rows)),
	}

	for _, row := range rows {
		reservedQty, err := allocationOutstandingReserved(row.Status, row.AllocatedQty, row.DispatchedQty)
		if err != nil {
			return nil, ErrGetBatchReservationsFailed
		}
		reservedQtyFloat, _ := numericToFloat64(reservedQty)
		dispatchedQtyFloat, _ := numericToFloat64(row.DispatchedQty)

		result.Reservations = append(result.Reservations, BatchReservationDrillDownRow{
			OrderNumber:         row.OrderNumber,
			CustomerDisplayName: strings.TrimSpace(row.CustomerDisplayName),
			CustomerCompanyName: strings.TrimSpace(row.CustomerCompanyName),
			ReservedQty:         reservedQtyFloat,
			DispatchedQty:       dispatchedQtyFloat,
			AllocationStatus:    row.Status,
			ReservationDate:     timestampValue(row.ReservedAt),
		})
	}

	return result, nil
}

func buildSalesOrderDetail(ctx context.Context, reader salesOrderDetailReader, orderID pgtype.UUID) (*SalesOrderDetail, error) {
	header, err := reader.GetSalesOrderDetail(ctx, orderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSalesOrderNotFound
		}
		return nil, ErrGetSalesOrderDetailFailed
	}

	lineRows, err := reader.GetSalesOrderLineDetails(ctx, orderID)
	if err != nil {
		return nil, ErrGetSalesOrderDetailFailed
	}
	allocationRows, err := reader.ListAllocationsForOrder(ctx, orderID)
	if err != nil {
		return nil, ErrGetSalesOrderDetailFailed
	}

	totalQty, _ := numericToFloat64(header.TotalQty)
	reservedQty, _ := numericToFloat64(header.ReservedQty)
	dispatchedQty, _ := numericToFloat64(header.DispatchedQty)

	lines := make([]SalesOrderLineView, 0, len(lineRows))
	for _, row := range lineRows {
		orderedQty, _ := numericToFloat64(row.OrderedQty)
		lineReservedQty, _ := numericToFloat64(row.ReservedQty)
		lineDispatchedQty, _ := numericToFloat64(row.DispatchedQty)
		unitPrice, _ := numericToFloat64(row.UnitPrice)
		lineTotal, _ := numericToFloat64(row.LineTotal)

		lines = append(lines, SalesOrderLineView{
			ID:                 uuidString(row.ID),
			FinishedGoodItemID: uuidString(row.FinishedGoodItemID),
			ItemSKU:            strings.TrimSpace(row.ItemSku),
			ItemName:           row.ItemName,
			OrderedQty:         orderedQty,
			ReservedQty:        lineReservedQty,
			DispatchedQty:      lineDispatchedQty,
			UnitPrice:          unitPrice,
			LineTotal:          lineTotal,
			CreatedAt:          timestampValue(row.CreatedAt),
		})
	}

	allocations, err := mapSalesOrderAllocations(allocationRows)
	if err != nil {
		return nil, ErrGetSalesOrderDetailFailed
	}

	return &SalesOrderDetail{
		ID:            uuidString(header.ID),
		OrderNumber:   header.OrderNumber,
		Status:        header.Status,
		Notes:         textValue(header.Notes),
		OrderDate:     timestampValue(header.OrderDate),
		ReservedAt:    timestampValue(header.ReservedAt),
		DispatchedAt:  timestampValue(header.DispatchedAt),
		CancelledAt:   timestampValue(header.CancelledAt),
		CreatedAt:     timestampValue(header.CreatedAt),
		UpdatedAt:     timestampValue(header.UpdatedAt),
		TotalQty:      totalQty,
		ReservedQty:   reservedQty,
		DispatchedQty: dispatchedQty,
		Customer: SalesOrderCustomerView{
			ID:          uuidString(header.CustomerID),
			DisplayName: strings.TrimSpace(header.CustomerDisplayName),
			CompanyName: strings.TrimSpace(header.CustomerCompanyName),
			PhoneNumber: strings.TrimSpace(header.CustomerPhoneNumber),
		},
		Lines:       lines,
		Allocations: allocations,
	}, nil
}

func mapSalesOrderAllocations(rows []db.ListAllocationsForOrderRow) ([]SalesOrderAllocationView, error) {
	allocations := make([]SalesOrderAllocationView, 0, len(rows))
	for _, row := range rows {
		reservedQty, err := allocationOutstandingReserved(row.Status, row.AllocatedQty, row.DispatchedQty)
		if err != nil {
			return nil, err
		}
		reservedQtyFloat, _ := numericToFloat64(reservedQty)
		dispatchedQtyFloat, _ := numericToFloat64(row.DispatchedQty)

		allocations = append(allocations, SalesOrderAllocationView{
			ID:               uuidString(row.ID),
			SalesOrderLineID: uuidString(row.SalesOrderLineID),
			InventoryBatchID: uuidString(row.InventoryBatchID),
			BatchCode:        row.BatchCode,
			ReservedQty:      reservedQtyFloat,
			DispatchedQty:    dispatchedQtyFloat,
			Status:           row.Status,
			ReservedAt:       timestampValue(row.ReservedAt),
			DispatchedAt:     timestampValue(row.DispatchedAt),
			ReleasedAt:       timestampValue(row.ReleasedAt),
		})
	}
	return allocations, nil
}
