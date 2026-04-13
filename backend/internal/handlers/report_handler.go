package handlers

import (
	"net/http"
	"strconv"

	"github.com/erp/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type ReportHandler struct {
	service *services.ReportService
}

func NewReportHandler(service *services.ReportService) *ReportHandler {
	return &ReportHandler{service: service}
}

func (h *ReportHandler) GetInventoryReport(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	report, err := h.service.GetInventoryReport(c.Context(), days)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error", "message": "Failed to generate inventory report",
		})
	}
	return c.Status(http.StatusOK).JSON(fiber.Map{"status": "success", "data": report})
}

func (h *ReportHandler) GetPurchaseReport(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	report, err := h.service.GetPurchaseReport(c.Context(), days)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error", "message": "Failed to generate purchase report",
		})
	}
	return c.Status(http.StatusOK).JSON(fiber.Map{"status": "success", "data": report})
}

func (h *ReportHandler) GetUsersReport(c *fiber.Ctx) error {
	report, err := h.service.GetUsersReport(c.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error", "message": "Failed to generate users report",
		})
	}
	return c.Status(http.StatusOK).JSON(fiber.Map{"status": "success", "data": report})
}
