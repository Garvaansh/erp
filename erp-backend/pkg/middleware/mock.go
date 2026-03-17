package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// MockDataKey is the key used in c.Locals for mock data mode.
const MockDataKey = "mock_data"

// MockData reads X-Mock-Data header. If it is "true" or "1", sets c.Locals("mock_data", true).
// Use after JWT so tenant_id is available. When true, list handlers may return paginated mock data (1L total).
func MockData() fiber.Handler {
	return func(c *fiber.Ctx) error {
		v := strings.TrimSpace(strings.ToLower(c.Get("X-Mock-Data", "")))
		c.Locals(MockDataKey, v == "true" || v == "1")
		return c.Next()
	}
}
