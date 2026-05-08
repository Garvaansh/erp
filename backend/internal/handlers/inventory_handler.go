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

func NewInventoryHandler(inventoryService *services.InventoryService, v *validator.Validate) *InventoryHandler {
	return &InventoryHandler{inventoryService: inventoryService, validator: v}
}

func (h *InventoryHandler) ReceiveStock(c *fiber.Ctx) error {
	var req models.ReceiveStockRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed: " + err.Error(),
		})
	}

	performedBy := c.Locals("userId").(string)
	result, err := h.inventoryService.ReceiveStock(c.Context(), req, performedBy)
	if err != nil {
		return mapInventoryError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(result)
}

func (h *InventoryHandler) GetActiveBatches(c *fiber.Ctx) error {
	itemID := strings.TrimSpace(c.Query("item_id"))
	batchType := strings.TrimSpace(c.Query("type"))

	batches, err := h.inventoryService.GetActiveBatchesByItem(c.Context(), itemID, batchType)
	if err != nil {
		return mapInventoryError(c, err)
	}

	return c.JSON(fiber.Map{
		"batches": batches,
	})
}

func (h *InventoryHandler) GetInventoryView(c *fiber.Ctx) error {
	snapshot, err := h.inventoryService.GetInventoryView(c.Context())
	if err != nil {
		return mapInventoryError(c, err)
	}
	return c.JSON(snapshot)
}

func (h *InventoryHandler) UpdateBatchStatus(c *fiber.Ctx) error {
	batchID := strings.TrimSpace(c.Params("id"))
	if batchID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Batch ID is required",
		})
	}

	var req models.UpdateBatchStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}
	if err := h.validator.Var(req.Status, "required,oneof=HOLD ACTIVE"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed: " + err.Error(),
		})
	}

	performedBy := c.Locals("userId").(string)
	if err := h.inventoryService.UpdateBatchStatus(c.Context(), batchID, req, performedBy); err != nil {
		return mapInventoryError(c, err)
	}

	return c.JSON(fiber.Map{
		"status":  "ok",
		"message": "Batch status updated",
	})
}

func (h *InventoryHandler) GetRawMaterialMaster(c *fiber.Ctx) error {
	rows, err := h.inventoryService.GetRawMaterialMaster(c.Context())
	if err != nil {
		return mapInventoryError(c, err)
	}

	return c.JSON(fiber.Map{
		"items": rows,
	})
}

func (h *InventoryHandler) GetRawMaterialSummary(c *fiber.Ctx) error {
	itemID := strings.TrimSpace(c.Params("id"))
	if itemID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Item ID is required",
		})
	}

	summary, err := h.inventoryService.GetRawMaterialSummary(c.Context(), itemID)
	if err != nil {
		return mapInventoryError(c, err)
	}

	return c.JSON(summary)
}

func (h *InventoryHandler) GetRawMaterialBatches(c *fiber.Ctx) error {
	itemID := strings.TrimSpace(c.Params("id"))
	if itemID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Item ID is required",
		})
	}

	batches, err := h.inventoryService.GetRawMaterialBatches(c.Context(), itemID)
	if err != nil {
		return mapInventoryError(c, err)
	}

	return c.JSON(fiber.Map{
		"batches": batches,
	})
}

func mapInventoryError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, services.ErrInvalidInventoryPayload),
		errors.Is(err, services.ErrInvalidItemID),
		errors.Is(err, services.ErrInvalidBatchTypeFilter),
		errors.Is(err, services.ErrBatchQueryFilterMissing),
		errors.Is(err, services.ErrInvalidBatchStatus),
		errors.Is(err, services.ErrInvalidBatchFlow):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	case errors.Is(err, services.ErrBatchNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Batch not found",
		})
	case errors.Is(err, services.ErrRawMaterialNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Raw material not found",
		})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
}
