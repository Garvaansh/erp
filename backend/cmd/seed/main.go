package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load(".env")

	databaseURL := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(databaseURL) == "" {
		log.Fatal("DATABASE_URL is required")
	}

	adminEmail := strings.TrimSpace(strings.ToLower(os.Getenv("ADMIN_EMAIL")))
	if adminEmail == "" {
		// Backward compatibility for existing environments.
		adminEmail = strings.TrimSpace(strings.ToLower(os.Getenv("SUPER_ADMIN_EMAIL")))
	}
	if adminEmail == "" {
		log.Fatal("ADMIN_EMAIL is required")
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if strings.TrimSpace(adminPassword) == "" {
		// Backward compatibility for existing environments.
		adminPassword = os.Getenv("SUPER_ADMIN_PASSWORD")
	}
	if strings.TrimSpace(adminPassword) == "" {
		log.Fatal("ADMIN_PASSWORD is required")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	queries := db.New(pool)
	ctx := context.Background()

	// 1. Ensure required roles exist.
	_, err = pool.Exec(ctx, "INSERT INTO roles (code, name) VALUES ('ADMIN', 'Administrator'), ('MANAGER', 'Manager'), ('STAFF', 'Staff') ON CONFLICT DO NOTHING")
	if err != nil {
		log.Fatalf("failed to seed roles: %v", err)
	}

	// 2. Fetch the UUID for the Admin role
	role, err := queries.GetRoleByCode(ctx, "ADMIN")
	if err != nil {
		log.Fatalf("Failed to fetch role: %v", err)
	}

	// 3. Hash password with explicit error handling.
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Panicf("failed to hash ADMIN_PASSWORD: %v", err)
	}

	// 4. Idempotent create/update of ADMIN user.
	var email string
	err = pool.QueryRow(
		ctx,
		`INSERT INTO users (email, password_hash, name, role_id, is_active)
		 VALUES ($1, $2, $3, $4, TRUE)
		 ON CONFLICT (email)
		 DO UPDATE SET
		   password_hash = EXCLUDED.password_hash,
		   name = EXCLUDED.name,
		   role_id = EXCLUDED.role_id,
		   is_active = TRUE,
		   updated_at = NOW()
		 RETURNING email`,
		adminEmail,
		string(hashedBytes),
		"System Admin",
		role.ID,
	).Scan(&email)

	if err != nil {
		log.Fatalf("failed to upsert super admin: %v", err)
	}

	fmt.Printf("✅ Admin ensured: %s with role %s\n", email, role.Code)
}
