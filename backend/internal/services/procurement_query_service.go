package services

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProcurementQueryService struct {
	core *ProcurementService
}

func NewProcurementQueryService(pool *pgxpool.Pool) *ProcurementQueryService {
	return &ProcurementQueryService{core: NewProcurementService(pool)}
}

func (s *ProcurementQueryService) ListProcurement(ctx context.Context, limit, offset int32) ([]ProcurementListRow, error) {
	return s.core.ListProcurement(ctx, limit, offset)
}

func (s *ProcurementQueryService) ListProcurementBatches(ctx context.Context, poID string) ([]ProcurementBatchRow, error) {
	return s.core.ListProcurementBatches(ctx, poID)
}

func (s *ProcurementQueryService) GetProcurementDetail(ctx context.Context, poID string) (*ProcurementDetail, error) {
	return s.core.GetProcurementDetail(ctx, poID)
}
