package services

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrListVendorsFailed      = errors.New("unable to list vendors")
	ErrGetVendorProfileFailed = errors.New("unable to get vendor profile")
	ErrInvalidVendorFilter    = errors.New("invalid vendor filter")
)

type VendorQueryService struct {
	queries *db.Queries
}

func NewVendorQueryService(pool *pgxpool.Pool) *VendorQueryService {
	if pool == nil {
		return &VendorQueryService{}
	}
	return &VendorQueryService{queries: db.New(pool)}
}

func (s *VendorQueryService) ListVendors(ctx context.Context, filter string, search string) ([]models.VendorReadModel, error) {
	if s == nil || s.queries == nil {
		return nil, ErrListVendorsFailed
	}

	normalizedFilter, err := normalizeVendorFilter(filter)
	if err != nil {
		return nil, err
	}

	params := db.ListVendorsParams{Filter: normalizedFilter}
	trimmedSearch := strings.TrimSpace(search)
	if trimmedSearch != "" {
		params.Search = pgtype.Text{String: trimmedSearch, Valid: true}
	}

	rows, err := s.queries.ListVendors(ctx, params)
	if err != nil {
		return nil, ErrListVendorsFailed
	}

	result := make([]models.VendorReadModel, 0, len(rows))
	for _, row := range rows {
		result = append(result, mapVendorReadModel(row))
	}
	return result, nil
}

func (s *VendorQueryService) GetVendorProfile(ctx context.Context, id string) (*models.VendorProfileResponse, error) {
	if s == nil || s.queries == nil {
		return nil, ErrGetVendorProfileFailed
	}

	vendorID, ok := parseUUID(strings.TrimSpace(id))
	if !ok {
		return nil, ErrInvalidVendorIdentifier
	}

	vendorRow, err := s.queries.GetVendorByID(ctx, vendorID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVendorNotFound
		}
		return nil, ErrGetVendorProfileFailed
	}

	summaryRow, err := s.queries.GetVendorFinancialSummary(ctx, vendorID)
	if err != nil {
		return nil, ErrGetVendorProfileFailed
	}

	poRows, err := s.queries.GetVendorRecentPOs(ctx, vendorID)
	if err != nil {
		return nil, ErrGetVendorProfileFailed
	}

	paymentRows, err := s.queries.GetVendorRecentPayments(ctx, vendorID)
	if err != nil {
		return nil, ErrGetVendorProfileFailed
	}

	totalPurchased, ok := numericToFloat64(summaryRow.TotalPurchased)
	if !ok {
		return nil, ErrGetVendorProfileFailed
	}
	totalPaid, ok := numericToFloat64(summaryRow.TotalPaid)
	if !ok {
		return nil, ErrGetVendorProfileFailed
	}
	totalDue, ok := numericToFloat64(summaryRow.TotalDue)
	if !ok {
		return nil, ErrGetVendorProfileFailed
	}

	recentPOs := make([]models.VendorProfilePO, 0, len(poRows))
	for _, row := range poRows {
		recentPOs = append(recentPOs, models.VendorProfilePO{
			ID:        uuidString(row.ID),
			PONumber:  row.PoNumber,
			CreatedAt: timestampValue(row.CreatedAt),
		})
	}

	recentPayments := make([]models.VendorProfilePayment, 0, len(paymentRows))
	for _, row := range paymentRows {
		amount, ok := numericToFloat64(row.Amount)
		if !ok {
			return nil, ErrGetVendorProfileFailed
		}
		recentPayments = append(recentPayments, models.VendorProfilePayment{
			TransactionID: row.TransactionID,
			Amount:        amount,
			PaymentDate:   timestampValue(row.PaymentDate),
			PONumber:      row.PoNumber,
		})
	}

	vendor := mapVendorReadModel(vendorRow)
	return &models.VendorProfileResponse{
		Vendor: vendor,
		Summary: models.VendorProfileSummary{
			TotalPurchased: totalPurchased,
			TotalPaid:      totalPaid,
			TotalDue:       totalDue,
		},
		RecentPOs:      recentPOs,
		RecentPayments: recentPayments,
	}, nil
}

func normalizeVendorFilter(filter string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(filter))
	if normalized == "" {
		return "active", nil
	}
	switch normalized {
	case "active", "archived", "all":
		return normalized, nil
	default:
		return "", ErrInvalidVendorFilter
	}
}

func mapVendorReadModel(row db.Vendor) models.VendorReadModel {
	return models.VendorReadModel{
		ID:            uuidString(row.ID),
		Name:          strings.TrimSpace(row.Name),
		Code:          normalizeVendorCodeToken(row.VendorCode),
		ContactPerson: textValue(row.ContactPerson),
		Phone:         textValue(row.Phone),
		Email:         textValue(row.Email),
		GSTIN:         textValue(row.Gstin),
		IsActive:      row.IsActive,
		Notes:         textValue(row.Notes),
		CreatedAt:     timestampValue(row.CreatedAt),
		UpdatedAt:     timestampValue(row.UpdatedAt),
	}
}
