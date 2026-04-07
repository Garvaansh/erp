package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/erp/backend/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func buildTestJWT(t *testing.T, secret string, expiresAt time.Time) string {
	t.Helper()

	claims := jwt.MapClaims{
		"user_id": "11111111-1111-1111-1111-111111111111",
		"email":   "admin@example.com",
		"role":    "SUPER_ADMIN",
		"exp":     expiresAt.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	require.NoError(t, err)
	return signed
}

func TestRateLimiter_BlocksSixthLoginAttempt(t *testing.T) {
	app := fiber.New()
	authGroup := app.Group("/api/v1/auth")
	authGroup.Post("/login", limiter.New(limiter.Config{
		Max:        5,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
	}), func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	for i := 1; i <= 6; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"email":"admin@example.com","password":"Password123!"}`))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "198.51.100.10:12345"

		resp, err := app.Test(req, -1)
		require.NoError(t, err)

		if i < 6 {
			require.NotEqual(t, fiber.StatusTooManyRequests, resp.StatusCode)
			continue
		}

		require.Equal(t, fiber.StatusTooManyRequests, resp.StatusCode)
	}
}

func TestRequireAuth_RejectsForgedOrExpiredTokens(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret")

	app := fiber.New()
	api := app.Group("/api/v1/auth")
	api.Get("/me", middleware.RequireAuth, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	t.Run("Fake JWT", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer definitely.not.a.real.token")
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Expired JWT", func(t *testing.T) {
		expired := buildTestJWT(t, "unit-test-secret", time.Now().Add(-5*time.Minute))
		req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+expired)
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Wrong Secret JWT", func(t *testing.T) {
		forged := buildTestJWT(t, "wrong-secret", time.Now().Add(5*time.Minute))
		req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+forged)
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})
}

func TestLoginValidation_RejectsInvalidPayloadsBeforeAuthService(t *testing.T) {
	app := fiber.New()
	handler := &AuthHandler{}
	app.Post("/api/v1/auth/login", handler.Login)

	testCases := []struct {
		name string
		body string
	}{
		{
			name: "Missing Email",
			body: `{"password":"Password123!"}`,
		},
		{
			name: "Blank Password",
			body: `{"email":"admin@example.com","password":""}`,
		},
		{
			name: "Malformed JSON",
			body: `{"email":"admin@example.com",`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req, -1)
			require.NoError(t, err)
			require.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
		})
	}
}
