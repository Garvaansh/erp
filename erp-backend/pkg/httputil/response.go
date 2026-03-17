package httputil

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
)

// TenantUUID returns tenant_id from Fiber locals as pgtype.UUID. Returns error if missing/invalid.
func TenantUUID(c *fiber.Ctx) (pgtype.UUID, error) {
	raw, ok := c.Locals("tenant_id").(string)
	if !ok || raw == "" {
		return pgtype.UUID{}, fiber.NewError(fiber.StatusUnauthorized, "missing tenant context")
	}
	var u pgtype.UUID
	if err := u.Scan(raw); err != nil {
		return pgtype.UUID{}, fiber.NewError(fiber.StatusBadRequest, "invalid tenant id")
	}
	return u, nil
}

// LimitOffset parses limit and offset from query. Default limit 50, max 200. Offset default 0.
func LimitOffset(c *fiber.Ctx) (limit, offset int32) {
	limit = 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 32); err == nil && n > 0 {
			limit = int32(n)
			if limit > 200 {
				limit = 200
			}
		}
	}
	offset = 0
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.ParseInt(o, 10, 32); err == nil && n >= 0 {
			offset = int32(n)
		}
	}
	return limit, offset
}

// ErrNotFound is used when a resource is not found (404).
var ErrNotFound = errors.New("not found")
