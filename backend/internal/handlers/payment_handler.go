package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type paymentService interface {
	CreatePayment(ctx context.Context, req models.CreatePaymentRequest, createdBy string) (*services.CreatePaymentResult, error)
	ListPayments(ctx context.Context, filter models.PaymentListFilter) (*services.PaymentListResult, error)
}

type PaymentHandler struct {
	service   paymentService
	validator *validator.Validate
}

func NewPaymentHandler(service paymentService, validator *validator.Validate) *PaymentHandler {
	return &PaymentHandler{service: service, validator: validator}
}

func (h *PaymentHandler) CreatePayment(c *fiber.Ctx) error {
	var req models.CreatePaymentRequest
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

	result, err := h.service.CreatePayment(c.Context(), req, userID)
	if err != nil {
		return h.paymentError(c, err, "Failed to create payment")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *PaymentHandler) ListPayments(c *fiber.Ctx) error {
	filter := models.PaymentListFilter{POID: strings.TrimSpace(c.Query("po_id"))}
	if err := h.validator.Struct(filter); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	result, err := h.service.ListPayments(c.Context(), filter)
	if err != nil {
		return h.paymentError(c, err, "Failed to list payments")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *PaymentHandler) paymentError(c *fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, services.ErrInvalidPaymentPayload),
		errors.Is(err, services.ErrPaymentCreatedByRequired):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	case errors.Is(err, services.ErrPaymentPurchaseNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
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
