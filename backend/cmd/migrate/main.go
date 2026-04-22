package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

const helpText = `Usage: go run ./cmd/migrate/ <command>

Commands:
  up        Apply all pending migrations (default)
	down      Roll back applied migrations (default: 1). Use: down <n|all>
  status    Show applied vs pending migrations
  baseline  Mark all migrations as applied without executing them
            (use after importing a pre-existing database)
`

func main() {
	_ = godotenv.Load(".env")

	databaseURL := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(databaseURL) == "" {
		log.Fatal("DATABASE_URL is required")
	}

	command := "up"
	if len(os.Args) > 1 {
		command = strings.ToLower(strings.TrimSpace(os.Args[1]))
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database is not responding: %v", err)
	}

	ensureTrackingTable(ctx, pool)

	upFiles := loadMigrationFiles()

	switch command {
	case "up":
		runUp(ctx, pool, upFiles)
	case "down":
		downArg := ""
		if len(os.Args) > 2 {
			downArg = os.Args[2]
		}
		runDown(ctx, pool, downArg)
	case "status":
		runStatus(ctx, pool, upFiles)
	case "baseline":
		runBaseline(ctx, pool, upFiles)
	default:
		fmt.Print(helpText)
		os.Exit(1)
	}
}

func ensureTrackingTable(ctx context.Context, pool *pgxpool.Pool) {
	// If a legacy schema_migrations table exists with an incompatible schema
	// (e.g. bigint version column from golang-migrate), drop it first.
	var colType string
	err := pool.QueryRow(ctx, `
		SELECT data_type FROM information_schema.columns
		WHERE table_name = 'schema_migrations' AND column_name = 'version'
	`).Scan(&colType)
	if err == nil && colType != "text" && colType != "character varying" {
		_, _ = pool.Exec(ctx, "DROP TABLE schema_migrations")
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("Failed to create schema_migrations table: %v", err)
	}
}

func loadMigrationFiles() []string {
	migrationsDir := "db/migrations"
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("Failed to read migrations directory: %v", err)
	}

	var upFiles []string
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".up.sql") {
			upFiles = append(upFiles, entry.Name())
		}
	}
	sort.Strings(upFiles)
	return upFiles
}

func isApplied(ctx context.Context, pool *pgxpool.Pool, version string) bool {
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check migration status: %v", err)
	}
	return exists
}

func runUp(ctx context.Context, pool *pgxpool.Pool, files []string) {
	if len(files) == 0 {
		fmt.Println("No migration files found.")
		return
	}

	applied := 0
	skipped := 0

	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")

		if isApplied(ctx, pool, version) {
			skipped++
			continue
		}

		filePath := filepath.Join("db/migrations", file)
		content, err := os.ReadFile(filePath)
		if err != nil {
			log.Fatalf("❌ Failed to read %s: %v", file, err)
		}

		_, err = pool.Exec(ctx, string(content))
		if err != nil {
			log.Fatalf("❌ Migration FAILED: %s\n   Error: %v\n   Fix the migration and re-run.", file, err)
		}

		_, err = pool.Exec(ctx, "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", version, time.Now().UTC())
		if err != nil {
			log.Fatalf("❌ Failed to record migration %s: %v", file, err)
		}

		fmt.Printf("✅ Applied: %s\n", file)
		applied++
	}

	if applied == 0 && skipped > 0 {
		fmt.Printf("✅ Database is up to date (%d migrations already applied)\n", skipped)
	} else if applied > 0 {
		fmt.Printf("\n🎉 Done! Applied %d, skipped %d (already applied)\n", applied, skipped)
	}
}

func runStatus(ctx context.Context, pool *pgxpool.Pool, files []string) {
	fmt.Println("Migration Status:")
	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")
		if isApplied(ctx, pool, version) {
			fmt.Printf("  ✅ %s\n", file)
		} else {
			fmt.Printf("  ⏳ %s (pending)\n", file)
		}
	}
}

func runBaseline(ctx context.Context, pool *pgxpool.Pool, files []string) {
	fmt.Println("Marking all migrations as applied (baseline)...")
	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")
		if isApplied(ctx, pool, version) {
			continue
		}

		_, err := pool.Exec(ctx, "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)", version, time.Now().UTC())
		if err != nil {
			log.Fatalf("❌ Failed to record baseline for %s: %v", file, err)
		}
		fmt.Printf("  📌 Marked: %s\n", file)
	}
	fmt.Println("✅ Baseline complete. Future runs of 'up' will skip these migrations.")
}

func runDown(ctx context.Context, pool *pgxpool.Pool, downArg string) {
	appliedVersions, err := getAppliedVersionsDesc(ctx, pool)
	if err != nil {
		log.Fatalf("Failed to list applied migrations: %v", err)
	}

	if len(appliedVersions) == 0 {
		fmt.Println("No applied migrations to roll back.")
		return
	}

	count, err := resolveDownCount(downArg, len(appliedVersions))
	if err != nil {
		log.Fatalf("Invalid down argument: %v", err)
	}

	rolledBack := 0
	for _, version := range appliedVersions[:count] {
		downFile := version + ".down.sql"
		filePath := filepath.Join("db/migrations", downFile)

		content, readErr := os.ReadFile(filePath)
		if readErr != nil {
			log.Fatalf("❌ Missing rollback migration file for %s: %v", version, readErr)
		}

		tx, beginErr := pool.BeginTx(ctx, pgx.TxOptions{})
		if beginErr != nil {
			log.Fatalf("❌ Failed to begin rollback transaction for %s: %v", version, beginErr)
		}

		if _, execErr := tx.Exec(ctx, string(content)); execErr != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("❌ Rollback FAILED: %s\n   Error: %v", downFile, execErr)
		}

		if _, deleteErr := tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version = $1", version); deleteErr != nil {
			_ = tx.Rollback(ctx)
			log.Fatalf("❌ Failed to update tracking table for %s: %v", version, deleteErr)
		}

		if commitErr := tx.Commit(ctx); commitErr != nil {
			log.Fatalf("❌ Failed to commit rollback for %s: %v", version, commitErr)
		}

		fmt.Printf("↩️  Rolled back: %s\n", downFile)
		rolledBack++
	}

	fmt.Printf("\n✅ Done! Rolled back %d migration(s).\n", rolledBack)
}

func getAppliedVersionsDesc(ctx context.Context, pool *pgxpool.Pool) ([]string, error) {
	rows, err := pool.Query(ctx, "SELECT version FROM schema_migrations ORDER BY version DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := make([]string, 0)
	for rows.Next() {
		var version string
		if scanErr := rows.Scan(&version); scanErr != nil {
			return nil, scanErr
		}
		versions = append(versions, version)
	}

	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, rowsErr
	}

	return versions, nil
}

func resolveDownCount(raw string, available int) (int, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return 1, nil
	}

	if trimmed == "all" {
		return available, nil
	}

	count, err := strconv.Atoi(trimmed)
	if err != nil || count < 1 {
		return 0, fmt.Errorf("expected a positive integer or 'all', got %q", raw)
	}

	if count > available {
		return available, nil
	}

	return count, nil
}
