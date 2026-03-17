package audit

import (
	"context"
	"encoding/json"
	"log"
	"net/netip"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
)

// Log records an audit entry. oldValue and newValue can be nil or JSON bytes.
// If c is non-nil, IP and User-Agent are taken from the request.
// Errors are logged but not returned so audit never fails the main operation.
func Log(ctx context.Context, tenantID, userID pgtype.UUID, entityType string, entityID pgtype.UUID, operation string, oldValue, newValue []byte, c *fiber.Ctx) {
	q := db.New(database.Pool)
	var ip *netip.Addr
	var userAgent pgtype.Text
	if c != nil {
		if addr, err := netip.ParseAddr(c.IP()); err == nil {
			ip = &addr
		}
		ua := c.Get("User-Agent")
		if ua != "" {
			userAgent.Scan(ua)
		}
	}
	_, err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		TenantID:   tenantID,
		UserID:     userID,
		EntityType: entityType,
		EntityID:   entityID,
		Operation:  operation,
		OldValue:   oldValue,
		NewValue:   newValue,
		IpAddress:  ip,
		UserAgent:  userAgent,
	})
	if err != nil {
		log.Printf("[audit] failed to log %s %s %s: %v", operation, entityType, entityID.Bytes, err)
	}
}

// LogFromFiber extracts tenant_id and user_id from fiber context and calls Log.
// Use from handlers: audit.LogFromFiber(c, "product", productID, "CREATE", nil, newJSON).
func LogFromFiber(c *fiber.Ctx, entityType string, entityID pgtype.UUID, operation string, oldValue, newValue []byte) {
	ctx := c.Context()
	tid, _ := c.Locals("tenant_id").(string)
	uid, _ := c.Locals("user_id").(string)
	var tenantID, userID pgtype.UUID
	_ = tenantID.Scan(tid)
	_ = userID.Scan(uid)
	Log(ctx, tenantID, userID, entityType, entityID, operation, oldValue, newValue, c)
}

// ToJSON marshals v to JSON for audit old_value/new_value. Returns nil on error.
func ToJSON(v interface{}) []byte {
	if v == nil {
		return nil
	}
	b, _ := json.Marshal(v)
	return b
}
