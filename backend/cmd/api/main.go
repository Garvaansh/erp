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
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
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

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		log.Fatal("CRITICAL: FRONTEND_URL is not set")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("CRITICAL: JWT_SECRET is not set")
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
	itemService := services.NewItemService(queries)
	inventoryService := services.NewInventoryService(dbpool, itemService)
	productionService := services.NewProductionService(dbpool)
	wipProductionService := services.NewWIPProductionService(dbpool)
	procurementService := services.NewProcurementService(dbpool)
	paymentService := services.NewPaymentService(dbpool)
	userService := services.NewUserService(dbpool)
	vendorService := services.NewVendorService(dbpool)
	stockAdjustmentService := services.NewStockAdjustmentService(dbpool)
	reportService := services.NewReportService(dbpool)
	dashboardService := services.NewDashboardService(queries, dbpool)
	requestValidator := validator.New(validator.WithRequiredStructEnabled())
	itemHandler := handlers.NewItemHandler(itemService, requestValidator)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService, requestValidator)
	productionHandler := handlers.NewDailyLogHandler(productionService, requestValidator)
	wipProductionHandler := handlers.NewWIPProductionHandler(wipProductionService, requestValidator)
	procurementHandler := handlers.NewProcurementHandler(procurementService, requestValidator)
	paymentHandler := handlers.NewPaymentHandler(paymentService, requestValidator)
	userHandler := handlers.NewUserHandler(userService, requestValidator)
	vendorHandler := handlers.NewVendorHandler(vendorService, requestValidator)
	stockAdjustmentHandler := handlers.NewStockAdjustmentHandler(stockAdjustmentService, requestValidator)
	reportHandler := handlers.NewReportHandler(reportService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)

	// 4. Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName: "Reva ERP API v1.0",
	})

	// Middleware
	app.Use(requestid.New())
	app.Use(recover.New())
	app.Use(helmet.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Idempotency-Key",
		AllowCredentials: true,
	}))

	// 5. Define Routes
	api := app.Group("/api/v1", limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"status":  "error",
				"message": "Rate limit exceeded. Please slow down.",
			})
		},
	}))

	// --- PUBLIC ROUTES ---
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})
	authGroup := api.Group("/auth")
	authGroup.Post(
		"/login",
		limiter.New(limiter.Config{
			Max:        5,
			Expiration: 1 * time.Minute,
			KeyGenerator: func(c *fiber.Ctx) string {
				return c.IP()
			},
			LimitReached: func(c *fiber.Ctx) error {
				return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
					"status":  "error",
					"message": "Too many login attempts. Please try again in a minute.",
				})
			},
		}),
		authHandler.Login,
	)
	authGroup.Get("/me", middleware.RequireAuth, authHandler.Me)

	itemsGroup := api.Group("/items", middleware.RequireAuth)
	itemsGroup.Get("/", itemHandler.ListItems)
	itemsGroup.Get("/selectable", itemHandler.GetSelectableItems)
	itemsGroup.Post("/", itemHandler.CreateItem)
	itemsGroup.Get("/variants/:parentId", itemHandler.ListVariants)

	inventoryGroup := api.Group("/inventory", middleware.RequireAuth)
	inventoryGroup.Get("/batches", inventoryHandler.GetActiveBatches)
	inventoryGroup.Get("/view", inventoryHandler.GetInventoryView)
	inventoryGroup.Post("/receive", inventoryHandler.ReceiveStock)

	logsGroup := api.Group("/logs", middleware.RequireAuth)
	logsGroup.Post("/", productionHandler.CreateLog)

	productionGroup := api.Group("/production", middleware.RequireAuth)
	productionGroup.Post("/molding", wipProductionHandler.CreateMolding)
	productionGroup.Post("/polishing", wipProductionHandler.CreatePolishing)
	productionGroup.Get("/entries", wipProductionHandler.GetActivityEntries)
	productionGroup.Get("/pending", middleware.RequireAdmin, wipProductionHandler.GetPendingApprovals)
	productionGroup.Patch("/approve/:id", middleware.RequireAdmin, wipProductionHandler.ApproveJournal)
	productionGroup.Patch("/reject/:id", middleware.RequireAdmin, wipProductionHandler.RejectJournal)

	procurementGroup := api.Group("/procurement", middleware.RequireAuth)
	procurementGroup.Post("/", procurementHandler.CreatePurchaseOrder)
	procurementGroup.Get("/", procurementHandler.ListProcurement)
	procurementGroup.Get("/:id/batches", procurementHandler.ListProcurementBatches)
	procurementGroup.Get("/:id", procurementHandler.GetProcurementDetail)
	procurementGroup.Patch("/:id", procurementHandler.UpdatePurchaseOrder)
	procurementGroup.Post("/:id/receive", procurementHandler.ReceiveGoods)
	procurementGroup.Post("/:id/reverse", procurementHandler.ReverseReceipt)
	procurementGroup.Post("/:id/close", procurementHandler.CloseOrder)

	paymentsGroup := api.Group("/payments", middleware.RequireAuth)
	paymentsGroup.Post("/", paymentHandler.CreatePayment)
	paymentsGroup.Get("/", paymentHandler.ListPayments)

	dashboardGroup := api.Group("/dashboard", middleware.RequireAuth)
	dashboardGroup.Get("", dashboardHandler.GetSummary)

	usersGroup := api.Group("/users", middleware.RequireAuth, middleware.RequireAdmin)
	usersGroup.Get("/", userHandler.ListUsers)
	usersGroup.Post("/", userHandler.CreateUser)
	usersGroup.Put("/:userId", userHandler.UpdateUser)

	vendorsGroup := api.Group("/vendors", middleware.RequireAuth)
	vendorsGroup.Get("/", vendorHandler.ListVendors)
	vendorsGroup.Post("/", vendorHandler.CreateVendor)
	vendorsGroup.Put("/:vendorId", vendorHandler.UpdateVendor)

	inventoryAdjGroup := api.Group("/inventory", middleware.RequireAuth)
	inventoryAdjGroup.Post("/adjust", stockAdjustmentHandler.AdjustStock)
	inventoryAdjGroup.Get("/alerts", stockAdjustmentHandler.GetLowStockAlerts)

	reportsGroup := api.Group("/reports", middleware.RequireAuth)
	reportsGroup.Get("/inventory", reportHandler.GetInventoryReport)
	reportsGroup.Get("/purchase", reportHandler.GetPurchaseReport)
	reportsGroup.Get("/users", reportHandler.GetUsersReport)

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
