package handlers

import (
	"errors"
	"strings"

	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

// BatchTraceabilityHandler handles batch traceability API routes.
type BatchTraceabilityHandler struct {
	svc *services.BatchTraceabilityService
}

func NewBatchTraceabilityHandler(svc *services.BatchTraceabilityService) *BatchTraceabilityHandler {
	return &BatchTraceabilityHandler{svc: svc}
}

// GetBatchTraceability handles GET /api/v1/inventory/batches/:batchCode/traceability
func (h *BatchTraceabilityHandler) GetBatchTraceability(c *fiber.Ctx) error {
	batchCode := strings.TrimSpace(c.Params("batchCode"))
	if batchCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "batch code is required",
		})
	}

	result, err := h.svc.GetBatchTraceability(c.Context(), batchCode)
	if err != nil {
		if errors.Is(err, services.ErrBatchNotFoundByCode) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"message": "Batch not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve batch traceability: " + err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}
