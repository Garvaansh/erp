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

type vendorCommandService interface {
	CreateVendor(ctx context.Context, req models.CreateVendorCommandRequest) (*models.VendorReadModel, error)
	UpdateVendor(ctx context.Context, id string, req models.UpdateVendorCommandRequest) (*models.VendorReadModel, error)
}

type vendorQueryService interface {
	ListVendors(ctx context.Context, filter string, search string) ([]models.VendorReadModel, error)
	GetVendorProfile(ctx context.Context, id string) (*models.VendorProfileResponse, error)
}

type VendorHandler struct {
	commandService vendorCommandService
	queryService   vendorQueryService
	validate       *validator.Validate
}

func NewVendorHandler(commandService vendorCommandService, queryService vendorQueryService, validate *validator.Validate) *VendorHandler {
	return &VendorHandler{commandService: commandService, queryService: queryService, validate: validate}
}

func (h *VendorHandler) CreateVendor(c *fiber.Ctx) error {
	var req models.CreateVendorCommandRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validate.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	vendor, err := h.commandService.CreateVendor(c.Context(), req)
	if err != nil {
		return h.vendorError(c, err, "Failed to create vendor")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "success", "data": vendor})
}

func (h *VendorHandler) UpdateVendor(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if err := h.validate.Var(id, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	var req models.UpdateVendorCommandRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validate.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	vendor, err := h.commandService.UpdateVendor(c.Context(), id, req)
	if err != nil {
		return h.vendorError(c, err, "Failed to update vendor")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": vendor})
}

func (h *VendorHandler) ListVendors(c *fiber.Ctx) error {
	filter := strings.TrimSpace(c.Query("filter"))
	search := strings.TrimSpace(c.Query("search"))

	rows, err := h.queryService.ListVendors(c.Context(), filter, search)
	if err != nil {
		return h.vendorError(c, err, "Failed to list vendors")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": rows})
}

func (h *VendorHandler) GetVendorProfile(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))
	if err := h.validate.Var(id, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	profile, err := h.queryService.GetVendorProfile(c.Context(), id)
	if err != nil {
		return h.vendorError(c, err, "Failed to get vendor profile")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": profile})
}

func (h *VendorHandler) vendorError(c *fiber.Ctx, err error, fallbackMessage string) error {
	status := fiber.StatusInternalServerError
	message := fallbackMessage

	switch {
	case errors.Is(err, services.ErrVendorNotFound):
		status = fiber.StatusNotFound
		message = "Vendor not found"
	case errors.Is(err, services.ErrVendorCodeExists):
		status = fiber.StatusConflict
		message = "Vendor code already exists"
	case errors.Is(err, services.ErrVendorCodeImmutable):
		status = fiber.StatusBadRequest
		message = "Vendor code is immutable"
	case errors.Is(err, services.ErrInvalidVendorPayload),
		errors.Is(err, services.ErrInvalidVendorIdentifier),
		errors.Is(err, services.ErrInvalidVendorFilter):
		status = fiber.StatusBadRequest
		message = err.Error()
	}

	return c.Status(status).JSON(fiber.Map{"status": "error", "message": message})
}
