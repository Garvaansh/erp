// reset-password sets a new password for an existing user (by tenant ID + email).
// Usage from erp-backend:
//
//	TENANT_ID=f31e9ed1-4c16-4616-b99b-05cb1e19e9ec EMAIL=admin@reva.com NEW_PASSWORD=yournewpassword go run cmd/reset-password/main.go
package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/configs"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	configs.LoadConfig()
	database.ConnectDB()
	defer database.CloseDB()

	tenantIDStr := os.Getenv("TENANT_ID")
	email := os.Getenv("EMAIL")
	newPassword := os.Getenv("NEW_PASSWORD")
	if tenantIDStr == "" || email == "" || newPassword == "" {
		log.Fatal("Set TENANT_ID, EMAIL, and NEW_PASSWORD (e.g. TENANT_ID=<uuid> EMAIL=admin@reva.com NEW_PASSWORD=secret go run cmd/reset-password/main.go)")
	}

	ctx := context.Background()
	q := db.New(database.Pool)

	var tenantID pgtype.UUID
	if err := tenantID.Scan(tenantIDStr); err != nil {
		log.Fatalf("Invalid TENANT_ID format: %v", err)
	}

	user, err := q.GetUserByEmail(ctx, db.GetUserByEmailParams{
		Email:    email,
		TenantID: tenantID,
	})
	if err != nil {
		log.Fatalf("User not found for tenant %s and email %s: %v", tenantIDStr, email, err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}

	if err := q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		ID:           user.ID,
		TenantID:     user.TenantID,
		PasswordHash: string(hash),
	}); err != nil {
		log.Fatalf("UpdateUserPassword: %v", err)
	}

	log.Printf("Password updated for %s (tenant %s). You can now log in with that password.", email, tenantIDStr)
}
