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

type procurementService interface {
	CreatePurchaseOrder(ctx context.Context, req models.CreatePurchaseOrderRequest, createdBy string) (*services.CreatePurchaseOrderResult, error)
	ListPurchaseOrders(ctx context.Context) ([]services.ProcurementOrderListRow, error)
	GetPurchaseOrderDetails(ctx context.Context, poID string) (*services.ProcurementOrderListRow, error)
	ListPurchaseOrderBatches(ctx context.Context, poID string) ([]services.ProcurementBatchRow, error)
	ExecuteProcurementReceipt(ctx context.Context, poID string, actualWeightReceived string) (*services.ExecuteProcurementReceiptResult, error)
	VoidProcurementReceipt(ctx context.Context, poID string, transactionID string, performedBy string) (*services.VoidProcurementReceiptResult, error)
}

type ProcurementHandler struct {
	service   procurementService
	validator *validator.Validate
}

func NewProcurementHandler(service procurementService, validator *validator.Validate) *ProcurementHandler {
	return &ProcurementHandler{service: service, validator: validator}
}

func (h *ProcurementHandler) CreateOrder(c *fiber.Ctx) error {
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

	result, err := h.service.CreatePurchaseOrder(c.Context(), req, userID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidProcurementOrderPayload):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to create purchase order",
			})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) ListOrders(c *fiber.Ctx) error {
	rows, err := h.service.ListPurchaseOrders(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to fetch purchase orders",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   rows,
	})
}

func (h *ProcurementHandler) GetOrderDetails(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("poId"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "poId must be a valid UUID",
		})
	}

	row, err := h.service.GetPurchaseOrderDetails(c.Context(), poID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrPurchaseOrderNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		case errors.Is(err, services.ErrInvalidProcurementOrderPayload):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to fetch purchase order details",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   row,
	})
}

func (h *ProcurementHandler) ListOrderBatches(c *fiber.Ctx) error {
	poID := strings.TrimSpace(c.Params("poId"))
	if err := h.validator.Var(poID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "poId must be a valid UUID",
		})
	}

	rows, err := h.service.ListPurchaseOrderBatches(c.Context(), poID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidProcurementOrderPayload):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to fetch purchase order batches",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   rows,
	})
}

func (h *ProcurementHandler) ReceiveOrder(c *fiber.Ctx) error {
	var req models.ReceiveProcurementRequest
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

	result, err := h.service.ExecuteProcurementReceipt(
		c.Context(),
		req.POID,
		strconv.FormatFloat(req.ActualWeightReceived, 'f', -1, 64),
	)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidProcurementReceiptPayload),
			errors.Is(err, services.ErrInvalidReceivedWeight),
			errors.Is(err, services.ErrPurchaseOrderNotFound),
			errors.Is(err, services.ErrPurchaseOrderNotPending),
			errors.Is(err, services.ErrReceivedQuantityExceedsOrdered):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to receive purchase order",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *ProcurementHandler) VoidReceipt(c *fiber.Ctx) error {
	var req models.VoidProcurementReceiptRequest
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

	result, err := h.service.VoidProcurementReceipt(c.Context(), req.POID, req.TransactionID, userID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidProcurementReceiptPayload),
			errors.Is(err, services.ErrProcurementReceiptNotFound):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to void purchase receipt",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}
