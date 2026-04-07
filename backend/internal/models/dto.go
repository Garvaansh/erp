package models

// LoginRequest defines the structure for a user login request.
// It includes validation tags to ensure the input meets the required format.
type LoginRequest struct {
	Email string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}
