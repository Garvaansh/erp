// seed-tenant creates a new tenant with first admin user and seeds config (settings, number series, roles).
// Usage: set TENANT_NAME, ADMIN_EMAIL, ADMIN_PASSWORD (and optional ADMIN_FIRST_NAME, ADMIN_LAST_NAME), then run from erp-backend:
//
//	go run cmd/seed-tenant/main.go
//
// Or: TENANT_NAME=Reva ADMIN_EMAIL=admin@reva.com ADMIN_PASSWORD=secret go run cmd/seed-tenant/main.go
package main

import (
	"context"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/reva-erp/backend/configs"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/tenant"
	"github.com/reva-erp/backend/pkg/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	configs.LoadConfig()
	database.ConnectDB()
	defer database.CloseDB()

	name := os.Getenv("TENANT_NAME")
	email := os.Getenv("ADMIN_EMAIL")
	password := os.Getenv("ADMIN_PASSWORD")
	if name == "" || email == "" || password == "" {
		log.Fatal("Set TENANT_NAME, ADMIN_EMAIL, ADMIN_PASSWORD")
	}
	firstName := os.Getenv("ADMIN_FIRST_NAME")
	if firstName == "" {
		firstName = "Admin"
	}
	lastName := os.Getenv("ADMIN_LAST_NAME")
	if lastName == "" {
		lastName = "User"
	}

	ctx := context.Background()
	q := db.New(database.Pool)

	t, err := q.CreateTenant(ctx, name)
	if err != nil {
		log.Fatalf("CreateTenant: %v", err)
	}
	log.Printf("Created tenant %s (%s)", t.Name, uuid.UUID(t.ID.Bytes).String())

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		TenantID:     t.ID,
		Email:        email,
		PasswordHash: string(hash),
		FirstName:    firstName,
		LastName:     lastName,
	})
	if err != nil {
		log.Fatalf("CreateUser: %v", err)
	}
	log.Printf("Created user %s (%s)", user.Email, uuid.UUID(user.ID.Bytes).String())

	if err := tenant.OnboardTenant(ctx, t.ID, name, user.ID); err != nil {
		log.Fatalf("OnboardTenant: %v", err)
	}
	log.Println("Seeded tenant config (settings, number series, roles); assigned Admin role.")
	log.Printf("Login with tenant_id=%s email=%s and the given password.", uuid.UUID(t.ID.Bytes).String(), email)
}
