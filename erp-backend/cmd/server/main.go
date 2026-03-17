package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/reva-erp/backend/configs"
	"github.com/reva-erp/backend/internal/routes"
	"github.com/reva-erp/backend/pkg/database"
)

func main() {
	// Initialize configuration
	configs.LoadConfig()

	// Connect to database
	database.ConnectDB()
	defer database.CloseDB()

	// Initialize Fiber application
	app := fiber.New(fiber.Config{
		AppName: "Reva ERP SaaS API v1.0",
	})

	// Add global middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Mock-Data",
	}))

	// Register Routes
	routes.SetupRoutes(app)

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Starting Server on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
