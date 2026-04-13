package handlers

import (
	"errors"
	"net/http"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type VendorHandler struct {
	service  *services.VendorService
	validate *validator.Validate
}

func NewVendorHandler(service *services.VendorService, validate *validator.Validate) *VendorHandler {
	return &VendorHandler{service: service, validate: validate}
}

func (h *VendorHandler) ListVendors(c *fiber.Ctx) error {
	vendors, err := h.service.ListVendors(c.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load vendors",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   vendors,
	})
}

func (h *VendorHandler) CreateVendor(c *fiber.Ctx) error {
	var req models.CreateVendorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}

	if err := h.validate.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed: " + err.Error(),
		})
	}

	vendor, err := h.service.CreateVendor(c.Context(), req)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "Failed to create vendor"
		if errors.Is(err, services.ErrVendorAlreadyExists) {
			status = http.StatusConflict
			msg = "A vendor with this name already exists"
		}
		return c.Status(status).JSON(fiber.Map{
			"status":  "error",
			"message": msg,
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   vendor,
	})
}

func (h *VendorHandler) UpdateVendor(c *fiber.Ctx) error {
	vendorID := c.Params("vendorId")

	var req models.UpdateVendorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}

	if err := h.validate.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed: " + err.Error(),
		})
	}

	err := h.service.UpdateVendor(c.Context(), vendorID, req)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "Failed to update vendor"
		if errors.Is(err, services.ErrVendorNotFound) {
			status = http.StatusNotFound
			msg = "Vendor not found"
		} else if errors.Is(err, services.ErrVendorAlreadyExists) {
			status = http.StatusConflict
			msg = "A vendor with this name already exists"
		}
		return c.Status(status).JSON(fiber.Map{
			"status":  "error",
			"message": msg,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Vendor updated",
	})
}
