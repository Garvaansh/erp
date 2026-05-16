package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

// =============================================================================
// HANDLER INTERFACES — Thin dependency inversion for testability
// =============================================================================

// WIPCommandService is the interface for production execution commands.
type WIPCommandService interface {
	ExecuteMolding(ctx context.Context, cmd services.MoldingCommand) (*services.ProductionRunResult, error)
	ExecutePolishing(ctx context.Context, cmd services.PolishingCommand) (*services.ProductionRunResult, error)
}

// WIPQueryService is the interface for production read operations.
type WIPQueryService interface {
	ListProductionRuns(ctx context.Context, params services.ProductionRunListParams) ([]services.ProductionRunSummary, error)
	GetProductionRunByID(ctx context.Context, runID string) (*services.ProductionRunDetail, error)
	GetBatchLineage(ctx context.Context, batchID string) (*services.BatchLineageView, error)
}

// =============================================================================
// HANDLER STRUCT
// =============================================================================

// WIPHandler handles all WIP production execution API routes.
// Handlers are intentionally thin: parse → delegate → respond.
// All business logic lives in the service layer.
type WIPHandler struct {
	cmd       WIPCommandService
	qry       WIPQueryService
	validator *validator.Validate
}

func NewWIPHandler(cmd WIPCommandService, qry WIPQueryService, v *validator.Validate) *WIPHandler {
	return &WIPHandler{cmd: cmd, qry: qry, validator: v}
}

// =============================================================================
// REQUEST BODIES
// =============================================================================

// moldingRequest is the JSON body for POST /api/v1/wip/molding.
// Fields are user-facing names (no internal UUIDs in the wrong places).
type moldingRequest struct {
	OutputItemID   string  `json:"output_item_id" validate:"required,uuid4"`
	InputQty       float64 `json:"input_qty"       validate:"required,gt=0"`
	OutputQty      float64 `json:"output_qty"      validate:"required,gt=0"`
	ScrapQty       float64 `json:"scrap_qty"       validate:"gte=0"`
	ShortlengthQty float64 `json:"shortlength_qty" validate:"gte=0"`
	Notes          string  `json:"notes"           validate:"omitempty,max=500"`
}

// polishingRequest is the JSON body for POST /api/v1/wip/polishing.
// The operator provides ONLY the finished good item ID.
// The backend resolves source MOLDED batches automatically.
type polishingRequest struct {
	OutputItemID   string  `json:"output_item_id"   validate:"required,uuid4"`
	InputQty       float64 `json:"input_qty"        validate:"required,gt=0"`
	OutputQty      float64 `json:"output_qty"       validate:"required,gt=0"`
	ScrapQty       float64 `json:"scrap_qty"        validate:"gte=0"`
	ShortlengthQty float64 `json:"shortlength_qty"  validate:"gte=0"`
	Notes          string  `json:"notes"            validate:"omitempty,max=500"`
}

// =============================================================================
// POST /api/v1/wip/molding
// =============================================================================

// CreateMoldingRun executes a molding production run.
// The system automatically performs FIFO allocation from RAW inventory.
func (h *WIPHandler) CreateMoldingRun(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(wipErrorBody("Unauthorized"))
	}

	var req moldingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(wipErrorBody("Invalid JSON payload"))
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	result, err := h.cmd.ExecuteMolding(c.Context(), services.MoldingCommand{
		OutputItemID:   req.OutputItemID,
		InputQty:       req.InputQty,
		OutputQty:      req.OutputQty,
		ScrapQty:       req.ScrapQty,
		ShortlengthQty: req.ShortlengthQty,
		Notes:          req.Notes,
		OperatorID:     userID,
	})
	if err != nil {
		return mapWIPExecutionError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

// =============================================================================
// POST /api/v1/wip/polishing
// =============================================================================

// CreatePolishingRun executes a polishing production run.
// The system automatically performs FIFO allocation from MOLDED inventory.
func (h *WIPHandler) CreatePolishingRun(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(wipErrorBody("Unauthorized"))
	}

	var req polishingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(wipErrorBody("Invalid JSON payload"))
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	result, err := h.cmd.ExecutePolishing(c.Context(), services.PolishingCommand{
		OutputItemID:   req.OutputItemID,
		InputQty:       req.InputQty,
		OutputQty:      req.OutputQty,
		ScrapQty:       req.ScrapQty,
		ShortlengthQty: req.ShortlengthQty,
		Notes:          req.Notes,
		OperatorID:     userID,
	})
	if err != nil {
		return mapWIPExecutionError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    result,
	})
}

