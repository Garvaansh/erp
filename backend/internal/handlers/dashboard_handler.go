package handlers

import (
	"context"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type DashboardSummaryService interface {
	GetSummary(ctx context.Context) (*models.DashboardSummaryDTO, error)
}

type DashboardHandler struct {
	service DashboardSummaryService
}

func NewDashboardHandler(service DashboardSummaryService) *DashboardHandler {
	return &DashboardHandler{service: service}
}

func (h *DashboardHandler) GetSummary(c *fiber.Ctx) error {
	if h.service == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load dashboard summary",
		})
	}

	summary, err := h.service.GetSummary(c.Context())
	if err != nil {
		if err == services.ErrGetDashboardSummaryFailed {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to load dashboard summary",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load dashboard summary",
		})
	}

	return c.Status(fiber.StatusOK).JSON(summary)
}
