package handlers

import (
	"github.com/erp/backend/internal/invoices/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type InvoiceHandler struct {
	service services.InvoiceService
}

func NewInvoiceHandler(service services.InvoiceService) *InvoiceHandler {
	return &InvoiceHandler{service: service}
}

func (h *InvoiceHandler) GenerateInvoice(c *fiber.Ctx) error {
	orderIDStr := c.Params("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid order id"})
	}

	var generatedBy uuid.UUID
	if userIDStr, ok := c.Locals("userID").(string); ok {
		generatedBy, _ = uuid.Parse(userIDStr)
	}

	invoice, err := h.service.GenerateInvoice(c.Context(), orderID, generatedBy)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(invoice)
}

func (h *InvoiceHandler) GetInvoice(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid invoice id"})
	}

	invoice, err := h.service.GetInvoice(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "invoice not found"})
	}

	return c.JSON(invoice)
}

func (h *InvoiceHandler) GetInvoiceByOrder(c *fiber.Ctx) error {
	orderIDStr := c.Params("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid order id"})
	}

	invoice, err := h.service.GetInvoiceByOrder(c.Context(), orderID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "invoice not found"})
	}

	return c.JSON(invoice)
}
