package services

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists   = errors.New("user with this email already exists")
	ErrUserNotFoundByID    = errors.New("user not found")
	ErrInvalidUserPayload  = errors.New("invalid user payload")
	ErrRoleNotFound        = errors.New("role not found")
	ErrPasswordChangeError = errors.New("failed to change password")
	ErrForbidden           = errors.New("forbidden")
)

type UserCommandService struct {
	queries *db.Queries
}

func NewUserCommandService(pool *pgxpool.Pool) *UserCommandService {
	if pool == nil {
		return &UserCommandService{}
	}
	return &UserCommandService{queries: db.New(pool)}
}

func normalizeRoleCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeUserEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func mapCreatedUser(row db.CreateUserCommandRow, roleCode string) *models.UserCreateResult {
	return &models.UserCreateResult{
		ID:       uuidString(row.ID),
		Email:    row.Email,
		RoleCode: roleCode,
		IsActive: row.IsActive,
	}
}

func isDuplicateEmail(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23505" && (pgErr.ConstraintName == "users_email_key" || pgErr.ConstraintName == "users_email_lower_unique_idx")
}

func (s *UserCommandService) CreateUser(ctx context.Context, req models.CreateUserRequest) (*models.UserCreateResult, error) {
	if s == nil || s.queries == nil {
		return nil, ErrInvalidUserPayload
	}

	email := normalizeUserEmail(req.Email)
	roleCode := normalizeRoleCode(req.RoleCode)
	password := strings.TrimSpace(req.Password)
	if email == "" || roleCode == "" || len(password) < 8 {
		return nil, ErrInvalidUserPayload
	}

	role, err := s.queries.GetRoleByCode(ctx, roleCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRoleNotFound
		}
		return nil, err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	row, err := s.queries.CreateUserCommand(ctx, db.CreateUserCommandParams{
		Name:         strings.TrimSpace(email),
		Email:        email,
		PasswordHash: string(hashedPassword),
		RoleID:       role.ID,
	})
	if err != nil {
		if isDuplicateEmail(err) {
			return nil, ErrUserAlreadyExists
		}
		return nil, err
	}
	return mapCreatedUser(row, roleCode), nil
}

func (s *UserCommandService) UpdateUser(ctx context.Context, userID string, req models.UpdateUserRequest) error {
	if s == nil || s.queries == nil {
		return ErrInvalidUserPayload
	}
	id, ok := parseUUID(strings.TrimSpace(userID))
	if !ok {
		return ErrInvalidUserPayload
	}

	params := db.UpdateUserCommandParams{ID: id}
	if req.RoleCode != "" {
		roleCode := normalizeRoleCode(req.RoleCode)
		role, err := s.queries.GetRoleByCode(ctx, roleCode)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrRoleNotFound
			}
			return err
		}
		params.RoleID = role.ID
	}
	if req.IsActive != nil {
		params.IsActive = pgtype.Bool{Bool: *req.IsActive, Valid: true}
	}

	_, err := s.queries.UpdateUserCommand(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFoundByID
		}
		return err
	}
	return nil
}

func (s *UserCommandService) ChangePassword(ctx context.Context, userID string, req models.ChangePasswordRequest) error {
	if s == nil || s.queries == nil {
		return ErrPasswordChangeError
	}
	id, ok := parseUUID(strings.TrimSpace(userID))
	if !ok {
		return ErrInvalidUserPayload
	}
	if len(strings.TrimSpace(req.Password)) < 8 {
		return ErrInvalidUserPayload
	}

	_, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFoundByID
		}
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.queries.ChangeUserPasswordCommand(ctx, db.ChangeUserPasswordCommandParams{
		ID:           id,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		return err
	}
	return nil
}
