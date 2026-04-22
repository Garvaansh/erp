package handlers

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type ItemHandler struct {
	itemService *services.ItemService
	validator   *validator.Validate
}

func NewItemHandler(itemService *services.ItemService, v *validator.Validate) *ItemHandler {
	return &ItemHandler{itemService: itemService, validator: v}
}

func (h *ItemHandler) CreateItem(c *fiber.Ctx) error {
	var req models.CreateItemRequest

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid JSON payload",
		})
	}

	normalizeCreateItemRequest(&req, c.Body())

	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	item, err := h.itemService.CreateItem(c.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrDuplicateSKU) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"status":  "error",
				"message": "SKU already exists",
			})
		}

		if errors.Is(err, services.ErrInvalidParentID) || errors.Is(err, services.ErrInvalidItemPayload) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to create item",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"item":   services.MapItemResponse(item),
	})
}

func normalizeCreateItemRequest(req *models.CreateItemRequest, rawBody []byte) {
	if req == nil || len(rawBody) == 0 {
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
	req.BaseUnit = strings.ToUpper(strings.TrimSpace(req.BaseUnit))
	req.Specs.Grade = strings.TrimSpace(req.Specs.Grade)

	var payload map[string]any
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return
	}

	legacyRawInput := hasAnyKey(payload, "thickness", "width", "item_type", "initial_weight", "coil_weight")
	if legacyRawInput {
		if req.Category == "" {
			req.Category = "RAW"
		}
		if req.BaseUnit == "" {
			req.BaseUnit = "WEIGHT"
		}
	}

	var specsPayload map[string]any
	if rawSpecs, ok := payload["specs"].(map[string]any); ok {
		specsPayload = rawSpecs
	}

	if req.Specs.Thickness <= 0 {
		if value, ok := numberFromMap(payload, "thickness"); ok {
			req.Specs.Thickness = value
		} else if value, ok := numberFromMap(specsPayload, "thickness"); ok {
			req.Specs.Thickness = value
		}
	}

	if req.Specs.Width <= 0 {
		if value, ok := numberFromMap(payload, "width"); ok {
			req.Specs.Width = value
		} else if value, ok := numberFromMap(specsPayload, "width"); ok {
			req.Specs.Width = value
		}
	}

	if req.Specs.Diameter <= 0 {
		if value, ok := numberFromMap(payload, "diameter"); ok {
			req.Specs.Diameter = value
		} else if value, ok := numberFromMap(specsPayload, "diameter"); ok {
			req.Specs.Diameter = value
		}
	}

	if req.Specs.Grade == "" {
		if value, ok := stringFromMap(payload, "grade"); ok {
			req.Specs.Grade = value
		} else if value, ok := stringFromMap(specsPayload, "grade"); ok {
			req.Specs.Grade = value
		}
	}
}

func hasAnyKey(values map[string]any, keys ...string) bool {
	if len(values) == 0 {
		return false
	}

	for _, key := range keys {
		if _, ok := values[key]; ok {
			return true
		}
	}

	return false
}

func numberFromMap(values map[string]any, key string) (float64, bool) {
	if len(values) == 0 {
		return 0, false
	}

	raw, exists := values[key]
	if !exists || raw == nil {
		return 0, false
	}

	switch typed := raw.(type) {
	case float64:
		return typed, true
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func stringFromMap(values map[string]any, key string) (string, bool) {
	if len(values) == 0 {
		return "", false
	}

	raw, exists := values[key]
	if !exists || raw == nil {
		return "", false
	}

	typed, ok := raw.(string)
	if !ok {
		return "", false
	}

	trimmed := strings.TrimSpace(typed)
	if trimmed == "" {
		return "", false
	}

	return trimmed, true
}

func (h *ItemHandler) ListItems(c *fiber.Ctx) error {
	category := strings.ToUpper(strings.TrimSpace(c.Query("category", "RAW")))
	if err := h.validator.Var(category, "required,oneof=RAW SEMI_FINISHED FINISHED SCRAP"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid category",
		})
	}

	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid pagination. limit must be 1-200 and offset must be >= 0",
		})
	}

	items, err := h.itemService.ListItemsByCategory(c.Context(), category, int32(limit), int32(offset))
	if err != nil {
		if errors.Is(err, services.ErrInvalidItemCategory) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "Invalid category",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to list items",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   services.MapItemsResponse(items),
		"pagination": fiber.Map{
			"category": category,
			"limit":    limit,
			"offset":   offset,
		},
	})
}

func (h *ItemHandler) ListVariants(c *fiber.Ctx) error {
	parentID := strings.TrimSpace(c.Params("parentId"))
	if err := h.validator.Var(parentID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid parentId",
		})
	}

	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid pagination. limit must be 1-200 and offset must be >= 0",
		})
	}

	variants, err := h.itemService.ListVariants(c.Context(), parentID, int32(limit), int32(offset))
	if err != nil {
		if errors.Is(err, services.ErrInvalidParentID) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "Invalid parentId",
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to list variants",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   services.MapItemsResponse(variants),
		"pagination": fiber.Map{
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *ItemHandler) GetSelectableItems(c *fiber.Ctx) error {
	items, err := h.itemService.GetSelectableItems(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load selectable items",
		})
	}

	return c.Status(fiber.StatusOK).JSON(items)
}

func validationErrors(err error) []string {
	validationErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return []string{err.Error()}
	}

	out := make([]string, 0, len(validationErrs))
	for _, validationErr := range validationErrs {
		out = append(out, validationErr.Field()+" failed on "+validationErr.Tag())
	}

	return out
}
