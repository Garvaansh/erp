package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/erp/backend/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("user with this email already exists")
	ErrUserNotFoundByID   = errors.New("user not found")
	ErrInvalidUserPayload = errors.New("invalid user payload")
	ErrRoleNotFound       = errors.New("role not found")
)

type UserService struct {
	pool *pgxpool.Pool
}

func NewUserService(pool *pgxpool.Pool) *UserService {
	return &UserService{pool: pool}
}

func (s *UserService) ListUsers(ctx context.Context) ([]models.UserListRow, error) {
	query := `
		SELECT 
			u.id,
			u.name,
			u.email,
			r.code AS role_code,
			r.name AS role_name,
			u.is_active,
			u.is_admin,
			u.created_at,
			u.updated_at
		FROM users u
		JOIN roles r ON u.role_id = r.id
		ORDER BY u.created_at DESC
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []models.UserListRow
	for rows.Next() {
		var (
			row       models.UserListRow
			createdAt time.Time
			updatedAt time.Time
		)
		if err := rows.Scan(
			&row.ID,
			&row.Name,
			&row.Email,
			&row.RoleCode,
			&row.RoleName,
			&row.IsActive,
			&row.IsAdmin,
			&createdAt,
			&updatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}
		row.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		row.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		users = append(users, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user rows: %w", err)
	}

	if users == nil {
		users = []models.UserListRow{}
	}

	return users, nil
}

func (s *UserService) CreateUser(ctx context.Context, req models.CreateUserRequest) (*models.UserCreateResult, error) {
	// 1. Find role by code
	var roleID string
	err := s.pool.QueryRow(ctx, `SELECT id FROM roles WHERE code = $1 LIMIT 1`, req.RoleCode).Scan(&roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRoleNotFound
		}
		return nil, fmt.Errorf("failed to lookup role: %w", err)
	}

	// 2. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 3. Insert user
	var result models.UserCreateResult
	err = s.pool.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash, role_id, is_admin)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, name, email, is_admin`,
		req.Name, req.Email, string(hashedPassword), roleID, req.IsAdmin,
	).Scan(&result.ID, &result.Name, &result.Email, &result.IsAdmin)
	if err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrUserAlreadyExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	result.RoleCode = req.RoleCode
	return &result, nil
}

func (s *UserService) UpdateUser(ctx context.Context, userID string, req models.UpdateUserRequest) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Verify user exists
	var exists bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID).Scan(&exists)
	if err != nil || !exists {
		return ErrUserNotFoundByID
	}

	// Build dynamic update
	if req.Name != "" {
		_, err = tx.Exec(ctx, `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`, req.Name, userID)
		if err != nil {
			return fmt.Errorf("failed to update name: %w", err)
		}
	}

	if req.RoleCode != "" {
		var roleID string
		err = tx.QueryRow(ctx, `SELECT id FROM roles WHERE code = $1 LIMIT 1`, req.RoleCode).Scan(&roleID)
		if err != nil {
			return ErrRoleNotFound
		}
		_, err = tx.Exec(ctx, `UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2`, roleID, userID)
		if err != nil {
			return fmt.Errorf("failed to update role: %w", err)
		}
	}

	if req.IsActive != nil {
		_, err = tx.Exec(ctx, `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, *req.IsActive, userID)
		if err != nil {
			return fmt.Errorf("failed to update is_active: %w", err)
		}
	}

	if req.IsAdmin != nil {
		_, err = tx.Exec(ctx, `UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2`, *req.IsAdmin, userID)
		if err != nil {
			return fmt.Errorf("failed to update is_admin: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (s *UserService) CountUsers(ctx context.Context) (int64, error) {
	var count int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&count)
	return count, err
}

func isDuplicateKeyError(err error) bool {
	return err != nil && (errors.Is(err, pgx.ErrNoRows) == false) &&
		(fmt.Sprintf("%v", err) != "" && containsDuplicateKey(fmt.Sprintf("%v", err)))
}

func containsDuplicateKey(s string) bool {
	return len(s) > 0 && (contains(s, "duplicate key") || contains(s, "unique constraint") || contains(s, "SQLSTATE 23505"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
