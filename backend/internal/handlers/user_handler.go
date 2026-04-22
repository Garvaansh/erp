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

type userQueryService interface {
	ListUsers(ctx context.Context, filter string, search string) ([]models.UserListRow, error)
	GetUserByID(ctx context.Context, userID string, requesterID string, requesterRoleCode string) (*models.UserSafeProfile, error)
}

type userCommandService interface {
	CreateUser(ctx context.Context, req models.CreateUserRequest) (*models.UserCreateResult, error)
	UpdateUser(ctx context.Context, userID string, req models.UpdateUserRequest) error
	ChangePassword(ctx context.Context, userID string, req models.ChangePasswordRequest) error
}

type UserHandler struct {
	query     userQueryService
	command   userCommandService
	validator *validator.Validate
}

func NewUserHandler(query userQueryService, command userCommandService, v *validator.Validate) *UserHandler {
	return &UserHandler{query: query, command: command, validator: v}
}

func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	filter := strings.TrimSpace(c.Query("filter"))
	search := strings.TrimSpace(c.Query("search"))
	users, err := h.query.ListUsers(c.Context(), filter, search)
	if err != nil {
		if errors.Is(err, services.ErrInvalidUserFilter) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to fetch users",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   users,
	})
}

func (h *UserHandler) CreateUser(c *fiber.Ctx) error {
	var req models.CreateUserRequest
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

	result, err := h.command.CreateUser(c.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrUserAlreadyExists):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"status":  "error",
				"message": "A user with this email already exists",
			})
		case errors.Is(err, services.ErrRoleNotFound):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "Invalid role code",
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to create user",
			})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   result,
	})
}

func (h *UserHandler) UpdateUser(c *fiber.Ctx) error {
	userID := strings.TrimSpace(c.Params("userId"))
	if err := h.validator.Var(userID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "userId must be a valid UUID",
		})
	}

	var req models.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid JSON payload",
		})
	}

	err := h.command.UpdateUser(c.Context(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrUserNotFoundByID):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"status":  "error",
				"message": "User not found",
			})
		case errors.Is(err, services.ErrRoleNotFound):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"status":  "error",
				"message": "Invalid role code",
			})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"status":  "error",
				"message": "Failed to update user",
			})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "User updated successfully",
	})
}

func (h *UserHandler) GetUserByID(c *fiber.Ctx) error {
	userID := strings.TrimSpace(c.Params("userId"))
	if err := h.validator.Var(userID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "userId must be a valid UUID",
		})
	}

	requesterID, _ := c.Locals("userID").(string)
	requesterRoleCode, _ := c.Locals("roleCode").(string)
	user, err := h.query.GetUserByID(c.Context(), userID, requesterID, requesterRoleCode)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrForbidden):
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"status": "error", "message": "Forbidden"})
		case errors.Is(err, services.ErrUserNotFoundByID):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "User not found"})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to fetch user"})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "data": user})
}

func (h *UserHandler) ChangePassword(c *fiber.Ctx) error {
	userID := strings.TrimSpace(c.Params("userId"))
	if err := h.validator.Var(userID, "required,uuid4"); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "userId must be a valid UUID",
		})
	}

	var req models.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid JSON payload"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Validation failed",
			"errors":  validationErrors(err),
		})
	}

	if err := h.command.ChangePassword(c.Context(), userID, req); err != nil {
		switch {
		case errors.Is(err, services.ErrUserNotFoundByID):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "User not found"})
		case errors.Is(err, services.ErrInvalidUserPayload):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid password payload"})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to change password"})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "success", "message": "Password updated successfully"})
}
