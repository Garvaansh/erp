package handlers

import (
	"os"
	"time"

	"github.com/erp/backend/internal/auth"
	"github.com/erp/backend/internal/models"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var validate = validator.New()

// AuthHandler handles the HTTP requests for authentication.
// It depends on the real AuthService for its business logic.
type AuthHandler struct {
	authService *auth.AuthService
}

// NewAuthHandler creates a new instance of the AuthHandler.
func NewAuthHandler(authService *auth.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles the user login request.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest

	// 1. Parse the JSON body into the LoginRequest DTO.
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Cannot parse JSON",
		})
	}

	// 2. Validate the DTO using the global validator instance.
	if err := validate.Struct(req); err != nil {
		// Return a structured error for better client-side handling.
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  err.Error(),
		})
	}

	// 3. Call the real AuthService.Login method.
	user, err := h.authService.Login(c.Context(), req.Username, req.Password)
	if err != nil {
		// For security, return a generic "unauthorized" error regardless of
		// whether the user was not found or the password was incorrect.
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid username or password",
		})
	}

	// 4. Generate a JWT using the real user data.
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role.String, // Use .String to get the value from pgtype.Text
		"exp":     time.Now().Add(time.Minute * 15).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to sign token",
		})
	}

	// 5. Create a secure, HttpOnly fiber.Cookie.
	cookie := new(fiber.Cookie)
	cookie.Name = "jwt_token"
	cookie.Value = signedToken
	cookie.Expires = time.Now().Add(time.Hour * 24) // Match refresh token lifetime if any
	cookie.HTTPOnly = true
	cookie.Secure = true // MUST be true in production (requires HTTPS)
	cookie.SameSite = "Strict"
	cookie.Path = "/" 

	c.Cookie(cookie)

	// 6. Return a 200 OK response with the real user's public data.
	// DO NOT return the password hash or other sensitive info.
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"user": fiber.Map{
				"id":       user.ID,
				"username": user.Username,
				"role":     user.Role.String,
			},
		},
	})
}
