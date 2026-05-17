package services

import (
	"testing"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestValidateSalesOrderTransition(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		current string
		next    string
		want    bool
	}{
		{name: "draft to reserved", current: salesOrderStatusDraft, next: salesOrderStatusReserved, want: true},
		{name: "reserved to partial", current: salesOrderStatusReserved, next: salesOrderStatusPartiallyDispatched, want: true},
		{name: "partial to dispatched", current: salesOrderStatusPartiallyDispatched, next: salesOrderStatusDispatched, want: true},
		{name: "reserved to cancelled", current: salesOrderStatusReserved, next: salesOrderStatusCancelled, want: true},
		{name: "dispatched to cancelled", current: salesOrderStatusDispatched, next: salesOrderStatusCancelled, want: false},
		{name: "closed to reserved", current: salesOrderStatusClosed, next: salesOrderStatusReserved, want: false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := validateSalesOrderTransition(tc.current, tc.next); got != tc.want {
				t.Fatalf("validateSalesOrderTransition(%q, %q) = %v, want %v", tc.current, tc.next, got, tc.want)
			}
		})
	}
}

func TestDeriveSalesOrderStatus(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		lines []db.SalesOrderLine
		want  string
	}{
		{
			name: "reserved when nothing dispatched",
			lines: []db.SalesOrderLine{
				{OrderedQty: mustNumericForTest(t, 10), DispatchedQty: mustNumericForTest(t, 0)},
				{OrderedQty: mustNumericForTest(t, 5), DispatchedQty: mustNumericForTest(t, 0)},
			},
			want: salesOrderStatusReserved,
		},
		{
			name: "partially dispatched when some outstanding",
			lines: []db.SalesOrderLine{
				{OrderedQty: mustNumericForTest(t, 10), DispatchedQty: mustNumericForTest(t, 10)},
				{OrderedQty: mustNumericForTest(t, 5), DispatchedQty: mustNumericForTest(t, 2)},
			},
			want: salesOrderStatusPartiallyDispatched,
		},
		{
			name: "dispatched when all lines complete",
			lines: []db.SalesOrderLine{
				{OrderedQty: mustNumericForTest(t, 10), DispatchedQty: mustNumericForTest(t, 10)},
				{OrderedQty: mustNumericForTest(t, 5), DispatchedQty: mustNumericForTest(t, 5)},
			},
			want: salesOrderStatusDispatched,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := deriveSalesOrderStatus(tc.lines)
			if err != nil {
				t.Fatalf("deriveSalesOrderStatus() error = %v", err)
			}
			if got != tc.want {
				t.Fatalf("deriveSalesOrderStatus() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestAllocationOutstandingReserved(t *testing.T) {
	t.Parallel()

	allocated := mustNumericForTest(t, 50)
	dispatched := mustNumericForTest(t, 20)

	got, err := allocationOutstandingReserved(salesAllocationStatusPartiallyDispatched, allocated, dispatched)
	if err != nil {
		t.Fatalf("allocationOutstandingReserved() error = %v", err)
	}

	value, err := got.Float64Value()
	if err != nil || !value.Valid {
		t.Fatalf("allocationOutstandingReserved() float conversion error = %v", err)
	}
	if value.Float64 != 30 {
		t.Fatalf("allocationOutstandingReserved() = %v, want 30", value.Float64)
	}

	released, err := allocationOutstandingReserved(salesAllocationStatusReleased, allocated, dispatched)
	if err != nil {
		t.Fatalf("allocationOutstandingReserved(released) error = %v", err)
	}
	releasedValue, err := released.Float64Value()
	if err != nil || !releasedValue.Valid {
		t.Fatalf("allocationOutstandingReserved(released) float conversion error = %v", err)
	}
	if releasedValue.Float64 != 0 {
		t.Fatalf("allocationOutstandingReserved(released) = %v, want 0", releasedValue.Float64)
	}
}

func mustNumericForTest(t *testing.T, value float64) pgtype.Numeric {
	t.Helper()

	numeric, ok := numericFromNonNegativeFloat(value)
	if !ok {
		t.Fatalf("numericFromNonNegativeFloat(%v) failed", value)
	}
	return numeric
}
