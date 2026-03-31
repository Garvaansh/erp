package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/erp/backend/internal/auth"
	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/handlers"
	"github.com/erp/backend/internal/middleware" // Import the middleware package
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load Environment Variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("CRITICAL: DATABASE_URL is not set")
	}

	// 2. Connect to PostgreSQL with optimized pool
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Unable to parse DATABASE_URL: %v\n", err)
	}
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = 5 * time.Minute

	dbpool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v\n", err)
	}
	defer dbpool.Close()

	if err := dbpool.Ping(context.Background()); err != nil {
		log.Fatalf("Database is not responding: %v\n", err)
	}
	log.Println("✅ Successfully connected to RevaDB!")

	// 3. Initialize Services and Handlers
	queries := db.New(dbpool)
	authService := auth.NewAuthService(queries)
	authHandler := handlers.NewAuthHandler(authService)

	// 4. Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "Reva ERP API v1.0",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true, // IMPORTANT: Allow cookies to be sent
	}))

	// 5. Define Routes
	api := app.Group("/api/v1")

	// --- PUBLIC ROUTES ---
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})
	authGroup := api.Group("/auth")
	authGroup.Post("/login", authHandler.Login)

	// --- PROTECTED ROUTES ---
	// Any route attached to 'protected' must pass the JWT middleware.
	protected := api.Group("/", middleware.RequireAuth)
	protected.Get("/me", func(c *fiber.Ctx) error {
		// Pulling the data the middleware securely injected into the context.
		userID := c.Locals("userID")
		role := c.Locals("role")

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "success",
			"message": "You are past the bouncer.",
			"data": fiber.Map{
				"id":   userID,
				"role": role,
			},
		})
	})

	// 6. Graceful Shutdown
	go func() {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		log.Printf("🚀 Server starting on port %s", port)
		if err := app.Listen(":" + port); err != nil {
			log.Panic(err)
		}
	}()

	c_chan := make(chan os.Signal, 1)
	signal.Notify(c_chan, os.Interrupt, syscall.SIGTERM)
	<-c_chan
	log.Println("\nGracefully shutting down...")
	_ = app.Shutdown()
	log.Println("Fiber server was successfully shut down.")
}
