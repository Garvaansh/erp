package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrStockAdjustmentFailed  = errors.New("unable to perform stock adjustment")
	ErrInvalidAdjustDirection = errors.New("direction must be IN or OUT")
	ErrGetLowStockFailed      = errors.New("unable to get low stock alerts")
)

type StockAdjustmentService struct {
	pool *pgxpool.Pool
}

func NewStockAdjustmentService(pool *pgxpool.Pool) *StockAdjustmentService {
	return &StockAdjustmentService{pool: pool}
}

func (s *StockAdjustmentService) AdjustStock(ctx context.Context, req models.StockAdjustmentRequest, performedBy string) error {
	if s.pool == nil {
		return ErrStockAdjustmentFailed
	}

	itemID, ok := parseUUID(req.ItemID)
	if !ok {
		return ErrInvalidInventoryPayload
	}

	batchID, ok := parseUUID(req.BatchID)
	if !ok {
		return ErrInvalidInventoryPayload
	}

	performedByID, ok := parseUUID(performedBy)
	if !ok {
		return ErrInvalidInventoryPayload
	}

	qty, ok := numericFromFloat(req.Quantity)
	if !ok {
		return ErrInvalidInventoryPayload
	}

	var direction db.TxDirection
	switch strings.ToUpper(strings.TrimSpace(req.Direction)) {
	case "IN":
		direction = db.TxDirectionIN
	case "OUT":
		direction = db.TxDirectionOUT
	default:
		return ErrInvalidAdjustDirection
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)

	// Update batch remaining qty
	if direction == db.TxDirectionIN {
		_, err = tx.Exec(ctx,
			`UPDATE inventory_batches SET remaining_qty = remaining_qty + $1, updated_at = NOW() WHERE id = $2`,
			req.Quantity, req.BatchID)
	} else {
		_, err = tx.Exec(ctx,
			`UPDATE inventory_batches SET remaining_qty = GREATEST(remaining_qty - $1, 0), updated_at = NOW() WHERE id = $2`,
			req.Quantity, req.BatchID)
	}
	if err != nil {
		return fmt.Errorf("update batch qty: %w", err)
	}

	// Record inventory transaction
	movementGroup := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroup), Valid: true}

	_, err = qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          itemID,
		BatchID:         batchID,
		Direction:       direction,
		Quantity:        qty,
		ReferenceType:   string(db.TxReferenceTypeADJUSTMENT),
		ReferenceID:     movementGroupID,
		PerformedBy:     performedByID,
		Notes:           pgtype.Text{String: strings.TrimSpace(req.Reason), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("record adjustment tx: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	committed = true
	return nil
}

func (s *StockAdjustmentService) GetLowStockAlerts(ctx context.Context) ([]models.LowStockAlertRow, error) {
	if s.pool == nil {
		return nil, ErrGetLowStockFailed
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			i.id, COALESCE(i.sku,''), i.name, i.category::text,
			COALESCE(SUM(b.remaining_qty), 0) AS current_qty,
			i.min_qty, i.max_qty
		FROM items i
		LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.status IN ('NEW','ACTIVE')
		WHERE i.is_active = true AND i.min_qty > 0
		GROUP BY i.id, i.sku, i.name, i.category, i.min_qty, i.max_qty
		HAVING COALESCE(SUM(b.remaining_qty), 0) < i.min_qty
		ORDER BY (i.min_qty - COALESCE(SUM(b.remaining_qty), 0)) DESC
	`)
	if err != nil {
		return nil, ErrGetLowStockFailed
	}
	defer rows.Close()

	var out []models.LowStockAlertRow
	for rows.Next() {
		var r models.LowStockAlertRow
		if err := rows.Scan(&r.ItemID, &r.SKU, &r.Name, &r.Category,
			&r.CurrentQty, &r.MinQty, &r.MaxQty); err != nil {
			return nil, ErrGetLowStockFailed
		}
		r.DeficitQty = r.MinQty - r.CurrentQty
		out = append(out, r)
	}

	if out == nil {
		out = []models.LowStockAlertRow{}
	}
	return out, nil
}
