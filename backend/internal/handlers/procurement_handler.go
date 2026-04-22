package handlers

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type procurementCommandService interface {
	CreatePurchaseOrder(ctx context.Context, req models.CreatePurchaseOrderRequest, createdBy string) (*services.CreatePurchaseOrderResult, error)
	ReceiveGoods(ctx context.Context, poID string, qty float64, performedBy string) (*services.ReceiveGoodsResult, error)
	ReverseReceipt(ctx context.Context, poID string, batchIDs []string, reason string, performedBy string) (*services.ReverseReceiptResult, error)
	CloseOrder(ctx context.Context, poID string, reason string, performedBy string) (*services.CloseOrderResult, error)
	UpdatePurchaseOrder(ctx context.Context, poID string, req models.UpdatePurchaseOrderRequest, performedBy string) (*services.UpdatePurchaseOrderResult, error)
}

type procurementQueryService interface {
	ListProcurement(ctx context.Context, limit, offset int32) ([]services.ProcurementListRow, error)
	ListProcurementBatches(ctx context.Context, poID string) ([]services.ProcurementBatchRow, error)
	GetProcurementDetail(ctx context.Context, poID string) (*services.ProcurementDetail, error)
}

type ProcurementHandler struct {
	command   procurementCommandService
	query     procurementQueryService
	validator *validator.Validate
}

func NewProcurementHandler(command procurementCommandService, query procurementQueryService, validator *validator.Validate) *ProcurementHandler {
	return &ProcurementHandler{command: command, query: query, validator: validator}
}

func (h *ProcurementHandler) CreatePurchaseOrder(c *fiber.Ctx) error {
	var req models.CreatePurchaseOrderRequest
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

	result, err := h.command.CreatePurchaseOrder(c.Context(), req, userID)
	if err != nil {
		return h.procurementError(c, err, "Failed to create purchase order")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) ListProcurement(c *fiber.Ctx) error {
	limit := int32(100)
	offset := int32(0)

	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "limit must be a positive integer",
			})
		}
		limit = int32(parsed)
	}

	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "offset must be a non-negative integer",
			})
		}
		offset = int32(parsed)
	}

	rows, err := h.query.ListProcurement(c.Context(), limit, offset)
	if err != nil {
		return h.procurementError(c, err, "Failed to fetch procurement list")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   rows,
	})
}

func (h *ProcurementHandler) GetProcurementDetail(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	row, err := h.query.GetProcurementDetail(c.Context(), poID)
	if err != nil {
		return h.procurementError(c, err, "Failed to fetch procurement detail")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   row,
	})
}

func (h *ProcurementHandler) ListProcurementBatches(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	rows, err := h.query.ListProcurementBatches(c.Context(), poID)
	if err != nil {
		return h.procurementError(c, err, "Failed to fetch procurement batches")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   rows,
	})
}

func (h *ProcurementHandler) UpdatePurchaseOrder(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	var req models.UpdatePurchaseOrderRequest
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

	result, err := h.command.UpdatePurchaseOrder(c.Context(), poID, req, userID)
	if err != nil {
		return h.procurementError(c, err, "Failed to update purchase order")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) ReceiveGoods(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	var req models.ReceiveGoodsRequest
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

	result, err := h.command.ReceiveGoods(c.Context(), poID, req.Qty, userID)
	if err != nil {
		return h.procurementError(c, err, "Failed to receive goods")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) ReverseReceipt(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	var req models.ReverseReceiptRequest
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

	batchIDs := make([]string, 0, 1+len(req.BatchIDs))
	if batchID := strings.TrimSpace(req.BatchID); batchID != "" {
		batchIDs = append(batchIDs, batchID)
	}
	for _, batchID := range req.BatchIDs {
		trimmed := strings.TrimSpace(batchID)
		if trimmed == "" {
			continue
		}
		batchIDs = append(batchIDs, trimmed)
	}

	if len(batchIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Either batch_id or batch_ids is required",
		})
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Unauthorized",
		})
	}

	result, err := h.command.ReverseReceipt(c.Context(), poID, batchIDs, req.Reason, userID)
	if err != nil {
		return h.procurementError(c, err, "Failed to reverse receipt")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) CloseOrder(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "id must be a valid UUID",
		})
	}

	var req models.CloseProcurementOrderRequest
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

	result, err := h.command.CloseOrder(c.Context(), poID, req.Reason, userID)
	if err != nil {
		return h.procurementError(c, err, "Failed to close purchase order")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) procurementError(c *fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, services.ErrInvalidProcurementOrderPayload),
		errors.Is(err, services.ErrInvalidProcurementReceiptPayload),
		errors.Is(err, services.ErrInvalidReceivedWeight),
		errors.Is(err, services.ErrProcurementEditReasonRequired):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})

	case errors.Is(err, services.ErrPurchaseOrderNotFound),
		errors.Is(err, services.ErrProcurementBatchNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})

	case errors.Is(err, services.ErrReceivedQuantityExceedsOrdered),
		errors.Is(err, services.ErrPurchaseOrderStateConflict),
		errors.Is(err, services.ErrProcurementBatchStateConflict),
		errors.Is(err, services.ErrProcurementUpdateRestricted):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})

	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fallback,
		})
	}
}
