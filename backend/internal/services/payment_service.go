package services

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrCreatePaymentFailed      = errors.New("unable to create payment")
	ErrListPaymentsFailed       = errors.New("unable to list payments")
	ErrInvalidPaymentPayload    = errors.New("invalid payment payload")
	ErrPaymentPurchaseNotFound  = errors.New("purchase order not found")
	ErrPaymentCreatedByRequired = errors.New("payment created_by is required")
)

type PaymentService struct {
	pool *pgxpool.Pool
}

type PaymentRow struct {
	ID          string  `json:"id"`
	POID        string  `json:"po_id"`
	Amount      float64 `json:"amount"`
	PaymentDate string  `json:"payment_date"`
	Note        string  `json:"note,omitempty"`
	CreatedBy   string  `json:"created_by"`
	CreatedAt   string  `json:"created_at"`
}

type CreatePaymentResult struct {
	Payment PaymentRow     `json:"payment"`
	Summary paymentSummary `json:"summary"`
}

type PaymentListResult struct {
	Items   []PaymentRow    `json:"items"`
	Summary *paymentSummary `json:"summary,omitempty"`
}

func NewPaymentService(pool *pgxpool.Pool) *PaymentService {
	return &PaymentService{pool: pool}
}

func (s *PaymentService) CreatePayment(ctx context.Context, req models.CreatePaymentRequest, createdBy string) (*CreatePaymentResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrCreatePaymentFailed
	}

	poID, ok := parseUUID(strings.TrimSpace(req.POID))
	if !ok {
		return nil, ErrInvalidPaymentPayload
	}

	createdByID, ok := parseUUID(strings.TrimSpace(createdBy))
	if !ok {
		return nil, ErrPaymentCreatedByRequired
	}

	amount, ok := numericFromFloat(req.Amount)
	if !ok {
		return nil, ErrInvalidPaymentPayload
	}

	paymentDate, err := parsePaymentDate(req.PaymentDate)
	if err != nil {
		return nil, ErrInvalidPaymentPayload
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

	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM purchase_orders WHERE id = $1
		)
	`, poID).Scan(&exists); err != nil {
		return nil, fmt.Errorf("check purchase order existence: %w", err)
	}
	if !exists {
		return nil, ErrPaymentPurchaseNotFound
	}

	var paymentID pgtype.UUID
	var paymentDateOut pgtype.Timestamptz
	var noteOut pgtype.Text
	var createdAt pgtype.Timestamptz

	if err := tx.QueryRow(ctx, `
		INSERT INTO purchase_order_payments (
			po_id, amount, payment_date, note, created_by
		) VALUES (
			$1, $2, $3, $4, $5
		)
		RETURNING id, payment_date, note, created_at
	`, poID, amount, paymentDate, textOrNull(req.Note), createdByID).Scan(&paymentID, &paymentDateOut, &noteOut, &createdAt); err != nil {
		return nil, fmt.Errorf("insert payment: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	summary, err := loadPaymentSummaryForPO(ctx, s.pool, uuidString(poID))
	if err != nil {
		return nil, fmt.Errorf("load payment summary: %w", err)
	}

	if summary.PaidAmount > summary.TotalValue {
		slog.WarnContext(ctx, "purchase order overpaid",
			"po_id", uuidString(poID),
			"paid_amount", summary.PaidAmount,
			"total_value", summary.TotalValue,
			"overpaid_by", summary.PaidAmount-summary.TotalValue,
		)
	}

	return &CreatePaymentResult{
		Payment: PaymentRow{
			ID:          uuidString(paymentID),
			POID:        uuidString(poID),
			Amount:      req.Amount,
			PaymentDate: timestampValue(paymentDateOut),
			Note:        textValue(noteOut),
			CreatedBy:   uuidString(createdByID),
			CreatedAt:   timestampValue(createdAt),
		},
		Summary: summary,
	}, nil
}

func (s *PaymentService) ListPayments(ctx context.Context, filter models.PaymentListFilter) (*PaymentListResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrListPaymentsFailed
	}

	poID := strings.TrimSpace(filter.POID)
	query := `
		SELECT
			id,
			po_id,
			amount,
			payment_date,
			note,
			created_by,
			created_at
		FROM purchase_order_payments
	`
	args := make([]any, 0, 1)
	if poID != "" {
		if _, ok := parseUUID(poID); !ok {
			return nil, ErrInvalidPaymentPayload
		}
		query += ` WHERE po_id = $1::uuid `
		args = append(args, poID)
	}
	query += ` ORDER BY payment_date DESC, created_at DESC `

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, ErrListPaymentsFailed
	}
	defer rows.Close()

	items := make([]PaymentRow, 0)
	for rows.Next() {
		var id pgtype.UUID
		var rowPOID pgtype.UUID
		var amountNumeric pgtype.Numeric
		var paymentDate pgtype.Timestamptz
		var note pgtype.Text
		var createdBy pgtype.UUID
		var createdAt pgtype.Timestamptz

		if err := rows.Scan(&id, &rowPOID, &amountNumeric, &paymentDate, &note, &createdBy, &createdAt); err != nil {
			return nil, ErrListPaymentsFailed
		}

		amountValue, ok := numericToFloat64(amountNumeric)
		if !ok {
			return nil, ErrListPaymentsFailed
		}

		items = append(items, PaymentRow{
			ID:          uuidString(id),
			POID:        uuidString(rowPOID),
			Amount:      amountValue,
			PaymentDate: timestampValue(paymentDate),
			Note:        textValue(note),
			CreatedBy:   uuidString(createdBy),
			CreatedAt:   timestampValue(createdAt),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, ErrListPaymentsFailed
	}

	result := &PaymentListResult{Items: items}
	if poID != "" {
		summary, err := loadPaymentSummaryForPO(ctx, s.pool, poID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrPaymentPurchaseNotFound
			}
			return nil, ErrListPaymentsFailed
		}
		result.Summary = &summary
	}

	return result, nil
}

func parsePaymentDate(raw string) (pgtype.Timestamptz, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}, nil
	}

	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return pgtype.Timestamptz{Time: parsed.UTC(), Valid: true}, nil
	}

	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return pgtype.Timestamptz{}, err
	}
	return pgtype.Timestamptz{Time: parsed.UTC(), Valid: true}, nil
}
