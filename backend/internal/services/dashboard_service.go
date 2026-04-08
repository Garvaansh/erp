package services

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5/pgtype"
)

var ErrGetDashboardSummaryFailed = errors.New("unable to get dashboard summary")

type DashboardService struct {
	queries *db.Queries
}

func NewDashboardService(queries *db.Queries) *DashboardService {
	return &DashboardService{queries: queries}
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

	return &models.DashboardSummaryDTO{
		TotalRawMaterialWeight:   rawValue,
		TotalFinishedPipesWeight: finishedValue,
		RecentActivity:           recentActivity,
	}, nil
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
