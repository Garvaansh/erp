package handlers

import (
	"context"

	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type financePayablesService interface {
	GetPayables(ctx context.Context) ([]services.VendorPayables, error)
}

type FinanceHandler struct {
	service financePayablesService
}

func NewFinanceHandler(service financePayablesService) *FinanceHandler {
	return &FinanceHandler{service: service}
}

func (h *FinanceHandler) GetPayables(c *fiber.Ctx) error {
	if h.service == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finance payables",
		})
	}

	rows, err := h.service.GetPayables(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finance payables",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   rows,
	})
}
