package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListAuditLogs returns paginated mock audit logs (1L total).
func ListAuditLogs(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	ops := []string{"CREATE", "UPDATE", "DELETE", "VIEW"}
	entities := []string{"product", "vendor", "customer", "sales_order", "purchase_order", "invoice", "work_order"}
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":           UUID("audit", i),
			"tenant_id":    UUID("tenant", 0),
			"user_id":      UUID("user", i%5),
			"entity_type":  entities[i%len(entities)],
			"entity_id":    UUID(entities[i%len(entities)], i),
			"operation":    ops[i%len(ops)],
			"old_value":    nil,
			"new_value":    nil,
			"ip_address":   nil,
			"user_agent":   "Mock Agent",
			"created_at":   TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListAuditLogsByEntity returns paginated mock audit logs for an entity (1L total).
func ListAuditLogsByEntity(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	entityType := c.Query("type")
	entityID := c.Query("id")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":          UUID("audit", i),
			"tenant_id":   UUID("tenant", 0),
			"user_id":     UUID("user", 0),
			"entity_type": entityType,
			"entity_id":   entityID,
			"operation":   []string{"CREATE", "UPDATE", "DELETE"}[i%3],
			"old_value":   nil,
			"new_value":   nil,
			"ip_address":  nil,
			"user_agent":  "Mock Agent",
			"created_at":  TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}
