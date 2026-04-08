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

type DailyLogService interface {
	ProcessDailyLog(ctx context.Context, input models.ProcessDailyLogInput) (*services.ProcessDailyLogResult, error)
}

type DailyLogHandler struct {
	service   DailyLogService
	validator *validator.Validate
}

func NewDailyLogHandler(service DailyLogService, v *validator.Validate) *DailyLogHandler {
	return &DailyLogHandler{service: service, validator: v}
}

func (h *DailyLogHandler) CreateLog(c *fiber.Ctx) error {
	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Idempotency-Key header is required",
		})
	}

	var req models.DailyLogRequest
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

	if h.service == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to process daily log",
		})
	}

	result, err := h.service.ProcessDailyLog(c.Context(), models.ProcessDailyLogInput{
		SourceBatchID:   req.SourceBatchID,
		OutputItemName:  req.OutputItemName,
		OutputItemSpecs: req.OutputItemSpecs,
		InputQty:        req.InputQty,
		FinishedQty:     req.FinishedQty,
		ScrapQty:        req.ScrapQty,
		LossReason:      req.LossReason,
		WorkerID:        userID,
		IdempotencyKey:  idempotencyKey,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrYieldLossReasonRequired), errors.Is(err, services.ErrInvalidDailyLogPayload), errors.Is(err, services.ErrInsufficientStock):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to process daily log",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success":    true,
		"journal_id": result.JournalID,
	})
}
