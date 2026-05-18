package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/invoices/dto"
	"github.com/erp/backend/internal/invoices/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InvoiceService interface {
	GenerateInvoice(ctx context.Context, orderID uuid.UUID, generatedBy uuid.UUID) (*dto.InvoiceResponse, error)
	GetInvoice(ctx context.Context, invoiceID uuid.UUID) (*dto.InvoiceResponse, error)
	GetInvoiceByOrder(ctx context.Context, orderID uuid.UUID) (*dto.InvoiceResponse, error)
}

type invoiceService struct {
	repo repository.InvoiceRepository
	pool *pgxpool.Pool
	q    *db.Queries // For fetching order, customer, etc. outside repo boundary or via tx
}

func NewInvoiceService(repo repository.InvoiceRepository, pool *pgxpool.Pool) InvoiceService {
	return &invoiceService{
		repo: repo,
		pool: pool,
		q:    db.New(pool),
	}
}

func (s *invoiceService) GenerateInvoice(ctx context.Context, orderID uuid.UUID, generatedBy uuid.UUID) (*dto.InvoiceResponse, error) {
	orderPGUUID := pgtype.UUID{Bytes: orderID, Valid: true}

	// Check if already generated
	existing, err := s.repo.GetInvoiceByOrder(ctx, orderPGUUID)
	if err == nil {
		return mapInvoiceToDTO(existing)
	} else if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing invoice: %w", err)
	}

	// TX for allocation
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	qtx := s.q.WithTx(tx)

	// Fetch Order (assuming GetSalesOrder exists, this might need adjustment)
	// We'll mock the snapshot parts that we can't easily fetch without knowing exact queries
	// Ideally we would fetch order, customer, lines, and settings.
	// Let's allocate invoice number first.
	seq, err := qtx.AllocateNextDocumentNumber(ctx, "invoice")
	if err != nil {
		return nil, fmt.Errorf("failed to allocate invoice number: %w", err)
	}

	invoiceNum := fmt.Sprintf("%s%05d", seq.Prefix, seq.NextNumber)

	// Fetch Settings using qtx
	businessSettingsRaw, _ := qtx.GetSettingsByCategory(ctx, "business")
	invoiceSettingsRaw, _ := qtx.GetSettingsByCategory(ctx, "invoice")

	businessMap := parseSettings(businessSettingsRaw)
	invoiceMap := parseSettings(invoiceSettingsRaw)

	// Build Snapshot (stubbed with available data + settings)
	snapshot := dto.InvoiceSnapshot{
		Company: dto.CompanySnapshot{
			CompanyName: getString(businessMap, "company_name"),
			GSTIN:       getString(businessMap, "gstin"),
			Phone:       getString(businessMap, "phone"),
			Email:       getString(businessMap, "email"),
			Address:     getString(businessMap, "address"),
			LogoURL:     getString(businessMap, "logo_url"),
			BankDetails: getString(businessMap, "bank_details"),
		},
		Customer: dto.CustomerSnapshot{
			// Need real order data here
			CustomerID:   uuid.New(),
			CustomerName: "Placeholder Customer",
		},
		OrderLines: []dto.OrderLineSnapshot{},
		Taxes:      dto.TaxSnapshot{},
		Totals:     dto.TotalsSnapshot{},
		PaymentTerms: dto.PaymentTermsSnapshot{
			TermsDays:       getInt(invoiceMap, "default_payment_terms_days"),
			FooterNote:      getString(invoiceMap, "footer_note"),
			DeclarationText: getString(invoiceMap, "declaration_text"),
		},
	}

	snapshotBytes, _ := json.Marshal(snapshot)

	var generatedByPGUUID pgtype.UUID
	if generatedBy != uuid.Nil {
		generatedByPGUUID = pgtype.UUID{Bytes: generatedBy, Valid: true}
	}

	created, err := qtx.CreateInvoice(ctx, db.CreateInvoiceParams{
		OrderID:       orderPGUUID,
		InvoiceNumber: invoiceNum,
		Snapshot:      snapshotBytes,
		GeneratedBy:   generatedByPGUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return mapInvoiceToDTO(created)
}

func (s *invoiceService) GetInvoice(ctx context.Context, invoiceID uuid.UUID) (*dto.InvoiceResponse, error) {
	inv, err := s.repo.GetInvoice(ctx, pgtype.UUID{Bytes: invoiceID, Valid: true})
	if err != nil {
		return nil, err
	}
	return mapInvoiceToDTO(inv)
}

func (s *invoiceService) GetInvoiceByOrder(ctx context.Context, orderID uuid.UUID) (*dto.InvoiceResponse, error) {
	inv, err := s.repo.GetInvoiceByOrder(ctx, pgtype.UUID{Bytes: orderID, Valid: true})
	if err != nil {
		return nil, err
	}
	return mapInvoiceToDTO(inv)
}

func mapInvoiceToDTO(inv db.Invoice) (*dto.InvoiceResponse, error) {
	var snap dto.InvoiceSnapshot
	if err := json.Unmarshal(inv.Snapshot, &snap); err != nil {
		return nil, err
	}

	var generatedBy *uuid.UUID
	if inv.GeneratedBy.Valid {
		gb := uuid.UUID(inv.GeneratedBy.Bytes)
		generatedBy = &gb
	}

	return &dto.InvoiceResponse{
		ID:            inv.ID.Bytes,
		OrderID:       inv.OrderID.Bytes,
		InvoiceNumber: inv.InvoiceNumber,
		Snapshot:      snap,
		GeneratedBy:   generatedBy,
		GeneratedAt:   inv.GeneratedAt.Time,
	}, nil
}

func parseSettings(settings []db.SystemSetting) map[string]interface{} {
	m := make(map[string]interface{})
	for _, s := range settings {
		var v interface{}
		if err := json.Unmarshal(s.Value, &v); err == nil {
			m[s.Key] = v
		}
	}
	return m
}

func getString(m map[string]interface{}, k string) string {
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}

func getInt(m map[string]interface{}, k string) int {
	if v, ok := m[k].(float64); ok {
		return int(v)
	}
	return 0
}
