package handlers

import (
	"net/http"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type StockAdjustmentHandler struct {
	service  *services.StockAdjustmentService
	validate *validator.Validate
}

func NewStockAdjustmentHandler(service *services.StockAdjustmentService, validate *validator.Validate) *StockAdjustmentHandler {
	return &StockAdjustmentHandler{service: service, validate: validate}
}

func (h *StockAdjustmentHandler) AdjustStock(c *fiber.Ctx) error {
	var req models.StockAdjustmentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}

	if err := h.validate.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed: " + err.Error(),
		})
	}

	userID, _ := c.Locals("userId").(string)
	err := h.service.AdjustStock(c.Context(), req, userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Stock adjustment failed: " + err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Stock adjusted successfully",
	})
}

func (h *StockAdjustmentHandler) GetLowStockAlerts(c *fiber.Ctx) error {
	alerts, err := h.service.GetLowStockAlerts(c.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load low stock alerts",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   alerts,
	})
}
