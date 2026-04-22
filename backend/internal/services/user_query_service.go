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

var ErrInvalidUserFilter = errors.New("invalid user filter")

type UserQueryService struct {
	queries *db.Queries
}

func NewUserQueryService(pool *pgxpool.Pool) *UserQueryService {
	if pool == nil {
		return &UserQueryService{}
	}
	return &UserQueryService{queries: db.New(pool)}
}

func normalizeUserFilter(value string) (string, error) {
	filter := strings.ToLower(strings.TrimSpace(value))
	if filter == "" {
		return "active", nil
	}
	switch filter {
	case "all", "active", "archived":
		return filter, nil
	default:
		return "", ErrInvalidUserFilter
	}
}

func mapUserList(row db.ListUsersRow) models.UserListRow {
	return models.UserListRow{
		ID:        uuidString(row.ID),
		Name:      row.Name,
		Email:     row.Email,
		RoleCode:  row.RoleCode,
		RoleName:  row.RoleName,
		IsActive:  row.IsActive,
		CreatedAt: timestampValue(row.CreatedAt),
		UpdatedAt: timestampValue(row.UpdatedAt),
	}
}

func mapSafeUserProfile(row db.GetUserByIDRow) *models.UserSafeProfile {
	return &models.UserSafeProfile{
		ID:        uuidString(row.ID),
		Name:      row.Name,
		Email:     row.Email,
		RoleCode:  row.RoleCode,
		RoleName:  row.RoleName,
		IsActive:  row.IsActive,
		CreatedAt: timestampValue(row.CreatedAt),
		UpdatedAt: timestampValue(row.UpdatedAt),
	}
}

func (s *UserQueryService) ListUsers(ctx context.Context, filter string, search string) ([]models.UserListRow, error) {
	if s == nil || s.queries == nil {
		return nil, ErrInvalidUserPayload
	}

	normalizedFilter, err := normalizeUserFilter(filter)
	if err != nil {
		return nil, err
	}

	params := db.ListUsersParams{Filter: normalizedFilter}
	if strings.TrimSpace(search) != "" {
		params.Search = pgtype.Text{String: strings.TrimSpace(search), Valid: true}
	}

	rows, err := s.queries.ListUsers(ctx, params)
	if err != nil {
		return nil, err
	}

	out := make([]models.UserListRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, mapUserList(row))
	}
	return out, nil
}

func (s *UserQueryService) GetUserByID(ctx context.Context, userID string, requesterID string, requesterRoleCode string) (*models.UserSafeProfile, error) {
	if s == nil || s.queries == nil {
		return nil, ErrInvalidUserPayload
	}
	id, ok := parseUUID(strings.TrimSpace(userID))
	if !ok {
		return nil, ErrInvalidUserPayload
	}

	if strings.ToUpper(strings.TrimSpace(requesterRoleCode)) != "ADMIN" && strings.TrimSpace(requesterID) != strings.TrimSpace(userID) {
		return nil, ErrForbidden
	}

	row, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFoundByID
		}
		return nil, err
	}
	return mapSafeUserProfile(row), nil
}
