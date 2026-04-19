package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	paymentStatusUnpaid  = "UNPAID"
	paymentStatusPartial = "PARTIAL"
	paymentStatusPaid    = "PAID"
)

type paymentSummary struct {
	POID          string  `json:"po_id"`
	TotalValue    float64 `json:"total_value"`
	PaidAmount    float64 `json:"paid_amount"`
	DueAmount     float64 `json:"due_amount"`
	PaymentStatus string  `json:"payment_status"`
}

func computeDueAmount(totalValue float64, paidAmount float64) float64 {
	dueAmount := totalValue - paidAmount
	if dueAmount < 0 {
		return 0
	}
	return dueAmount
}

func derivePaymentStatus(totalValue float64, paidAmount float64) string {
	if paidAmount <= 0 {
		return paymentStatusUnpaid
	}

	if paidAmount < totalValue {
		return paymentStatusPartial
	}

	return paymentStatusPaid
}

func loadPaymentSummaryForPO(ctx context.Context, pool *pgxpool.Pool, poID string) (paymentSummary, error) {
	if pool == nil {
		return paymentSummary{}, fmt.Errorf("payment summary pool is nil")
	}

	var totalNumeric pgtype.Numeric
	var paidNumeric pgtype.Numeric

	err := pool.QueryRow(ctx, `
		SELECT
			CASE
				WHEN EXISTS (
					SELECT 1
					FROM inventory_batches b
					WHERE b.parent_po_id = po.id
				) THEN COALESCE((
					SELECT SUM(b.initial_qty * COALESCE(b.unit_cost, po.unit_price))
					FROM inventory_batches b
					WHERE b.parent_po_id = po.id
					  AND b.status <> 'REVERSED'
				), 0)
				ELSE (COALESCE(po.received_qty, 0) * COALESCE(po.unit_price, 0))
			END AS total_value,
			COALESCE((
				SELECT SUM(amount)
				FROM purchase_order_payments p
				WHERE p.po_id = po.id
			), 0) AS paid_amount
		FROM purchase_orders po
		WHERE po.id = $1::uuid
	`, poID).Scan(&totalNumeric, &paidNumeric)
	if err != nil {
		return paymentSummary{}, err
	}

	totalValue, ok := numericToFloat64(totalNumeric)
	if !ok {
		return paymentSummary{}, fmt.Errorf("invalid total_value numeric")
	}

	paidAmount, ok := numericToFloat64(paidNumeric)
	if !ok {
		return paymentSummary{}, fmt.Errorf("invalid paid_amount numeric")
	}

	return paymentSummary{
		POID:          poID,
		TotalValue:    totalValue,
		PaidAmount:    paidAmount,
		DueAmount:     computeDueAmount(totalValue, paidAmount),
		PaymentStatus: derivePaymentStatus(totalValue, paidAmount),
	}, nil
}

func loadPaymentSummaryMapForPOs(ctx context.Context, pool *pgxpool.Pool, poIDs []string) (map[string]paymentSummary, error) {
	out := make(map[string]paymentSummary, len(poIDs))
	if len(poIDs) == 0 {
		return out, nil
	}
	if pool == nil {
		return nil, fmt.Errorf("payment summary pool is nil")
	}

	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
		WITH payment_totals AS (
			SELECT
				po_id,
				COALESCE(SUM(amount), 0) AS paid_amount
			FROM purchase_order_payments
			GROUP BY po_id
		)
		SELECT
			po.id::text AS po_id,
			CASE
				WHEN COUNT(b.id) > 0 THEN COALESCE(
					SUM(CASE WHEN b.status <> 'REVERSED' THEN b.initial_qty * COALESCE(b.unit_cost, po.unit_price) ELSE 0 END),
					0
				)
				ELSE (COALESCE(po.received_qty, 0) * COALESCE(po.unit_price, 0))
			END AS total_value,
			COALESCE(pt.paid_amount, 0) AS paid_amount
		FROM purchase_orders po
		LEFT JOIN inventory_batches b ON b.parent_po_id = po.id
		LEFT JOIN payment_totals pt ON pt.po_id = po.id
		WHERE po.id IN (
	`)

	args := make([]any, 0, len(poIDs))
	for idx, poID := range poIDs {
		if idx > 0 {
			queryBuilder.WriteString(",")
		}
		queryBuilder.WriteString(fmt.Sprintf("$%d::uuid", idx+1))
		args = append(args, poID)
	}

	queryBuilder.WriteString(`
		)
		GROUP BY po.id, po.received_qty, po.unit_price, pt.paid_amount
	`)

	rows, err := pool.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var poID string
		var totalNumeric pgtype.Numeric
		var paidNumeric pgtype.Numeric
		if err := rows.Scan(&poID, &totalNumeric, &paidNumeric); err != nil {
			return nil, err
		}

		totalValue, ok := numericToFloat64(totalNumeric)
		if !ok {
			return nil, fmt.Errorf("invalid total_value numeric")
		}

		paidAmount, ok := numericToFloat64(paidNumeric)
		if !ok {
			return nil, fmt.Errorf("invalid paid_amount numeric")
		}

		out[poID] = paymentSummary{
			POID:          poID,
			TotalValue:    totalValue,
			PaidAmount:    paidAmount,
			DueAmount:     computeDueAmount(totalValue, paidAmount),
			PaymentStatus: derivePaymentStatus(totalValue, paidAmount),
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}