// =============================================================================
// GET /api/v1/wip/runs
// =============================================================================

// ListProductionRuns returns a paginated list of production runs.
// Supports optional query params: output_item_id, page, page_size.
func (h *WIPHandler) ListProductionRuns(c *fiber.Ctx) error {
	outputItemID := strings.TrimSpace(c.Query("output_item_id"))
	page := int32(c.QueryInt("page", 1))
	pageSize := int32(c.QueryInt("page_size", 50))

	rows, err := h.qry.ListProductionRuns(c.Context(), services.ProductionRunListParams{
		OutputItemID: outputItemID,
		Page:         page,
		PageSize:     pageSize,
	})
	if err != nil {
		return mapWIPExecutionError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"page":    page,
		"rows":    rows,
	})
}

// =============================================================================
// GET /api/v1/wip/runs/:id
// =============================================================================

// GetProductionRun returns the full detail of a single production run.
func (h *WIPHandler) GetProductionRun(c *fiber.Ctx) error {
	runID := strings.TrimSpace(c.Params("id"))
	if runID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(wipErrorBody("run id is required"))
	}

	detail, err := h.qry.GetProductionRunByID(c.Context(), runID)
	if err != nil {
		return mapWIPExecutionError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    detail,
	})
}

// =============================================================================
// GET /api/v1/wip/batch-lineage/:batchId
// =============================================================================

// GetBatchLineage returns the full upstream + downstream lineage for a batch.
// This is the primary audit trail endpoint: who made this batch and what consumed it.
func (h *WIPHandler) GetBatchLineage(c *fiber.Ctx) error {
	batchID := strings.TrimSpace(c.Params("batchId"))
	if batchID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(wipErrorBody("batch id is required"))
	}

	lineage, err := h.qry.GetBatchLineage(c.Context(), batchID)
	if err != nil {
		return mapWIPExecutionError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    lineage,
	})
}

// =============================================================================
// ERROR MAPPING
// =============================================================================

// mapWIPExecutionError maps domain errors to HTTP status codes.
// No raw SQL errors or internal stack traces are returned to the caller.
func mapWIPExecutionError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, services.ErrWIPMissingRecipe):
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"success": false,
			"code":    "MISSING_RECIPE",
			"message": "This item has no linked raw material. Configure the recipe in Item settings before starting production.",
		})
	case errors.Is(err, services.ErrWIPInsufficientInventory):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"code":    "INSUFFICIENT_INVENTORY",
			"message": "Insufficient inventory for the requested production quantity. Check available stock.",
		})
	case errors.Is(err, services.ErrWIPHoldBatchForbidden):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"code":    "BATCH_ON_HOLD",
			"message": "One or more batches are on HOLD and cannot be allocated.",
		})
	case errors.Is(err, services.ErrWIPNoBatchesAvailable):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"success": false,
			"code":    "NO_ACTIVE_BATCHES",
			"message": "No active inventory batches are available for this item.",
		})
	case errors.Is(err, services.ErrWIPItemNotFound),
		errors.Is(err, services.ErrWIPBatchNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"code":    "NOT_FOUND",
			"message": err.Error(),
		})
	case errors.Is(err, services.ErrWIPInvalidInputQty),
		errors.Is(err, services.ErrWIPInvalidOutputQty),
		errors.Is(err, services.ErrWIPInvalidScrapQty),
		errors.Is(err, services.ErrWIPInvalidShortlengthQty):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"code":    "INVALID_QUANTITY",
			"message": err.Error(),
		})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"code":    "EXECUTION_FAILED",
			"message": "Production execution failed. Error: " + err.Error(),
		})
	}
}

// wipErrorBody returns a standardised error envelope.
func wipErrorBody(message string) fiber.Map {
	return fiber.Map{"success": false, "message": message}
}
