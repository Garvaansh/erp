package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrGetPayablesFailed = errors.New("unable to load finance payables")

type FinanceService struct {
	queries *db.Queries
}

type PayablesPO struct {
	POID            string  `json:"po_id"`
	PONumber        string  `json:"po_number"`
	Status          string  `json:"status"`
	TotalValue      float64 `json:"total_value"`
	Paid            float64 `json:"paid"`
	Due             float64 `json:"due"`
	LastPaymentDate *string `json:"last_payment_date"`
}

type VendorPayables struct {
	VendorID       string       `json:"vendor_id"`
	VendorName     string       `json:"vendor_name"`
	VendorCode     string       `json:"vendor_code"`
	TotalPurchased float64      `json:"total_purchased"`
	TotalPaid      float64      `json:"total_paid"`
	TotalDue       float64      `json:"total_due"`
	UnpaidPOs      []PayablesPO `json:"unpaid_pos"`
}

func NewFinanceService(pool *pgxpool.Pool) *FinanceService {
	if pool == nil {
		return &FinanceService{}
	}

	return &FinanceService{queries: db.New(pool)}
}

func (s *FinanceService) GetPayables(ctx context.Context) ([]VendorPayables, error) {
	if s == nil || s.queries == nil {
		return nil, ErrGetPayablesFailed
	}

	rows, err := s.queries.GetFinancePayablesRows(ctx)
	if err != nil {
		return nil, ErrGetPayablesFailed
	}

	if len(rows) == 0 {
		return []VendorPayables{}, nil
	}

	vendorOrder := make([]string, 0)
	vendorIndex := make(map[string]int, len(rows))
	result := make([]VendorPayables, 0)

	for _, row := range rows {
		vendorID := uuidString(row.VendorID)
		poID := uuidString(row.PoID)

		totalPurchased, ok := numericToFloat64(row.TotalPurchased)
		if !ok {
			return nil, fmt.Errorf("decode total_purchased: %w", ErrGetPayablesFailed)
		}

		totalPaid, ok := numericToFloat64(row.TotalPaid)
		if !ok {
			return nil, fmt.Errorf("decode total_paid: %w", ErrGetPayablesFailed)
		}

		totalDue, ok := numericToFloat64(row.TotalDue)
		if !ok {
			return nil, fmt.Errorf("decode total_due: %w", ErrGetPayablesFailed)
		}

		poTotalValue, ok := numericToFloat64(row.TotalValue)
		if !ok {
			return nil, fmt.Errorf("decode po total_value: %w", ErrGetPayablesFailed)
		}

		poPaid, ok := numericToFloat64(row.PoTotalPaid)
		if !ok {
			return nil, fmt.Errorf("decode po paid: %w", ErrGetPayablesFailed)
		}

		poDue, ok := numericToFloat64(row.PoTotalDue)
		if !ok {
			return nil, fmt.Errorf("decode po due: %w", ErrGetPayablesFailed)
		}

		var lastPaymentDate *string
		if row.LastPaymentDate.Valid {
			formatted := timestampValue(row.LastPaymentDate)
			lastPaymentDate = &formatted
		}

		idx, exists := vendorIndex[vendorID]
		if !exists {
			idx = len(result)
			vendorIndex[vendorID] = idx
			vendorOrder = append(vendorOrder, vendorID)
			result = append(result, VendorPayables{
				VendorID:       vendorID,
				VendorName:     row.VendorName,
				VendorCode:     row.VendorCode,
				TotalPurchased: totalPurchased,
				TotalPaid:      totalPaid,
				TotalDue:       totalDue,
				UnpaidPOs:      make([]PayablesPO, 0),
			})
		}

		result[idx].UnpaidPOs = append(result[idx].UnpaidPOs, PayablesPO{
			POID:            poID,
			PONumber:        row.PoNumber,
			Status:          row.PaymentStatus,
			TotalValue:      poTotalValue,
			Paid:            poPaid,
			Due:             poDue,
			LastPaymentDate: lastPaymentDate,
		})
	}

	ordered := make([]VendorPayables, 0, len(vendorOrder))
	for _, vendorID := range vendorOrder {
		ordered = append(ordered, result[vendorIndex[vendorID]])
	}

	return ordered, nil
}
