package repository

import (
	"context"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvoiceRepository interface {
	AllocateNextDocumentNumber(ctx context.Context, documentType string) (db.AllocateNextDocumentNumberRow, error)
	CreateInvoice(ctx context.Context, arg db.CreateInvoiceParams) (db.Invoice, error)
	GetInvoice(ctx context.Context, id pgtype.UUID) (db.Invoice, error)
	GetInvoiceByOrder(ctx context.Context, orderID pgtype.UUID) (db.Invoice, error)
}

type invoiceRepository struct {
	q  *db.Queries
	db *pgxpool.Pool
}

func NewInvoiceRepository(pool *pgxpool.Pool) InvoiceRepository {
	return &invoiceRepository{
		q:  db.New(pool),
		db: pool,
	}
}

func (r *invoiceRepository) AllocateNextDocumentNumber(ctx context.Context, documentType string) (db.AllocateNextDocumentNumberRow, error) {
	return r.q.AllocateNextDocumentNumber(ctx, documentType)
}

func (r *invoiceRepository) CreateInvoice(ctx context.Context, arg db.CreateInvoiceParams) (db.Invoice, error) {
	return r.q.CreateInvoice(ctx, arg)
}

func (r *invoiceRepository) GetInvoice(ctx context.Context, id pgtype.UUID) (db.Invoice, error) {
	return r.q.GetInvoice(ctx, id)
}

func (r *invoiceRepository) GetInvoiceByOrder(ctx context.Context, orderID pgtype.UUID) (db.Invoice, error) {
	return r.q.GetInvoiceByOrder(ctx, orderID)
}
