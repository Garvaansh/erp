package auth

import (
	"context"
	"errors"

	"github.com/erp/backend/internal/db" // Your sqlc-generated package
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUserNotFound       = errors.New("user not found")
)

// AuthService provides the business logic for authentication.
// It interacts directly with the database via the sqlc-generated Queries.
type AuthService struct {
	queries *db.Queries
}

// NewAuthService creates a new instance of the AuthService.
func NewAuthService(queries *db.Queries) *AuthService {
	return &AuthService{
		queries: queries,
	}
}

// Login authenticates a user by their username and password.
// It fetches the user from the database and securely compares the password hash.
func (s *AuthService) Login(ctx context.Context, username, password string) (*db.User, error) {
	// 1. Fetch the user from the database by their username.
	user, err := s.queries.GetUserByUsername(ctx, username)
	if err != nil {
		// If the database returns no rows, we return a generic "user not found"
		// which will translate to a "invalid credentials" error for the client
		// to prevent username enumeration attacks.
		return nil, ErrUserNotFound
	}

	// 2. Compare the provided password with the stored hash.
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		// Passwords do not match.
		return nil, ErrInvalidCredentials
	}

	// 3. Return the user object on successful authentication.
	return &user, nil
}
