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

type salesOrderCommandService interface {
	CreateSalesOrder(ctx context.Context, req models.CreateSalesOrderRequest, createdBy string) (*services.SalesOrderMutationResult, error)
	DispatchSalesOrder(ctx context.Context, orderID string, req models.DispatchSalesOrderRequest, performedBy string) (*services.SalesOrderMutationResult, error)
	CancelSalesOrder(ctx context.Context, orderID string, reason string, performedBy string) (*services.SalesOrderMutationResult, error)
}

type salesOrderQueryService interface {
	ListSalesOrders(ctx context.Context, status string, page int32, pageSize int32) (*services.SalesOrderListPage, error)
	GetSalesOrderDetail(ctx context.Context, orderID string) (*services.SalesOrderDetail, error)
	GetOrderAllocations(ctx context.Context, orderID string) ([]services.SalesOrderAllocationView, error)
	GetFinishedGoodReservations(ctx context.Context, itemID string) (*services.FinishedGoodReservationVisibility, error)
	GetBatchReservations(ctx context.Context, batchCode string) (*services.BatchReservationDrillDown, error)
}

type OrderHandler struct {
	command   salesOrderCommandService
	query     salesOrderQueryService
	validator *validator.Validate
}

func NewOrderHandler(command salesOrderCommandService, query salesOrderQueryService, validator *validator.Validate) *OrderHandler {
	return &OrderHandler{command: command, query: query, validator: validator}
}

func (h *OrderHandler) CreateSalesOrder(c *fiber.Ctx) error {
	var req models.CreateSalesOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Unauthorized"})
	}

	result, err := h.command.CreateSalesOrder(c.Context(), req, userID)
	if err != nil {
		return h.orderError(c, err, "Failed to create sales order")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) DispatchSalesOrder(c *fiber.Ctx) error {
	orderID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(orderID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	var req models.DispatchSalesOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Unauthorized"})
	}

	result, err := h.command.DispatchSalesOrder(c.Context(), orderID, req, userID)
	if err != nil {
		return h.orderError(c, err, "Failed to dispatch sales order")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) CancelSalesOrder(c *fiber.Ctx) error {
	orderID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(orderID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	var req models.CancelSalesOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Validation failed", "errors": validationErrors(err)})
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || strings.TrimSpace(userID) == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"status": "error", "message": "Unauthorized"})
	}

	result, err := h.command.CancelSalesOrder(c.Context(), orderID, req.Reason, userID)
	if err != nil {
		return h.orderError(c, err, "Failed to cancel sales order")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) ListSalesOrders(c *fiber.Ctx) error {
	status := strings.TrimSpace(c.Query("status"))
	page := int32(c.QueryInt("page", 1))
	pageSize := int32(c.QueryInt("page_size", 20))

	result, err := h.query.ListSalesOrders(c.Context(), status, page, pageSize)
	if err != nil {
		return h.orderError(c, err, "Failed to list sales orders")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) GetSalesOrderDetail(c *fiber.Ctx) error {
	orderID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(orderID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	result, err := h.query.GetSalesOrderDetail(c.Context(), orderID)
	if err != nil {
		return h.orderError(c, err, "Failed to load sales order detail")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) GetOrderAllocations(c *fiber.Ctx) error {
	orderID := strings.TrimSpace(c.Params("id"))
	if err := h.validator.Var(orderID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "id must be a valid UUID"})
	}

	result, err := h.query.GetOrderAllocations(c.Context(), orderID)
	if err != nil {
		return h.orderError(c, err, "Failed to load sales order allocations")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) GetFinishedGoodReservations(c *fiber.Ctx) error {
	itemID := strings.TrimSpace(c.Params("itemId"))
	if err := h.validator.Var(itemID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "itemId must be a valid UUID"})
	}

	result, err := h.query.GetFinishedGoodReservations(c.Context(), itemID)
	if err != nil {
		return h.orderError(c, err, "Failed to load finished good reservations")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) GetBatchReservations(c *fiber.Ctx) error {
	batchCode := strings.TrimSpace(c.Params("code"))
	if batchCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "code is required"})
	}

	result, err := h.query.GetBatchReservations(c.Context(), batchCode)
	if err != nil {
		return h.orderError(c, err, "Failed to load batch reservations")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": result})
}

func (h *OrderHandler) orderError(c *fiber.Ctx, err error, fallback string) error {
	status := fiber.StatusInternalServerError
	message := fallback

	switch {
	case errors.Is(err, services.ErrInvalidSalesOrderPayload),
		errors.Is(err, services.ErrInvalidSalesOrderIdentifier),
		errors.Is(err, services.ErrDispatchSalesOrderFailed),
		errors.Is(err, services.ErrCancelSalesOrderFailed),
		errors.Is(err, services.ErrCreateSalesOrderFailed),
		errors.Is(err, services.ErrSalesOrderDispatchQtyInvalid),
		errors.Is(err, services.ErrInvalidSalesOrderTransition):
		if errors.Is(err, services.ErrDispatchSalesOrderFailed) || errors.Is(err, services.ErrCancelSalesOrderFailed) || errors.Is(err, services.ErrCreateSalesOrderFailed) {
			// keep fallback and 500 for wrapped service failures
		} else {
			status = fiber.StatusBadRequest
			message = err.Error()
		}
	case errors.Is(err, services.ErrSalesOrderNotFound),
		errors.Is(err, services.ErrSalesOrderLineNotFound),
		errors.Is(err, services.ErrFinishedReservationNotFound),
		errors.Is(err, services.ErrBatchReservationNotFound):
		status = fiber.StatusNotFound
		message = err.Error()
	case errors.Is(err, services.ErrSalesOrderStateConflict),
		errors.Is(err, services.ErrSalesOrderInsufficientInventory),
		errors.Is(err, services.ErrSalesOrderAlreadyFinalized):
		status = fiber.StatusConflict
		message = err.Error()
	case errors.Is(err, services.ErrListSalesOrdersFailed),
		errors.Is(err, services.ErrGetSalesOrderDetailFailed),
		errors.Is(err, services.ErrGetBatchReservationsFailed),
		errors.Is(err, services.ErrGetFinishedReservationsFailed):
		message = fallback
	}

	return c.Status(status).JSON(fiber.Map{"status": "error", "message": message})
}
