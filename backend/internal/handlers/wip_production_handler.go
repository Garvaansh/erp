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

type WIPProductionService interface {
	ProcessMolding(ctx context.Context, input models.ProcessMoldingInput) (*services.WIPJournalResult, error)
	ProcessPolishing(ctx context.Context, input models.ProcessPolishingInput) (*services.WIPJournalResult, error)
	ApproveJournal(ctx context.Context, journalID, adminID, note string, isAdmin bool) (*services.WIPJournalResult, error)
	RejectJournal(ctx context.Context, journalID, adminID, note string, isAdmin bool) (*services.WIPJournalResult, error)
	ListPendingApprovals(ctx context.Context, isAdmin bool, limit, offset int32) ([]services.PendingWIPApproval, error)
	ListActivityEntries(ctx context.Context, fromDate, toDate string, limit, offset int32) ([]services.WIPActivityEntry, error)
}

type WIPProductionHandler struct {
	service   WIPProductionService
	validator *validator.Validate
}

func NewWIPProductionHandler(service WIPProductionService, v *validator.Validate) *WIPProductionHandler {
	return &WIPProductionHandler{service: service, validator: v}
}

func (h *WIPProductionHandler) CreateMolding(c *fiber.Ctx) error {
	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Idempotency-Key header is required",
		})
	}

	var req models.MoldingRequest
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
			"message": "Failed to process molding transaction",
		})
	}

	result, err := h.service.ProcessMolding(c.Context(), models.ProcessMoldingInput{
		SourceBatchID:  req.SourceBatchID,
		InputWeight:    req.InputWeight,
		MoldedOutput:   req.MoldedOutput,
		ScrapQty:       req.ScrapQty,
		ShortlengthQty: req.ShortlengthQty,
		ProcessLossQty: req.ProcessLossQty,
		Diameter:       req.Diameter,
		Note:           req.Note,
		PerformedBy:    userID,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return mapWIPError(c, err, "Failed to process molding transaction")
	}

	statusCode := fiber.StatusOK
	if result.RequiresApproval {
		statusCode = fiber.StatusAccepted
	}

	return c.Status(statusCode).JSON(fiber.Map{
		"success":           true,
		"journal_id":        result.JournalID,
		"movement_group_id": result.MovementGroupID,
		"status":            result.Status,
		"requires_approval": result.RequiresApproval,
		"difference":        result.Difference,
		"tolerance":         result.Tolerance,
		"output_batch_id":   result.OutputBatchID,
	})
}

func (h *WIPProductionHandler) CreatePolishing(c *fiber.Ctx) error {
	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
	if idempotencyKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Idempotency-Key header is required",
		})
	}

	var req models.PolishingRequest
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
			"message": "Failed to process polishing transaction",
		})
	}

	result, err := h.service.ProcessPolishing(c.Context(), models.ProcessPolishingInput{
		SourceBatchID:        req.SourceBatchID,
		MoldedInput:          req.MoldedInput,
		FinishedOutput:       req.FinishedOutput,
		PolishingScrapQty:    req.PolishingScrapQty,
		PolishingShortlength: req.PolishingShortlength,
		FinalAdjustmentQty:   req.FinalAdjustmentQty,
		Note:                 req.Note,
		PerformedBy:          userID,
		IdempotencyKey:       idempotencyKey,
	})
	if err != nil {
		return mapWIPError(c, err, "Failed to process polishing transaction")
	}

	statusCode := fiber.StatusOK
	if result.RequiresApproval {
		statusCode = fiber.StatusAccepted
	}

	return c.Status(statusCode).JSON(fiber.Map{
		"success":           true,
		"journal_id":        result.JournalID,
		"movement_group_id": result.MovementGroupID,
		"status":            result.Status,
		"requires_approval": result.RequiresApproval,
		"difference":        result.Difference,
		"tolerance":         result.Tolerance,
		"output_batch_id":   result.OutputBatchID,
	})
}

func (h *WIPProductionHandler) ApproveJournal(c *fiber.Ctx) error {
	journalID := strings.TrimSpace(c.Params("id"))
	if journalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "journal id is required",
		})
	}

	var req models.ApproveProductionJournalRequest
	if len(c.Body()) > 0 {
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
	}

	adminID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(adminID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Unauthorized",
		})
	}
	isAdmin, _ := c.Locals("isAdmin").(bool)

	result, err := h.service.ApproveJournal(c.Context(), journalID, adminID, req.Note, isAdmin)
	if err != nil {
		return mapWIPError(c, err, "Failed to approve production journal")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success":           true,
		"journal_id":        result.JournalID,
		"movement_group_id": result.MovementGroupID,
		"status":            result.Status,
		"requires_approval": result.RequiresApproval,
		"difference":        result.Difference,
		"tolerance":         result.Tolerance,
		"output_batch_id":   result.OutputBatchID,
	})
}

func (h *WIPProductionHandler) RejectJournal(c *fiber.Ctx) error {
	journalID := strings.TrimSpace(c.Params("id"))
	if journalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "journal id is required",
		})
	}

	var req models.RejectProductionJournalRequest
	if len(c.Body()) > 0 {
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
	}

	adminID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(adminID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Unauthorized",
		})
	}
	isAdmin, _ := c.Locals("isAdmin").(bool)

	result, err := h.service.RejectJournal(c.Context(), journalID, adminID, req.Note, isAdmin)
	if err != nil {
		return mapWIPError(c, err, "Failed to reject production journal")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success":           true,
		"journal_id":        result.JournalID,
		"movement_group_id": result.MovementGroupID,
		"status":            result.Status,
		"requires_approval": result.RequiresApproval,
		"difference":        result.Difference,
		"tolerance":         result.Tolerance,
		"output_batch_id":   result.OutputBatchID,
	})
}

func (h *WIPProductionHandler) GetPendingApprovals(c *fiber.Ctx) error {
	adminID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(adminID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"status":  "error",
			"message": "Unauthorized",
		})
	}

	isAdmin, _ := c.Locals("isAdmin").(bool)
	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"status":  "error",
			"message": services.ErrWIPApproveUnauthorized.Error(),
		})
	}

	limit := int32(c.QueryInt("limit", 50))
	offset := int32(c.QueryInt("offset", 0))

	rows, err := h.service.ListPendingApprovals(c.Context(), isAdmin, limit, offset)
	if err != nil {
		return mapWIPError(c, err, "Failed to load pending approvals")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"rows":    rows,
	})
}

func (h *WIPProductionHandler) GetActivityEntries(c *fiber.Ctx) error {
	limit := int32(c.QueryInt("limit", 100))
	offset := int32(c.QueryInt("offset", 0))
	fromDate := strings.TrimSpace(c.Query("from"))
	toDate := strings.TrimSpace(c.Query("to"))

	rows, err := h.service.ListActivityEntries(c.Context(), fromDate, toDate, limit, offset)
	if err != nil {
		return mapWIPError(c, err, "Failed to load WIP activity entries")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"rows":    rows,
	})
}

func mapWIPError(c *fiber.Ctx, err error, fallbackMessage string) error {
	switch {
	case errors.Is(err, services.ErrInvalidWIPPayload),
		errors.Is(err, services.ErrWIPNoteRequired),
		errors.Is(err, services.ErrInvalidBatchType),
		errors.Is(err, services.ErrWIPDiameterRequired),
		errors.Is(err, services.ErrPendingApprovalOnly):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	case errors.Is(err, services.ErrWIPInsufficientStock):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	case errors.Is(err, services.ErrWIPApproveUnauthorized):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fallbackMessage,
		})
	}
}
