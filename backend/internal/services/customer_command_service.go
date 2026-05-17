package services

import (
	"context"
	"errors"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CustomerCommandService struct {
	pool     *pgxpool.Pool
	resolver *CustomerResolutionService
}

func NewCustomerCommandService(pool *pgxpool.Pool) *CustomerCommandService {
	if pool == nil {
		return &CustomerCommandService{}
	}
	return &CustomerCommandService{
		pool:     pool,
		resolver: NewCustomerResolutionService(),
	}
}

func (s *CustomerCommandService) CreateCustomer(ctx context.Context, req models.CreateCustomerRequest) (*models.CustomerCreateResponse, error) {
	if s == nil || s.pool == nil || s.resolver == nil {
		return nil, ErrCreateCustomerFailed
	}

	input, err := normalizeCustomerCreateRequest(req)
	if err != nil {
		return nil, err
	}

	for attempt := 0; attempt < 2; attempt++ {
		response, retry, err := s.createCustomerAttempt(ctx, input)
		if err != nil {
			return nil, err
		}
		if retry {
			continue
		}
		return response, nil
	}

	return nil, ErrCreateCustomerFailed
}

func (s *CustomerCommandService) createCustomerAttempt(ctx context.Context, input normalizedCustomerIdentityInput) (*models.CustomerCreateResponse, bool, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, false, ErrCreateCustomerFailed
	}
	defer tx.Rollback(ctx)

	queries := db.New(tx)
	resolution, err := s.resolver.ResolveCustomerIdentity(ctx, queries, input)
	if err != nil {
		return nil, false, ErrCreateCustomerFailed
	}

	switch resolution.Outcome {
	case customerResolutionExactExisting:
		if resolution.Customer == nil {
			return nil, false, ErrCreateCustomerFailed
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, false, ErrCreateCustomerFailed
		}
		customer := buildCustomerReadModel(*resolution.Customer)
		return &models.CustomerCreateResponse{
			Resolution: customerResolutionExactExisting,
			Customer:   &customer,
			Matches:    matchesToSearchResults(resolution.Matches),
		}, false, nil
	case customerResolutionProbable:
		if err := tx.Commit(ctx); err != nil {
			return nil, false, ErrCreateCustomerFailed
		}
		return &models.CustomerCreateResponse{
			Resolution: customerResolutionProbable,
			Matches:    matchesToSearchResults(resolution.Matches),
		}, false, nil
	}

	row, err := queries.InsertCustomer(ctx, db.InsertCustomerParams{
		DisplayName:        input.DisplayName,
		NormalizedName:     input.NormalizedName,
		PhoneNumber:        textOrNull(input.PhoneNumber),
		NormalizedPhone:    textOrNull(input.NormalizedPhone),
		WhatsappNumber:     textOrNull(input.WhatsAppNumber),
		NormalizedWhatsapp: textOrNull(input.NormalizedWhatsApp),
		Email:              textOrNull(input.Email),
		GstNumber:          textOrNull(input.GSTNumber),
		NormalizedGst:      textOrNull(input.NormalizedGST),
		CompanyName:        textOrNull(input.CompanyName),
		Notes:              textOrNull(input.Notes),
	})
	if err != nil {
		if isCustomerIdentityConflict(err) {
			return nil, true, nil
		}
		return nil, false, ErrCreateCustomerFailed
	}

	for _, alias := range input.Aliases {
		if err := queries.InsertCustomerAlias(ctx, db.InsertCustomerAliasParams{
			CustomerID:      row.ID,
			Alias:           alias.Raw,
			NormalizedAlias: alias.Normalized,
		}); err != nil {
			return nil, false, ErrCreateCustomerFailed
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, false, ErrCreateCustomerFailed
	}

	customer := buildCustomerReadModel(row)
	return &models.CustomerCreateResponse{
		Resolution: customerResolutionCreateNew,
		Customer:   &customer,
	}, false, nil
}

func isCustomerIdentityConflict(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	if pgErr.Code != "23505" {
		return false
	}

	switch pgErr.ConstraintName {
	case "idx_customers_normalized_phone_unique", "idx_customers_normalized_whatsapp_unique", "idx_customers_normalized_gst_unique":
		return true
	default:
		return false
	}
}
