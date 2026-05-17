package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	salesOrderStatusDraft               = "DRAFT"
	salesOrderStatusReserved            = "RESERVED"
	salesOrderStatusPartiallyDispatched = "PARTIALLY_DISPATCHED"
	salesOrderStatusDispatched          = "DISPATCHED"
	salesOrderStatusCancelled           = "CANCELLED"
	salesOrderStatusClosed              = "CLOSED"

	salesAllocationStatusReserved            = "RESERVED"
	salesAllocationStatusPartiallyDispatched = "PARTIALLY_DISPATCHED"
	salesAllocationStatusDispatched          = "DISPATCHED"
	salesAllocationStatusReleased            = "RELEASED"

	salesOrderReferenceTypeReservation = "SALES_ORDER_RESERVATION"
	salesOrderReferenceTypeDispatch    = "SALES_ORDER_DISPATCH"
	salesOrderReferenceTypeRelease     = "SALES_ORDER_RELEASE"
)

var (
	ErrCreateSalesOrderFailed          = errors.New("unable to create sales order")
	ErrDispatchSalesOrderFailed        = errors.New("unable to dispatch sales order")
	ErrCancelSalesOrderFailed          = errors.New("unable to cancel sales order")
	ErrListSalesOrdersFailed           = errors.New("unable to list sales orders")
	ErrGetSalesOrderDetailFailed       = errors.New("unable to get sales order detail")
	ErrGetBatchReservationsFailed      = errors.New("unable to get batch reservations")
	ErrGetFinishedReservationsFailed   = errors.New("unable to get finished good reservations")
	ErrInvalidSalesOrderPayload        = errors.New("invalid sales order payload")
	ErrInvalidSalesOrderIdentifier     = errors.New("invalid sales order identifier")
	ErrInvalidSalesOrderTransition     = errors.New("invalid sales order status transition")
	ErrSalesOrderNotFound              = errors.New("sales order not found")
	ErrSalesOrderLineNotFound          = errors.New("sales order line not found")
	ErrSalesOrderStateConflict         = errors.New("sales order is not in a valid state for this operation")
	ErrSalesOrderInsufficientInventory = errors.New("insufficient finished goods inventory to reserve order")
	ErrSalesOrderDispatchQtyInvalid    = errors.New("invalid dispatch quantity")
	ErrSalesOrderAlreadyFinalized      = errors.New("sales order is already finalized")
	ErrFinishedReservationNotFound     = errors.New("finished good reservation target not found")
	ErrBatchReservationNotFound        = errors.New("batch reservation target not found")
)

type SalesOrderListPage struct {
	Items    []SalesOrderListRow `json:"items"`
	Page     int32               `json:"page"`
	PageSize int32               `json:"page_size"`
}

type SalesOrderListRow struct {
	ID                  string  `json:"id"`
	OrderNumber         string  `json:"order_number"`
	CustomerID          string  `json:"customer_id"`
	CustomerDisplayName string  `json:"customer_display_name"`
	CustomerCompanyName string  `json:"customer_company_name"`
	TotalQty            float64 `json:"total_qty"`
	ReservedQty         float64 `json:"reserved_qty"`
	DispatchedQty       float64 `json:"dispatched_qty"`
	Status              string  `json:"status"`
	OrderDate           string  `json:"order_date"`
}

type SalesOrderCustomerView struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	CompanyName string `json:"company_name"`
	PhoneNumber string `json:"phone_number"`
}

type SalesOrderLineView struct {
	ID                 string  `json:"id"`
	FinishedGoodItemID string  `json:"finished_good_item_id"`
	ItemSKU            string  `json:"item_sku"`
	ItemName           string  `json:"item_name"`
	OrderedQty         float64 `json:"ordered_qty"`
	ReservedQty        float64 `json:"reserved_qty"`
	DispatchedQty      float64 `json:"dispatched_qty"`
	UnitPrice          float64 `json:"unit_price"`
	LineTotal          float64 `json:"line_total"`
	CreatedAt          string  `json:"created_at"`
}

type SalesOrderAllocationView struct {
	ID               string  `json:"id"`
	SalesOrderLineID string  `json:"sales_order_line_id"`
	InventoryBatchID string  `json:"inventory_batch_id"`
	BatchCode        string  `json:"batch_code"`
	ReservedQty      float64 `json:"reserved_qty"`
	DispatchedQty    float64 `json:"dispatched_qty"`
	Status           string  `json:"status"`
	ReservedAt       string  `json:"reserved_at"`
	DispatchedAt     string  `json:"dispatched_at,omitempty"`
	ReleasedAt       string  `json:"released_at,omitempty"`
}

type SalesOrderDetail struct {
	ID            string                     `json:"id"`
	OrderNumber   string                     `json:"order_number"`
	Status        string                     `json:"status"`
	Notes         string                     `json:"notes"`
	OrderDate     string                     `json:"order_date"`
	ReservedAt    string                     `json:"reserved_at,omitempty"`
	DispatchedAt  string                     `json:"dispatched_at,omitempty"`
	CancelledAt   string                     `json:"cancelled_at,omitempty"`
	CreatedAt     string                     `json:"created_at"`
	UpdatedAt     string                     `json:"updated_at"`
	TotalQty      float64                    `json:"total_qty"`
	ReservedQty   float64                    `json:"reserved_qty"`
	DispatchedQty float64                    `json:"dispatched_qty"`
	Customer      SalesOrderCustomerView     `json:"customer"`
	Lines         []SalesOrderLineView       `json:"lines"`
	Allocations   []SalesOrderAllocationView `json:"allocations"`
}

type SalesOrderMutationResult struct {
	Order *SalesOrderDetail `json:"order"`
}

