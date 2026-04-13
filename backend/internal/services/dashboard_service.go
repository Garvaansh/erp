package services

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrGetDashboardSummaryFailed = errors.New("unable to get dashboard summary")

type DashboardService struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

func NewDashboardService(queries *db.Queries, pool *pgxpool.Pool) *DashboardService {
	return &DashboardService{queries: queries, pool: pool}
}

func (s *DashboardService) GetSummary(ctx context.Context) (*models.DashboardSummaryDTO, error) {
	if s == nil || s.queries == nil {
		return nil, ErrGetDashboardSummaryFailed
	}

	rawWeight, err := s.queries.GetTotalRawMaterialWeight(ctx)
	if err != nil {
		return nil, ErrGetDashboardSummaryFailed
	}

	finishedWeight, err := s.queries.GetTotalFinishedPipesWeight(ctx)
	if err != nil {
		return nil, ErrGetDashboardSummaryFailed
	}

	recentRows, err := s.queries.GetRecentActivity(ctx)
	if err != nil {
		return nil, ErrGetDashboardSummaryFailed
	}

	rawValue, ok := numericToFloat64Value(rawWeight)
	if !ok {
		return nil, ErrGetDashboardSummaryFailed
	}
	finishedValue, ok := numericToFloat64Value(finishedWeight)
	if !ok {
		return nil, ErrGetDashboardSummaryFailed
	}

	recentActivity := make([]models.DashboardRecentActivityDTO, 0, len(recentRows))
	for _, row := range recentRows {
		inputQty, ok := numericToFloat64Value(row.InputQty)
		if !ok {
			return nil, ErrGetDashboardSummaryFailed
		}
		finishedQty, ok := numericToFloat64Value(row.FinishedQty)
		if !ok {
			return nil, ErrGetDashboardSummaryFailed
		}
		scrapQty, ok := numericToFloat64Value(row.ScrapQty)
		if !ok {
			return nil, ErrGetDashboardSummaryFailed
		}

		recentActivity = append(recentActivity, models.DashboardRecentActivityDTO{
			JournalID:   uuidString(row.ID),
			CreatedAt:   timestampToRFC3339(row.CreatedAt),
			WorkerName:  row.WorkerName,
			SourceBatch: row.BatchCode,
			InputQty:    inputQty,
			FinishedQty: finishedQty,
			ScrapQty:    scrapQty,
		})
	}

	// Enhanced: Pending PO count
	pendingPOCount := s.getPendingPOCount(ctx)

	// Enhanced: Total active users
	totalActiveUsers := s.getTotalActiveUsers(ctx)

	// Enhanced: Total items (SKUs)
	totalItemsSKU := s.getTotalItemsSKU(ctx)

	// Phase B: Low stock count
	lowStockCount := s.getLowStockCount(ctx)

	// Phase B: Total vendors
	totalVendors := s.getTotalVendors(ctx)

	return &models.DashboardSummaryDTO{
		TotalRawMaterialWeight:   rawValue,
		TotalFinishedPipesWeight: finishedValue,
		PendingPOCount:           pendingPOCount,
		TotalActiveUsers:         totalActiveUsers,
		TotalItemsSKU:            totalItemsSKU,
		LowStockCount:            lowStockCount,
		TotalVendors:             totalVendors,
		RecentActivity:           recentActivity,
	}, nil
}

func (s *DashboardService) getPendingPOCount(ctx context.Context) int64 {
	if s.pool == nil {
		return 0
	}
	var count int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM purchase_orders WHERE status = 'PENDING'`).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (s *DashboardService) getTotalActiveUsers(ctx context.Context) int64 {
	if s.pool == nil {
		return 0
	}
	var count int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (s *DashboardService) getTotalItemsSKU(ctx context.Context) int64 {
	if s.pool == nil {
		return 0
	}
	var count int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM items WHERE is_active = true`).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (s *DashboardService) getLowStockCount(ctx context.Context) int64 {
	if s.pool == nil {
		return 0
	}
	var count int64
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT i.id
			FROM items i
			LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.status IN ('NEW','ACTIVE')
			WHERE i.is_active = true AND i.min_qty > 0
			GROUP BY i.id, i.min_qty
			HAVING COALESCE(SUM(b.remaining_qty), 0) < i.min_qty
		) sub
	`).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (s *DashboardService) getTotalVendors(ctx context.Context) int64 {
	if s.pool == nil {
		return 0
	}
	var count int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM vendors WHERE is_active = true`).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func numericToFloat64Value(value pgtype.Numeric) (float64, bool) {
	floatValue, err := value.Float64Value()
	if err != nil || !floatValue.Valid {
		return 0, false
	}
	if math.IsNaN(floatValue.Float64) || math.IsInf(floatValue.Float64, 0) {
		return 0, false
	}

	return floatValue.Float64, true
}

func timestampToRFC3339(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}
