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

	superAdminEmail := strings.TrimSpace(strings.ToLower(os.Getenv("SUPER_ADMIN_EMAIL")))
	if superAdminEmail == "" {
		log.Fatal("SUPER_ADMIN_EMAIL is required")
	}

	superAdminPassword := os.Getenv("SUPER_ADMIN_PASSWORD")
	if strings.TrimSpace(superAdminPassword) == "" {
		log.Fatal("SUPER_ADMIN_PASSWORD is required")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	queries := db.New(pool)
	ctx := context.Background()

	// 1. Ensure required roles exist.
	_, err = pool.Exec(ctx, "INSERT INTO roles (code, name) VALUES ('SUPER_ADMIN', 'Super Admin'), ('ADMIN', 'Admin'), ('WORKER', 'Worker') ON CONFLICT DO NOTHING")
	if err != nil {
		log.Fatalf("failed to seed roles: %v", err)
	}

	// 2. Fetch the UUID for the Super Admin role
	role, err := queries.GetRoleByCode(ctx, "SUPER_ADMIN")
	if err != nil {
		log.Fatalf("Failed to fetch role: %v", err)
	}

	// 3. Hash password with explicit error handling.
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(superAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Panicf("failed to hash SUPER_ADMIN_PASSWORD: %v", err)
	}

	// 4. Idempotent create/update of SUPER_ADMIN user.
	var email string
	err = pool.QueryRow(
		ctx,
		`INSERT INTO users (email, password_hash, name, role_id, is_active, is_admin)
		 VALUES ($1, $2, $3, $4, TRUE, TRUE)
		 ON CONFLICT (email)
		 DO UPDATE SET
		   password_hash = EXCLUDED.password_hash,
		   name = EXCLUDED.name,
		   role_id = EXCLUDED.role_id,
		   is_active = TRUE,
		   is_admin = TRUE,
		   updated_at = NOW()
		 RETURNING email`,
		superAdminEmail,
		string(hashedBytes),
		"System Admin",
		role.ID,
	).Scan(&email)

	if err != nil {
		log.Fatalf("failed to upsert super admin: %v", err)
	}

	fmt.Printf("✅ SuperAdmin ensured: %s with role %s\n", email, role.Code)
}
