package services

import (
	"context"

	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ProcurementCommandService struct {
	core *ProcurementService
}

func NewProcurementCommandService(pool *pgxpool.Pool) *ProcurementCommandService {
	return &ProcurementCommandService{core: NewProcurementService(pool)}
}

func (s *ProcurementCommandService) CreatePurchaseOrder(ctx context.Context, req models.CreatePurchaseOrderRequest, createdBy string) (*CreatePurchaseOrderResult, error) {
	return s.core.CreatePurchaseOrder(ctx, req, createdBy)
}

func (s *ProcurementCommandService) ReceiveGoods(ctx context.Context, poID string, qty float64, performedBy string) (*ReceiveGoodsResult, error) {
	return s.core.ReceiveGoods(ctx, poID, qty, performedBy)
}

func (s *ProcurementCommandService) ReverseReceipt(ctx context.Context, poID string, batchIDs []string, reason string, performedBy string) (*ReverseReceiptResult, error) {
	return s.core.ReverseReceipt(ctx, poID, batchIDs, reason, performedBy)
}

func (s *ProcurementCommandService) CloseOrder(ctx context.Context, poID string, reason string, performedBy string) (*CloseOrderResult, error) {
	return s.core.CloseOrder(ctx, poID, reason, performedBy)
}

func (s *ProcurementCommandService) UpdatePurchaseOrder(ctx context.Context, poID string, req models.UpdatePurchaseOrderRequest, performedBy string) (*UpdatePurchaseOrderResult, error) {
	return s.core.UpdatePurchaseOrder(ctx, poID, req, performedBy)
}
