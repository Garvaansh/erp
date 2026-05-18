package invoices

import (
	"github.com/erp/backend/internal/invoices/handlers"
	"github.com/erp/backend/internal/invoices/repository"
	"github.com/erp/backend/internal/invoices/services"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, authMiddleware fiber.Handler) {
	repo := repository.NewInvoiceRepository(pool)
	service := services.NewInvoiceService(repo, pool)
	handler := handlers.NewInvoiceHandler(service)

	// POST /api/v1/orders/:id/invoice
	// GET /api/v1/orders/:id/invoice
	ordersGroup := api.Group("/orders", authMiddleware)
	ordersGroup.Post("/:id/invoice", handler.GenerateInvoice)
	ordersGroup.Get("/:id/invoice", handler.GetInvoiceByOrder)

	// GET /api/v1/invoices/:id
	invoicesGroup := api.Group("/invoices", authMiddleware)
	invoicesGroup.Get("/:id", handler.GetInvoice)
}
