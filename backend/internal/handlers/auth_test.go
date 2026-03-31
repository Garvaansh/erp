package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/erp/backend/internal/auth"
	"github.com/erp/backend/internal/db"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

// setupTestApp initializes a Fiber app, database connection, and all necessary services for testing.
func setupTestApp(t *testing.T) *fiber.App {
	// Load environment variables from the root of the backend directory
	err := godotenv.Load("../../.env")
	if err != nil {
		t.Fatalf("Error loading .env file: %v", err)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Fatal("DATABASE_URL not set in .env file")
	}

	// Connect to the real PostgreSQL database
	dbpool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("Unable to create connection pool: %v", err)
	}

	// Initialize real services
	queries := db.New(dbpool)
	authService := auth.NewAuthService(queries)
	authHandler := NewAuthHandler(authService)

	// Create a new Fiber app for testing
	app := fiber.New()
	api := app.Group("/api/v1")
	api.Post("/auth/login", authHandler.Login)

	return app
}

func TestAuthHandler_Login(t *testing.T) {
	app := setupTestApp(t)

	// Test Case 1: Malformed JSON payload
	t.Run("Malformed JSON", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", strings.NewReader(`{"username": "test",`))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Expected HTTP 400 for malformed JSON")
	})

	// Test Case 2: Validation Failure
	t.Run("Validation Failure", func(t *testing.T) {
		payload := map[string]string{
			"username": "ab",
			"password": "123",
		}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Expected HTTP 400 for validation failure")
	})

	// Test Case 3: Invalid Credentials
	t.Run("Invalid Credentials", func(t *testing.T) {
		// Note: This assumes a user 'garvaansh_admin' does not exist or the password is wrong.
		// For a real test, you might want to ensure a user exists and then use the wrong password.
		payload := map[string]string{
			"username": "admin",
			"password": "WrongPassword!",
		}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Expected HTTP 401 for invalid credentials")
	})

	// Test Case 4: Successful Login
	t.Run("Successful Login", func(t *testing.T) {
		// Using the actual SuperAdmin we seeded into the DB
		payload := map[string]string{
			"username": "admin",
			"password": "password@1234",
		}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)

		// Assert HTTP 200 OK
		assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected HTTP 200 for successful login")

		// Assert the Set-Cookie header
		cookieHeader := resp.Header.Get("Set-Cookie")
		assert.NotEmpty(t, cookieHeader, "Set-Cookie header should not be empty")
		assert.Contains(t, cookieHeader, "jwt_token=", "Cookie should contain jwt_token")
		assert.Contains(t, cookieHeader, "HttpOnly", "Cookie should be HttpOnly")
		assert.Contains(t, cookieHeader, "SameSite=Strict", "Cookie should have SameSite=Strict")

		// Assert the response body for user info
		respBody, err := io.ReadAll(resp.Body)
		assert.NoError(t, err)
		defer resp.Body.Close()

		var jsonResponse map[string]interface{}
		err = json.Unmarshal(respBody, &jsonResponse)
		assert.NoError(t, err)

		// Check for status: success
		status, ok := jsonResponse["status"].(string)
		assert.True(t, ok && status == "success", "Response status should be 'success'")

		// Check for user data
		data, ok := jsonResponse["data"].(map[string]interface{})
		assert.True(t, ok, "Response should contain a 'data' object")

		user, ok := data["user"].(map[string]interface{})
		assert.True(t, ok, "Data object should contain a 'user' object")

		username, ok := user["username"].(string)
		// FIXED: Asserting the correct username
		assert.True(t, ok && username == "admin", "Response user object should have the correct username")
	})
}
