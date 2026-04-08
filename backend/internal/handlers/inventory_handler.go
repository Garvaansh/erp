package handlers

import (
	"errors"
	"strings"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type InventoryHandler struct {
	inventoryService *services.InventoryService
	validator        *validator.Validate
}

type inventoryViewCategoryRow struct {
	ItemID   string  `json:"item_id"`
	Name     string  `json:"name"`
	Specs    any     `json:"specs"`
	TotalQty float64 `json:"total_qty"`
}

func NewInventoryHandler(inventoryService *services.InventoryService, v *validator.Validate) *InventoryHandler {
	return &InventoryHandler{inventoryService: inventoryService, validator: v}
}

func (h *InventoryHandler) ReceiveStock(c *fiber.Ctx) error {
	var req models.ReceiveStockRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid JSON payload",
		})
	}

	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Unauthorized",
		})
	}

	result, err := h.inventoryService.ReceiveStock(c.Context(), req, userID)
	if err != nil {
		if errors.Is(err, services.ErrDuplicateBatchCode) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}

		if errors.Is(err, services.ErrInvalidInventoryPayload) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}

		if errors.Is(err, services.ErrInvalidItemID) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to receive stock",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *InventoryHandler) GetActiveBatches(c *fiber.Ctx) error {
	itemID := strings.TrimSpace(c.Query("item_id"))
	if err := h.validator.Var(itemID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "item_id query parameter is required and must be a valid UUID",
		})
	}

	batches, err := h.inventoryService.GetActiveBatchesByItem(c.Context(), itemID)
	if err != nil {
		if errors.Is(err, services.ErrInvalidItemID) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "invalid item_id",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load active batches",
		})
	}

	return c.Status(fiber.StatusOK).JSON(batches)
}

func (h *InventoryHandler) GetInventoryView(c *fiber.Ctx) error {
	view, err := h.inventoryService.GetInventoryView(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load inventory view",
		})
	}

	out := map[string][]inventoryViewCategoryRow{
		"RAW":           {},
		"SEMI_FINISHED": {},
		"FINISHED":      {},
		"SCRAP":         {},
	}

	for category, rows := range view {
		mapped := make([]inventoryViewCategoryRow, 0, len(rows))
		for _, row := range rows {
			mapped = append(mapped, inventoryViewCategoryRow{
				ItemID:   row.ItemID,
				Name:     row.Name,
				Specs:    row.Specs,
				TotalQty: row.TotalQty,
			})
		}
		out[category] = mapped
	}

	return c.Status(fiber.StatusOK).JSON(out)
}
