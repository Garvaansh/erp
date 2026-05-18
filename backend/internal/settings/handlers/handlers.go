package handlers

import (
	"github.com/erp/backend/internal/settings/dto"
	"github.com/erp/backend/internal/settings/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SettingsHandler struct {
	service services.SettingsService
}

func NewSettingsHandler(service services.SettingsService) *SettingsHandler {
	return &SettingsHandler{service: service}
}

func (h *SettingsHandler) GetBusinessSettings(c *fiber.Ctx) error {
	settings, err := h.service.GetBusinessSettings(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *SettingsHandler) UpdateBusinessSettings(c *fiber.Ctx) error {
	var body dto.BusinessSettings
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	var updatedBy uuid.UUID
	if userIDStr, ok := c.Locals("userID").(string); ok {
		updatedBy, _ = uuid.Parse(userIDStr)
	}

	if err := h.service.UpdateBusinessSettings(c.Context(), &body, updatedBy); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "settings updated successfully"})
}

func (h *SettingsHandler) GetInvoiceSettings(c *fiber.Ctx) error {
	settings, err := h.service.GetInvoiceSettings(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *SettingsHandler) UpdateInvoiceSettings(c *fiber.Ctx) error {
	var body dto.InvoiceSettings
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	var updatedBy uuid.UUID
	if userIDStr, ok := c.Locals("userID").(string); ok {
		updatedBy, _ = uuid.Parse(userIDStr)
	}

	if err := h.service.UpdateInvoiceSettings(c.Context(), &body, updatedBy); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "settings updated successfully"})
}

func (h *SettingsHandler) GetWhatsappSettings(c *fiber.Ctx) error {
	settings, err := h.service.GetWhatsappSettings(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(settings)
}

func (h *SettingsHandler) UpdateWhatsappSettings(c *fiber.Ctx) error {
	var body dto.WhatsappSettings
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	var updatedBy uuid.UUID
	if userIDStr, ok := c.Locals("userID").(string); ok {
		updatedBy, _ = uuid.Parse(userIDStr)
	}

	if err := h.service.UpdateWhatsappSettings(c.Context(), &body, updatedBy); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "settings updated successfully"})
}
