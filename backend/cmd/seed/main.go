package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/erp/backend/internal/db" // This is the sqlc code you generated!
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	queries := db.New(pool)

	// 1. Details
	username := os.Getenv("SUPER_ADMIN_USERNAME")
	if username == "" {
		log.Fatal("SUPER_ADMIN_USERNAME environment variable not set")
	}
	rawPassword := os.Getenv("SUPER_ADMIN_PASSWORD")
	if rawPassword == "" {
		log.Fatal("SUPER_ADMIN_PASSWORD environment variable not set")
	}
	fullName := "Admin"
	role := "SUPERADMIN"

	// 2. Hash
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	// 3. Save using pgtype.Text
	user, err := queries.CreateUser(context.Background(), db.CreateUserParams{
		Username:     username,
		PasswordHash: string(hashedBytes),
		FullName:     pgtype.Text{String: fullName, Valid: true},
		Role:         pgtype.Text{String: role, Valid: true},
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Printf("✅ SuperAdmin created: %s\n", user.Username)
}
