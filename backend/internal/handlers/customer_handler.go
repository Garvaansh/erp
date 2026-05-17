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

type customerCommandService interface {
	CreateCustomer(ctx context.Context, req models.CreateCustomerRequest) (*models.CustomerCreateResponse, error)
}

type customerQueryService interface {
	SearchCustomers(ctx context.Context, rawQuery string, page int32, pageSize int32) (*models.CustomerSearchPage, error)
}

type CustomerHandler struct {
	commandService customerCommandService
	queryService   customerQueryService
	validate       *validator.Validate
}

func NewCustomerHandler(commandService customerCommandService, queryService customerQueryService, validate *validator.Validate) *CustomerHandler {
	return &CustomerHandler{commandService: commandService, queryService: queryService, validate: validate}
}

func (h *CustomerHandler) CreateCustomer(c *fiber.Ctx) error {
	var req models.CreateCustomerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validate.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	result, err := h.commandService.CreateCustomer(c.Context(), req)
	if err != nil {
		return h.customerError(c, err)
	}

	status := fiber.StatusCreated
	if result != nil && result.Resolution == "exact_existing_customer" {
		status = fiber.StatusOK
	}
	if result != nil && result.Resolution == "probable_matches" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"status":  "error",
			"message": "Customer identity requires review",
			"data":    result,
		})
	}

	return c.Status(status).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *CustomerHandler) SearchCustomers(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("q"))
	page := int32(c.QueryInt("page", 1))
	pageSize := int32(c.QueryInt("page_size", 20))

	result, err := h.queryService.SearchCustomers(c.Context(), query, page, pageSize)
	if err != nil {
		return h.customerError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *CustomerHandler) customerError(c *fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	message := "Failed to process customer request"

	switch {
	case errors.Is(err, services.ErrInvalidCustomerPayload),
		errors.Is(err, services.ErrInvalidCustomerSearchQuery):
		status = fiber.StatusBadRequest
		message = err.Error()
	case errors.Is(err, services.ErrCreateCustomerFailed):
		message = "Failed to create customer"
	case errors.Is(err, services.ErrSearchCustomersFailed):
		message = "Failed to search customers"
	}

	return c.Status(status).JSON(fiber.Map{"status": "error", "message": message})
}
