package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListCoilConsumptionLogs returns paginated mock coil consumption logs (1L total).
func ListCoilConsumptionLogs(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("coil", i),
			"tenant_id":      UUID("tenant", 0),
			"product_id":     UUID("product", i),
			"operation_date": DateStr(i % 365),
			"starting_kg":    NumericStr(500.0 + float64(i%200)),
			"scrap_kg":       NumericStr(float64(i % 5)),
			"shortlength_kg": NumericStr(float64(i % 3)),
			"used_kg":        NumericStr(100.0 + float64(i%150)),
			"remaining_kg":   NumericStr(400.0 - float64(i%100)),
			"coil_ended":     i%10 == 0,
			"notes":          nil,
			"created_by":     UUID("user", 0),
			"created_at":     TimestampStr(i),
			"product_name":   fmt.Sprintf("Coil Product %d", i+1),
			"product_sku":    fmt.Sprintf("COIL-%07d", i+1),
			"product_type":   "coil",
			"uom":            "KG",
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListCoilConsumptionLogsByProduct returns paginated mock coil logs for a product (1L total).
func ListCoilConsumptionLogsByProduct(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("coil", i),
			"tenant_id":      UUID("tenant", 0),
			"product_id":     c.Params("productId"),
			"operation_date": DateStr(i % 365),
			"starting_kg":    NumericStr(500.0),
			"scrap_kg":       NumericStr(2),
			"shortlength_kg": NumericStr(1),
			"used_kg":        NumericStr(100.0 + float64(i%50)),
			"remaining_kg":   NumericStr(397.0 - float64(i%50)),
			"coil_ended":     i%5 == 0,
			"notes":          nil,
			"created_by":     UUID("user", 0),
			"created_at":     TimestampStr(i),
			"product_name":   "Coil Product",
			"product_sku":    "COIL-001",
			"product_type":   "coil",
			"uom":            "KG",
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// GetLastCoilRemaining returns mock last remaining kg for a product (for coil consumption form).
func GetLastCoilRemaining(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"remaining_kg": NumericStr(250.5),
	})
}

// ListPurchaseHistory returns paginated mock purchase history rows (1L total).
func ListPurchaseHistory(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"po_id":               UUID("po", i),
			"po_number":           fmt.Sprintf("PO-%07d", i+1),
			"order_date":          DateStr(i % 90),
			"vendor_id":           UUID("vendor", i%100),
			"vendor_name":         fmt.Sprintf("Vendor %d", (i%100)+1),
			"vendor_status_notes": nil,
			"product_id":          UUID("product", i),
			"product_name":        fmt.Sprintf("Product %d", i+1),
			"product_sku":         fmt.Sprintf("SKU-%07d", i+1),
			"product_type":        "raw",
			"uom":                 "EA",
			"quantity":            NumericStr(float64(50 + i%200)),
			"unit_price":          NumericStr(25.0 + float64(i%25)),
			"total_price":         NumericStr((25.0 + float64(i%25)) * float64(50+i%200)),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListStockLevelsWithReva returns paginated mock stock levels with Reva fields (1L total).
func ListStockLevelsWithReva(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"product_id":   UUID("product", i),
			"product_name": fmt.Sprintf("Product %d", i+1),
			"product_sku":  fmt.Sprintf("SKU-%07d", i+1),
			"product_type": "coil",
			"stock_status": "in_stock",
			"tr_notes":     nil,
			"uom":          "KG",
			"brand":        []string{"RIR", "Jindal", ""}[i%3],
			"category_id":  UUID("cat", i%8),
			"total_stock":  NumericStr(float64(1000 + i%2000)),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}
