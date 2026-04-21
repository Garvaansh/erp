package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrGetPayablesFailed = errors.New("unable to load finance payables")
var ErrGetLedgerFailed = errors.New("unable to load finance ledger")
var ErrInvalidLedgerFilter = errors.New("invalid ledger filter")

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

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

type LedgerFilter struct {
	FromDate string
	ToDate   string
}

type LedgerEntry struct {
	TxID            string  `json:"tx_id"`
	Type            string  `json:"type"`
	Amount          float64 `json:"amount"`
	Date            string  `json:"date"`
	ReferenceType   string  `json:"reference_type"`
	ReferenceID     string  `json:"reference_id"`
	ReferenceNumber string  `json:"reference_number"`
	PartyName       string  `json:"party_name"`
	Note            string  `json:"note"`
}

func (s *FinanceService) GetLedger(ctx context.Context, filter LedgerFilter) ([]LedgerEntry, error) {
	if s == nil || s.queries == nil {
		return nil, ErrGetLedgerFailed
	}

	params, err := buildLedgerParams(filter)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.GetFinanceLedgerRows(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("query ledger: %w", ErrGetLedgerFailed)
	}

	entries := make([]LedgerEntry, 0, len(rows))
	for _, row := range rows {
		amount, ok := numericToFloat64(row.Amount)
		if !ok {
			return nil, fmt.Errorf("decode amount: %w", ErrGetLedgerFailed)
		}

		entries = append(entries, LedgerEntry{
			TxID:            row.TxID,
			Type:            row.TxType,
			Amount:          amount,
			Date:            timestampValue(row.TxDate),
			ReferenceType:   row.ReferenceType,
			ReferenceID:     uuidString(row.ReferenceID),
			ReferenceNumber: row.ReferenceNumber,
			PartyName:       row.PartyName,
			Note:            row.Note,
		})
	}

	return entries, nil
}

func buildLedgerParams(filter LedgerFilter) (db.GetFinanceLedgerRowsParams, error) {
	var params db.GetFinanceLedgerRowsParams

	if filter.FromDate != "" {
		t, err := parseFilterDate(filter.FromDate)
		if err != nil {
			return params, fmt.Errorf("from_date: %w", ErrInvalidLedgerFilter)
		}
		params.FromDate = t
	}

	if filter.ToDate != "" {
		t, err := parseFilterDate(filter.ToDate)
		if err != nil {
			return params, fmt.Errorf("to_date: %w", ErrInvalidLedgerFilter)
		}
		params.ToDate = t
	}

	return params, nil
}

func parseFilterDate(value string) (pgtype.Timestamptz, error) {
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return pgtype.Timestamptz{}, err
	}

	return pgtype.Timestamptz{Time: t, Valid: true}, nil
}
