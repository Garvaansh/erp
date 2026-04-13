package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/erp/backend/internal/models"
)

var (
	ErrVendorNotFound      = errors.New("vendor not found")
	ErrVendorAlreadyExists = errors.New("vendor with this name already exists")
	ErrCreateVendorFailed  = errors.New("unable to create vendor")
	ErrListVendorsFailed   = errors.New("unable to list vendors")
	ErrUpdateVendorFailed  = errors.New("unable to update vendor")
)

type VendorService struct {
	pool *pgxpool.Pool
}

func NewVendorService(pool *pgxpool.Pool) *VendorService {
	return &VendorService{pool: pool}
}

func (s *VendorService) ListVendors(ctx context.Context) ([]models.VendorListRow, error) {
	if s.pool == nil {
		return nil, ErrListVendorsFailed
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, name, COALESCE(contact_person,''), COALESCE(phone,''), COALESCE(email,''),
		       COALESCE(address,''), COALESCE(gstin,''), COALESCE(payment_terms,''),
		       is_active, created_at, updated_at
		FROM vendors
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, ErrListVendorsFailed
	}
	defer rows.Close()

	var out []models.VendorListRow
	for rows.Next() {
		var r models.VendorListRow
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&r.ID, &r.Name, &r.ContactPerson, &r.Phone, &r.Email,
			&r.Address, &r.GSTIN, &r.PaymentTerms, &r.IsActive, &createdAt, &updatedAt); err != nil {
			return nil, ErrListVendorsFailed
		}
		r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		r.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		out = append(out, r)
	}

	if out == nil {
		out = []models.VendorListRow{}
	}
	return out, nil
}

func (s *VendorService) CreateVendor(ctx context.Context, req models.CreateVendorRequest) (*models.VendorListRow, error) {
	if s.pool == nil {
		return nil, ErrCreateVendorFailed
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrCreateVendorFailed
	}

	var id string
	var createdAt, updatedAt time.Time
	err := s.pool.QueryRow(ctx, `
		INSERT INTO vendors (name, contact_person, phone, email, address, gstin, payment_terms)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`, name,
		strings.TrimSpace(req.ContactPerson),
		strings.TrimSpace(req.Phone),
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.Address),
		strings.TrimSpace(req.GSTIN),
		strings.TrimSpace(req.PaymentTerms),
	).Scan(&id, &createdAt, &updatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "idx_vendors_name_lower") {
			return nil, ErrVendorAlreadyExists
		}
		return nil, ErrCreateVendorFailed
	}

	return &models.VendorListRow{
		ID:            id,
		Name:          name,
		ContactPerson: strings.TrimSpace(req.ContactPerson),
		Phone:         strings.TrimSpace(req.Phone),
		Email:         strings.TrimSpace(req.Email),
		Address:       strings.TrimSpace(req.Address),
		GSTIN:         strings.TrimSpace(req.GSTIN),
		PaymentTerms:  strings.TrimSpace(req.PaymentTerms),
		IsActive:      true,
		CreatedAt:     createdAt.UTC().Format(time.RFC3339),
		UpdatedAt:     updatedAt.UTC().Format(time.RFC3339),
	}, nil
}

func (s *VendorService) UpdateVendor(ctx context.Context, vendorID string, req models.UpdateVendorRequest) error {
	if s.pool == nil {
		return ErrUpdateVendorFailed
	}

	vendorID = strings.TrimSpace(vendorID)
	if vendorID == "" {
		return ErrVendorNotFound
	}

	// Build dynamic SET clause
	setClauses := []string{}
	args := []any{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Name))
		argIdx++
	}
	if req.ContactPerson != nil {
		setClauses = append(setClauses, fmt.Sprintf("contact_person = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.ContactPerson))
		argIdx++
	}
	if req.Phone != nil {
		setClauses = append(setClauses, fmt.Sprintf("phone = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Phone))
		argIdx++
	}
	if req.Email != nil {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Email))
		argIdx++
	}
	if req.Address != nil {
		setClauses = append(setClauses, fmt.Sprintf("address = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Address))
		argIdx++
	}
	if req.GSTIN != nil {
		setClauses = append(setClauses, fmt.Sprintf("gstin = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.GSTIN))
		argIdx++
	}
	if req.PaymentTerms != nil {
		setClauses = append(setClauses, fmt.Sprintf("payment_terms = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.PaymentTerms))
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil // Nothing to update
	}

	query := fmt.Sprintf("UPDATE vendors SET %s WHERE id = $%d",
		strings.Join(setClauses, ", "), argIdx)
	args = append(args, vendorID)

	result, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		if strings.Contains(err.Error(), "idx_vendors_name_lower") {
			return ErrVendorAlreadyExists
		}
		return ErrUpdateVendorFailed
	}

	if result.RowsAffected() == 0 {
		return ErrVendorNotFound
	}
	return nil
}

func (s *VendorService) GetVendor(ctx context.Context, vendorID string) (*models.VendorListRow, error) {
	if s.pool == nil {
		return nil, ErrListVendorsFailed
	}

	var r models.VendorListRow
	var createdAt, updatedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(contact_person,''), COALESCE(phone,''), COALESCE(email,''),
		       COALESCE(address,''), COALESCE(gstin,''), COALESCE(payment_terms,''),
		       is_active, created_at, updated_at
		FROM vendors WHERE id = $1
	`, strings.TrimSpace(vendorID)).Scan(&r.ID, &r.Name, &r.ContactPerson, &r.Phone, &r.Email,
		&r.Address, &r.GSTIN, &r.PaymentTerms, &r.IsActive, &createdAt, &updatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVendorNotFound
		}
		return nil, ErrListVendorsFailed
	}

	r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	r.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return &r, nil
}
