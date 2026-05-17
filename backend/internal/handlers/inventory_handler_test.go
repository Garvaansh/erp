package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

func TestMapInventoryError_InvalidBatchStatus(t *testing.T) {
	app := fiber.New()
	app.Get("/test", func(c *fiber.Ctx) error {
		return mapInventoryError(c, services.ErrInvalidBatchStatus)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}
}

func TestMapInventoryError_InvalidBatchFlow(t *testing.T) {
	app := fiber.New()
	app.Get("/test", func(c *fiber.Ctx) error {
		return mapInventoryError(c, services.ErrInvalidBatchFlow)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req)

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}
}
