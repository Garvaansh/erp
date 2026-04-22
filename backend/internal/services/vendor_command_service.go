package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrCreateVendorFailed      = errors.New("unable to create vendor")
	ErrUpdateVendorFailed      = errors.New("unable to update vendor")
	ErrVendorNotFound          = errors.New("vendor not found")
	ErrVendorCodeExists        = errors.New("vendor code already exists")
	ErrVendorCodeImmutable     = errors.New("vendor code is immutable")
	ErrInvalidVendorPayload    = errors.New("invalid vendor payload")
	ErrInvalidVendorIdentifier = errors.New("invalid vendor identifier")
)

type VendorCommandService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewVendorCommandService(pool *pgxpool.Pool) *VendorCommandService {
	if pool == nil {
		return &VendorCommandService{}
	}
	return &VendorCommandService{pool: pool, queries: db.New(pool)}
}

func (s *VendorCommandService) CreateVendor(ctx context.Context, req models.CreateVendorCommandRequest) (*models.VendorReadModel, error) {
	if s == nil || s.queries == nil {
		return nil, ErrCreateVendorFailed
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrInvalidVendorPayload
	}

	baseCode := buildBaseVendorCode(req.Code, name)
	if baseCode == "" {
		return nil, ErrInvalidVendorPayload
	}

	var row db.Vendor
	var err error
	for attempts := 0; attempts < 3; attempts++ {
		code, resolveErr := s.resolveUniqueVendorCode(ctx, baseCode)
		if resolveErr != nil {
			return nil, ErrCreateVendorFailed
		}

		row, err = s.queries.CreateVendor(ctx, db.CreateVendorParams{
			Name:          name,
			VendorCode:    code,
			ContactPerson: textOrNull(req.ContactPerson),
			Phone:         textOrNull(req.Phone),
			Email:         textOrNull(req.Email),
			Gstin:         textOrNull(req.GSTIN),
			Notes:         textOrNull(req.Notes),
		})
		if err == nil {
			vendor := mapVendorReadModel(row)
			return &vendor, nil
		}
		if !isVendorCodeConflict(err) {
			return nil, ErrCreateVendorFailed
		}
	}

	return nil, ErrVendorCodeExists
}

func (s *VendorCommandService) UpdateVendor(ctx context.Context, id string, req models.UpdateVendorCommandRequest) (*models.VendorReadModel, error) {
	if req.Code != nil {
		return nil, ErrVendorCodeImmutable
	}
	if s == nil || s.queries == nil {
		return nil, ErrUpdateVendorFailed
	}

	vendorID, ok := parseUUID(strings.TrimSpace(id))
	if !ok {
		return nil, ErrInvalidVendorIdentifier
	}

	params := db.UpdateVendorMutableFieldsParams{ID: vendorID}
	if req.Name != nil {
		params.Name = textOrNull(*req.Name)
	}
	if req.ContactPerson != nil {
		params.ContactPerson = textOrNull(*req.ContactPerson)
	}
	if req.Phone != nil {
		params.Phone = textOrNull(*req.Phone)
	}
	if req.Email != nil {
		params.Email = textOrNull(*req.Email)
	}
	if req.GSTIN != nil {
		params.Gstin = textOrNull(*req.GSTIN)
	}
	if req.Notes != nil {
		params.Notes = textOrNull(*req.Notes)
	}
	if req.IsActive != nil {
		params.IsActive = pgtype.Bool{Bool: *req.IsActive, Valid: true}
	}

	row, err := s.queries.UpdateVendorMutableFields(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVendorNotFound
		}
		if isVendorCodeConflict(err) {
			return nil, ErrVendorCodeExists
		}
		return nil, ErrUpdateVendorFailed
	}

	vendor := mapVendorReadModel(row)
	return &vendor, nil
}

func isVendorCodeConflict(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	if pgErr.Code != "23505" {
		return false
	}
	return pgErr.ConstraintName == "idx_vendors_vendor_code" || pgErr.ConstraintName == "vendors_vendor_code_key"
}

func buildBaseVendorCode(rawCode string, name string) string {
	sanitized := sanitizeVendorCode(rawCode)
	if sanitized == "" {
		sanitized = sanitizeVendorCode(name)
	}
	if sanitized == "" {
		sanitized = "VENDR"
	}
	if len(sanitized) < 3 {
		sanitized = sanitized + strings.Repeat("X", 3-len(sanitized))
	}
	if len(sanitized) > 5 {
		sanitized = sanitized[:5]
	}
	return sanitized
}

func sanitizeVendorCode(value string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(value))
	if trimmed == "" {
		return ""
	}
	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, char := range trimmed {
		if char >= 'A' && char <= 'Z' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

func (s *VendorCommandService) resolveUniqueVendorCode(ctx context.Context, base string) (string, error) {
	for suffix := 0; suffix < 1000; suffix++ {
		candidate := base
		if suffix > 0 {
			sfx := fmt.Sprintf("%d", suffix)
			maxBaseLength := 8 - len(sfx)
			if maxBaseLength < 1 {
				maxBaseLength = 1
			}
			if len(base) > maxBaseLength {
				candidate = base[:maxBaseLength] + sfx
			} else {
				candidate = base + sfx
			}
		}
		var exists bool
		if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM vendors WHERE vendor_code = $1)`, candidate).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", errors.New("unable to resolve unique vendor code")
}
