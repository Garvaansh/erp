package audit

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

// ListAuditLogs returns paginated audit logs for the tenant.
// Query: limit (default 50), offset (default 0).
func ListAuditLogs(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListAuditLogs(c)
	}
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	limit := int32(50)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 32); err == nil && n > 0 && n <= 200 {
			limit = int32(n)
		}
	}
	offset := int32(0)
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.ParseInt(o, 10, 32); err == nil && n >= 0 {
			offset = int32(n)
		}
	}

	q := db.New(database.Pool)
	logs, err := q.ListAuditLogs(c.Context(), db.ListAuditLogsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load audit logs"})
	}
	return c.JSON(logs)
}

// ListAuditLogsByEntity returns audit logs for a specific entity (e.g. product, vendor).
// Params: type (entity_type), id (entity_id). Query: limit, offset.
func ListAuditLogsByEntity(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListAuditLogsByEntity(c)
	}
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	entityType := c.Query("type")
	entityIDRaw := c.Query("id")
	if entityType == "" || entityIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query params 'type' and 'id' required"})
	}
	entityID, err := toUUID(entityIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid entity id"})
	}

	limit := int32(50)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 32); err == nil && n > 0 && n <= 200 {
			limit = int32(n)
		}
	}
	offset := int32(0)
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.ParseInt(o, 10, 32); err == nil && n >= 0 {
			offset = int32(n)
		}
	}

	q := db.New(database.Pool)
	logs, err := q.ListAuditLogsByEntity(c.Context(), db.ListAuditLogsByEntityParams{
		TenantID:   tenantID,
		EntityType: entityType,
		EntityID:   entityID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load audit logs"})
	}
	return c.JSON(logs)
}
