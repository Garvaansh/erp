package mock

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// TotalMockRecords is the total number of mock records reported for list endpoints (1 lakh).
const TotalMockRecords = 100_000

const defaultLimit = 50
const maxLimit = 500

// LimitOffset parses limit and offset from query. Default limit 50, max 500. Offset default 0.
func LimitOffset(c *fiber.Ctx) (limit, offset int) {
	limit = defaultLimit
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			if n > maxLimit {
				n = maxLimit
			}
			limit = n
		}
	}
	offset = 0
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}
	return limit, offset
}
