package auth

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/tenant"
	"github.com/reva-erp/backend/pkg/database"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	TenantName string `json:"tenant_name"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

type LoginRequest struct {
	TenantID string `json:"tenant_id"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()

	// 1. Create Tenant
	t, err := q.CreateTenant(ctx, req.TenantName)
	if err != nil {
		log.Printf("CreateTenant error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create tenant"})
	}

	// 2. Hash Password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to encrypt password"})
	}

	// 3. Create User
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		TenantID:     t.ID,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
	})
	if err != nil {
		log.Printf("CreateUser error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// 4. Seed tenant config (settings, number series, default roles) and assign user as Admin
	if err := tenant.OnboardTenant(ctx, t.ID, req.TenantName, user.ID); err != nil {
		log.Printf("OnboardTenant error: %v", err)
		// Non-fatal: tenant and user exist; config can be fixed later
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":   "Tenant and User registered successfully",
		"tenant_id": t.ID,
		"user_id":   user.ID,
	})
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()

	var tenantUUID pgtype.UUID
	if err := tenantUUID.Scan(req.TenantID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid tenant ID format"})
	}

	// Get User
	user, err := q.GetUserByEmail(ctx, db.GetUserByEmailParams{
		Email:    req.Email,
		TenantID: tenantUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials or tenant ID"})
	}

	// Check Password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       user.ID,
		"tenant_id": user.TenantID,
		"email":     user.Email,
		"exp":       time.Now().Add(time.Hour * 72).Unix(),
	})

	secret := os.Getenv("JWT_SECRET")
	t, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Printf("JWT error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"token":   t,
	})
}
