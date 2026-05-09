package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type FinishedGoodsCommandService interface {
	CreateFinishedGood(ctx context.Context, req models.CreateFinishedGoodRequest) (db.Item, error)
}

type FinishedGoodsQueryService interface {
	ListFinishedGoods(ctx context.Context) ([]services.FinishedGoodMasterRow, error)
	GetFinishedGoodDetail(ctx context.Context, productID string) (*services.FinishedGoodDetail, error)
}

type FinishedGoodsHandler struct {
	commandService FinishedGoodsCommandService
	queryService   FinishedGoodsQueryService
	validator      *validator.Validate
}

func NewFinishedGoodsHandler(
	commandService FinishedGoodsCommandService,
	queryService FinishedGoodsQueryService,
	v *validator.Validate,
) *FinishedGoodsHandler {
	return &FinishedGoodsHandler{
		commandService: commandService,
		queryService:   queryService,
		validator:      v,
	}
}

func (h *FinishedGoodsHandler) CreateFinishedGood(c *fiber.Ctx) error {
	var req models.CreateFinishedGoodRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid JSON payload",
		})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.LinkedRawMaterialID = strings.TrimSpace(req.LinkedRawMaterialID)

	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	item, err := h.commandService.CreateFinishedGood(c.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrFinishedGoodAlreadyExists),
			errors.Is(err, services.ErrDuplicateSKU):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		case errors.Is(err, services.ErrFinishedGoodInvalidRecipe):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to create finished good",
			})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"item":   services.MapItemResponse(item),
	})
}

func (h *FinishedGoodsHandler) ListFinishedGoods(c *fiber.Ctx) error {
	rows, err := h.queryService.ListFinishedGoods(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finished goods",
		})
	}

	return c.JSON(fiber.Map{
		"items": rows,
	})
}

func (h *FinishedGoodsHandler) GetFinishedGoodDetail(c *fiber.Ctx) error {
	productID := strings.TrimSpace(c.Params("id"))
	if productID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Product ID is required",
		})
	}

	detail, err := h.queryService.GetFinishedGoodDetail(c.Context(), productID)
	if err != nil {
		if errors.Is(err, services.ErrFinishedGoodNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"status":  "error",
				"message": "Finished good not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load finished good detail",
		})
	}

	return c.JSON(detail)
}