type FinishedGoodReservationOrderView struct {
	SalesOrderID        string   `json:"sales_order_id"`
	OrderNumber         string   `json:"order_number"`
	OrderStatus         string   `json:"order_status"`
	CustomerID          string   `json:"customer_id"`
	CustomerDisplayName string   `json:"customer_display_name"`
	CustomerCompanyName string   `json:"customer_company_name"`
	ReservedQty         float64  `json:"reserved_qty"`
	DispatchedQty       float64  `json:"dispatched_qty"`
	AllocationStatuses  []string `json:"allocation_statuses"`
}

type FinishedGoodReservationVisibility struct {
	ItemID          string                             `json:"item_id"`
	TotalReserved   float64                            `json:"total_reserved"`
	BatchesInvolved int32                              `json:"batches_involved"`
	ReservingOrders int32                              `json:"reserving_orders"`
	Reservations    []FinishedGoodReservationOrderView `json:"reservations"`
}

type BatchReservationDrillDownRow struct {
	OrderNumber         string  `json:"order_number"`
	CustomerDisplayName string  `json:"customer_display_name"`
	CustomerCompanyName string  `json:"customer_company_name"`
	ReservedQty         float64 `json:"reserved_qty"`
	DispatchedQty       float64 `json:"dispatched_qty"`
	AllocationStatus    string  `json:"allocation_status"`
	ReservationDate     string  `json:"reservation_date"`
}

type BatchReservationDrillDown struct {
	BatchID      string                         `json:"batch_id"`
	BatchCode    string                         `json:"batch_code"`
	ItemID       string                         `json:"item_id"`
	ItemName     string                         `json:"item_name"`
	Reservations []BatchReservationDrillDownRow `json:"reservations"`
}

func validateSalesOrderTransition(current string, next string) bool {
	switch current {
	case salesOrderStatusDraft:
		return next == salesOrderStatusReserved || next == salesOrderStatusCancelled
	case salesOrderStatusReserved:
		return next == salesOrderStatusPartiallyDispatched || next == salesOrderStatusDispatched || next == salesOrderStatusCancelled
	case salesOrderStatusPartiallyDispatched:
		return next == salesOrderStatusPartiallyDispatched || next == salesOrderStatusDispatched || next == salesOrderStatusCancelled
	case salesOrderStatusDispatched:
		return next == salesOrderStatusClosed
	default:
		return false
	}
}

func deriveSalesOrderStatus(lines []db.SalesOrderLine) (string, error) {
	if len(lines) == 0 {
		return salesOrderStatusDraft, nil
	}

	allDispatched := true
	anyDispatched := false
	for _, line := range lines {
		cmp, err := compareNumerics(line.DispatchedQty, zeroNumeric())
		if err != nil {
			return "", err
		}
		if cmp > 0 {
			anyDispatched = true
		}

		lineCmp, err := compareNumerics(line.DispatchedQty, line.OrderedQty)
		if err != nil {
			return "", err
		}
		if lineCmp != 0 {
			allDispatched = false
		}
	}

	switch {
	case allDispatched:
		return salesOrderStatusDispatched, nil
	case anyDispatched:
		return salesOrderStatusPartiallyDispatched, nil
	default:
		return salesOrderStatusReserved, nil
	}
}

func numericFromNonNegativeFloat(value float64) (pgtype.Numeric, bool) {
	if value < 0 || math.IsNaN(value) || math.IsInf(value, 0) {
		return pgtype.Numeric{}, false
	}
	if value == 0 {
		return zeroNumeric(), true
	}

	var numeric pgtype.Numeric
	if err := numeric.Scan(fmt.Sprintf("%.4f", value)); err != nil {
		return pgtype.Numeric{}, false
	}
	return numeric, true
}

func optionalNonNegativeNumeric(value *float64) (pgtype.Numeric, bool, bool) {
	if value == nil {
		return pgtype.Numeric{}, false, true
	}
	numeric, ok := numericFromNonNegativeFloat(*value)
	return numeric, true, ok
}

func multiplyNumerics(left, right pgtype.Numeric) (pgtype.Numeric, error) {
	leftRat, err := numericToRat(left)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	rightRat, err := numericToRat(right)
	if err != nil {
		return pgtype.Numeric{}, err
	}
	result := new(big.Rat).Mul(leftRat, rightRat)
	return numericFromRat(result)
}

func allocationOutstandingReserved(status string, allocatedQty, dispatchedQty pgtype.Numeric) (pgtype.Numeric, error) {
	if status == salesAllocationStatusReleased || status == salesAllocationStatusDispatched {
		return zeroNumeric(), nil
	}
	return subNumerics(allocatedQty, dispatchedQty)
}

func mapAllocationStatusAfterDispatch(allocatedQty, dispatchedQty pgtype.Numeric) (string, error) {
	cmp, err := compareNumerics(dispatchedQty, allocatedQty)
	if err != nil {
		return "", err
	}
	if cmp == 0 {
		return salesAllocationStatusDispatched, nil
	}
	return salesAllocationStatusPartiallyDispatched, nil
}

func appendOrderNote(existing, addition string) string {
	base := strings.TrimSpace(existing)
	extra := strings.TrimSpace(addition)
	switch {
	case base == "" && extra == "":
		return ""
	case base == "":
		return extra
	case extra == "":
		return base
	default:
		return base + "\n" + extra
	}
}

func stringSliceValue(raw any) []string {
	switch typed := raw.(type) {
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := strings.TrimSpace(fmt.Sprint(item)); text != "" {
				out = append(out, text)
			}
		}
		return out
	case []byte:
		var out []string
		if err := json.Unmarshal(typed, &out); err == nil {
			return out
		}
		return nil
	default:
		return nil
	}
}
