package handlers

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/erp/backend/internal/auth"
	"github.com/erp/backend/internal/models"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var validate = validator.New()

type AuthHandler struct {
	authService *auth.AuthService
}

func NewAuthHandler(authService *auth.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func formatUUID(uuidBytes [16]byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", uuidBytes[0:4], uuidBytes[4:6], uuidBytes[6:8], uuidBytes[8:10], uuidBytes[10:16])
}

func parseUUIDString(value string) (pgtype.UUID, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return pgtype.UUID{}, false
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return pgtype.UUID{}, false
	}
	return pgtype.UUID{Bytes: [16]byte(parsed), Valid: true}, true
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid JSON"})
	}

	if err := validate.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed"})
	}

	user, err := h.authService.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Invalid credentials"})
	}

	var userID string
	if user.ID.Valid {
		userID = formatUUID(user.ID.Bytes)
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Server configuration error",
		})
	}

	expiresAt := time.Now().Add(time.Hour * 24)

	claims := jwt.MapClaims{
		"user_id":   userID,
		"role_code": user.RoleCode,
		"exp":       expiresAt.Unix(),
	}

	expiresIn := int64(time.Until(expiresAt).Seconds())

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Authentication failed",
		})
	}

	c.Set("X-Session-Token", signedToken)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"expires_in": expiresIn,
		"expires_at": expiresAt.Unix(),
		"user": fiber.Map{
			"id":        userID,
			"email":     user.Email,
			"role_code": user.RoleCode,
		},
	})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userIDFromToken, userIDOk := c.Locals("userID").(string)
	if !userIDOk || userIDFromToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}

	userUUID, ok := parseUUIDString(userIDFromToken)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}

	user, err := h.authService.GetActiveUserProfileByID(c.Context(), userUUID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}

	if !user.ID.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}

	userID := formatUUID(user.ID.Bytes)
	if userID != userIDFromToken {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthorized"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"user": fiber.Map{
			"id":        userID,
			"email":     user.Email,
			"role_code": user.RoleCode,
		},
	})
}
