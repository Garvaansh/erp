package settings

import (
	"github.com/erp/backend/internal/settings/handlers"
	"github.com/erp/backend/internal/settings/repository"
	"github.com/erp/backend/internal/settings/services"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RegisterRoutes(api fiber.Router, pool *pgxpool.Pool, authMiddleware fiber.Handler) {
	repo := repository.NewSettingsRepository(pool)
	service := services.NewSettingsService(repo)
	handler := handlers.NewSettingsHandler(service)

	settings := api.Group("/settings", authMiddleware)

	settings.Get("/business", handler.GetBusinessSettings)
	settings.Put("/business", handler.UpdateBusinessSettings)

	settings.Get("/invoice", handler.GetInvoiceSettings)
	settings.Put("/invoice", handler.UpdateInvoiceSettings)

	settings.Get("/whatsapp", handler.GetWhatsappSettings)
	settings.Put("/whatsapp", handler.UpdateWhatsappSettings)
}
