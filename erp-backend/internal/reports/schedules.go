package reports

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

// ListSchedules returns GET /reports/schedules
func ListSchedules(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListSchedules(c)
	}
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	q := db.New(database.Pool)
	list, err := q.ListScheduledReports(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list schedules"})
	}
	return c.JSON(fiber.Map{"schedules": list})
}

// CreateSchedule expects JSON: name, report_type, frequency (daily|weekly|monthly), export_format (csv|excel), recipient_email, start_date?, end_date?
func CreateSchedule(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw, ok := c.Locals("user_id").(string)
	if !ok || userIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User context required"})
	}
	var userID pgtype.UUID
	_ = userID.Scan(userIDRaw)

	var body struct {
		Name           string            `json:"name"`
		ReportType     string            `json:"report_type"`
		Frequency      string            `json:"frequency"`
		ExportFormat   string            `json:"export_format"`
		RecipientEmail string            `json:"recipient_email"`
		Parameters     map[string]string `json:"parameters"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON"})
	}
	if body.Name == "" || body.ReportType == "" || body.Frequency == "" || body.RecipientEmail == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, report_type, frequency, recipient_email required"})
	}
	if body.ExportFormat == "" {
		body.ExportFormat = "csv"
	}
	if body.ExportFormat != "csv" && body.ExportFormat != "excel" {
		body.ExportFormat = "csv"
	}
	paramsJSON, _ := json.Marshal(body.Parameters)
	if body.Parameters == nil {
		paramsJSON = []byte("{}")
	}

	nextRun := nextRunFromFrequency(body.Frequency)
	var nextRunTs pgtype.Timestamptz
	nextRunTs.Scan(nextRun)

	q := db.New(database.Pool)
	schedule, err := q.CreateScheduledReport(c.Context(), db.CreateScheduledReportParams{
		TenantID:       tenantID,
		CreatedBy:      userID,
		Name:           body.Name,
		ReportType:     body.ReportType,
		Frequency:      body.Frequency,
		ExportFormat:   body.ExportFormat,
		RecipientEmail: body.RecipientEmail,
		Parameters:     paramsJSON,
		NextRunAt:      nextRunTs,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create schedule"})
	}
	return c.Status(fiber.StatusCreated).JSON(schedule)
}

func nextRunFromFrequency(freq string) time.Time {
	now := time.Now().UTC()
	switch freq {
	case "daily":
		return now.AddDate(0, 0, 1).Truncate(24 * time.Hour)
	case "weekly":
		return now.AddDate(0, 0, 7)
	case "monthly":
		return now.AddDate(0, 1, 0)
	default:
		return now.AddDate(0, 0, 1)
	}
}

// DeleteSchedule DELETE /reports/schedules/:id
func DeleteSchedule(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	idStr := c.Params("id")
	if idStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}
	q := db.New(database.Pool)
	err = q.DeleteScheduledReport(c.Context(), db.DeleteScheduledReportParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete schedule"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
