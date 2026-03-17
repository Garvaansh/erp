package inventory

import (
	"log"

	"github.com/gofiber/fiber/v2"
	qrcode "github.com/skip2/go-qrcode"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

// QR payload: product ID so scanners can look up product and stock
const qrDefaultSize = 256

// GetProductQRCode returns a PNG QR code encoding the product ID for inventory scanning.
// Query: size (optional, default 256) - pixel size of the image.
func GetProductQRCode(c *fiber.Ctx) error {
	productIDRaw := c.Params("id")
	if productIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Product ID required"})
	}

	size := qrDefaultSize
	if s := c.Query("size"); s != "" {
		if n, err := parseInt32(s); err == nil && n >= 64 && n <= 512 {
			size = int(n)
		}
	}

	// In mock mode we still generate a valid QR for the given ID (no DB lookup)
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		png, err := qrcode.Encode(productIDRaw, qrcode.Medium, size)
		if err != nil {
			log.Printf("GetProductQRCode mock encode: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate QR code"})
		}
		c.Set("Content-Type", "image/png")
		c.Set("Cache-Control", "private, max-age=300")
		return c.Send(png)
	}

	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	q := db.New(database.Pool)
	_, err = q.GetProduct(c.Context(), db.GetProductParams{
		ID:       productID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	// Encode product ID (UUID string) so scanners can call /inventory/products/by-scan?id=...
	idStr := productIDRaw
	png, err := qrcode.Encode(idStr, qrcode.Medium, size)
	if err != nil {
		log.Printf("GetProductQRCode encode: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate QR code"})
	}

	c.Set("Content-Type", "image/png")
	c.Set("Cache-Control", "private, max-age=300")
	return c.Send(png)
}

// GetProductByScan returns product details and current stock for a scanned product ID.
// Used by inventory apps: scan QR (contains product ID) -> call this with id= -> show details / record transaction.
// GET /inventory/products/by-scan?id=<product_id>
func GetProductByScan(c *fiber.Ctx) error {
	productIDRaw := c.Query("id")
	if productIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query parameter id (product ID) is required"})
	}

	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		// Mock: return a generic product with the scanned id and fake stock
		return c.JSON(fiber.Map{
			"product": fiber.Map{
				"id":             productIDRaw,
				"tenant_id":      mock.UUID("tenant", 0),
				"category_id":    nil,
				"name":           "Mock Product (scanned)",
				"sku":            "SKU-SCANNED",
				"price":          mock.NumericStr(99.5),
				"reorder_point":  mock.NumericStr(10),
				"safety_stock":   mock.NumericStr(5),
				"lead_time_days": 7,
				"uom":            "EA",
				"product_type":   nil,
				"stock_status":   "In stock",
				"tr_notes":       nil,
				"brand":          nil,
				"created_at":     mock.TimestampStr(0),
				"updated_at":     mock.TimestampStr(0),
			},
			"stock_level": mock.NumericStr(100),
		})
	}

	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	q := db.New(database.Pool)
	product, err := q.GetProduct(c.Context(), db.GetProductParams{
		ID:       productID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	stock, _ := q.GetProductStock(c.Context(), db.GetProductStockParams{
		ProductID: productID,
		TenantID:  tenantID,
	})

	return c.JSON(fiber.Map{
		"product":      product,
		"stock_level":  stock,
	})
}
