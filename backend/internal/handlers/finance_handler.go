package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type financePayablesService interface {
	GetPayables(ctx context.Context) ([]services.VendorPayables, error)
	GetLedger(ctx context.Context, filter services.LedgerFilter) ([]services.LedgerEntry, error)
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

func (h *FinanceHandler) GetLedger(c *fiber.Ctx) error {
	if h.service == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finance ledger",
		})
	}

	filter := services.LedgerFilter{
		FromDate: strings.TrimSpace(c.Query("from_date")),
		ToDate:   strings.TrimSpace(c.Query("to_date")),
	}

	entries, err := h.service.GetLedger(c.Context(), filter)
	if err != nil {
		if errors.Is(err, services.ErrInvalidLedgerFilter) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finance ledger",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   entries,
	})
}

