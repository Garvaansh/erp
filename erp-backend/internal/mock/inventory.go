package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListProducts returns paginated mock products (1L total).
func ListProducts(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("product", i),
			"tenant_id":      UUID("tenant", 0),
			"category_id":    nil,
			"name":           fmt.Sprintf("Mock Product %d", i+1),
			"sku":            fmt.Sprintf("SKU-%07d", i+1),
			"price":          NumericStr(10.5 + float64(i%100)),
			"reorder_point":  NumericStr(10),
			"safety_stock":   NumericStr(5),
			"lead_time_days": 7,
			"uom":            "EA",
			"product_type":   nil,
			"stock_status":   nil,
			"tr_notes":       nil,
			"brand":          nil,
			"created_at":     TimestampStr(i),
			"updated_at":     TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListProductCategories returns mock Reva product categories.
func ListProductCategories(c *fiber.Ctx) error {
	names := []string{"Rubber Profile", "Rubber Seal", "Rubber Beadings", "Rubber Extrusion", "Elastomeric Bridge Bearings", "Stainless Steel Pipe", "Curtain Rods", "PVC Products"}
	list := make([]map[string]interface{}, 0, len(names))
	for i, n := range names {
		list = append(list, map[string]interface{}{
			"id":          UUID("cat", i),
			"tenant_id":   UUID("tenant", 0),
			"name":        n,
			"description": "",
			"created_at":  TimestampStr(0),
		})
	}
	return c.JSON(list)
}

// ListWarehouses returns paginated mock warehouses (1L total).
func ListWarehouses(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("wh", i),
			"tenant_id":  UUID("tenant", 0),
			"name":       fmt.Sprintf("Warehouse %d", i+1),
			"location":   fmt.Sprintf("Location %d", i+1),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListStockLevels returns paginated mock stock levels (1L total).
func ListStockLevels(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"product_id":   UUID("product", i),
			"product_name": fmt.Sprintf("Product %d", i+1),
			"product_sku":  fmt.Sprintf("SKU-%07d", i+1),
			"total_stock":  NumericStr(float64(100 + i%500)),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListStockByWarehouse returns paginated mock stock-by-warehouse rows (1L total).
func ListStockByWarehouse(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"product_id":    UUID("product", i),
			"product_name":  fmt.Sprintf("Product %d", i+1),
			"warehouse_id":  UUID("wh", i%10),
			"warehouse_name": fmt.Sprintf("WH %d", (i%10)+1),
			"quantity":      NumericStr(float64(50 + i%200)),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListLowStockAlerts returns paginated mock low-stock alerts (1L total).
func ListLowStockAlerts(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"product_id":    UUID("product", i),
			"product_name":  fmt.Sprintf("Product %d", i+1),
			"product_sku":   fmt.Sprintf("SKU-%07d", i+1),
			"reorder_point": NumericStr(10),
			"safety_stock":  NumericStr(5),
			"uom":           "EA",
			"current_stock": NumericStr(float64(i % 10)),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListTransactions returns paginated mock inventory transactions (1L total).
func ListTransactions(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                UUID("tx", i),
			"tenant_id":         UUID("tenant", 0),
			"product_id":        UUID("product", i%200),
			"warehouse_id":      UUID("wh", i%5),
			"batch_id":         nil,
			"transaction_type":  []string{"IN", "OUT"}[i%2],
			"quantity":         NumericStr(float64(10 + i%100)),
			"reference_id":     nil,
			"notes":            nil,
			"created_by":       UUID("user", 0),
			"created_at":       TimestampStr(i),
			"transaction_reason": nil,
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// GetInventoryKpis returns mock KPI aggregates for the inventory module.
func GetInventoryKpis(c *fiber.Ctx) error {
	return c.JSON(map[string]interface{}{
		"total_skus":            1250,
		"total_inventory_value": NumericStr(48250000.75),
		"low_stock_items":       42,
		"out_of_stock_items":    18,
		"reserved_qty":          NumericStr(3250),
		"in_transit_qty":        NumericStr(980),
		"dead_stock_items":      27,
	})
}

// ListBatches returns paginated mock batches for a product (1L total).
func ListBatches(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                UUID("batch", i),
			"tenant_id":         UUID("tenant", 0),
			"product_id":        c.Params("productID"),
			"batch_number":      fmt.Sprintf("BATCH-%07d", i+1),
			"manufacture_date":  DateStr(i % 365),
			"expiry_date":       DateStr((i % 365) + 365),
			"created_at":        TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListReservations returns paginated mock reservations (1L total).
func ListReservations(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":              UUID("res", i),
			"tenant_id":       UUID("tenant", 0),
			"product_id":      UUID("product", i),
			"warehouse_id":    UUID("wh", i%5),
			"quantity":       NumericStr(float64(5 + i%50)),
			"reference_type": "sales_order",
			"reference_id":   UUID("so", i),
			"status":         "active",
			"reserved_at":    TimestampStr(i),
			"expires_at":     TimestampStr(i + 24),
			"created_by":     UUID("user", 0),
			"created_at":     TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListTransfers returns paginated mock warehouse transfers (1L total).
func ListTransfers(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                UUID("transfer", i),
			"tenant_id":         UUID("tenant", 0),
			"from_warehouse_id": UUID("wh", i%5),
			"to_warehouse_id":   UUID("wh", (i+1)%5),
			"product_id":        UUID("product", i),
			"quantity":         NumericStr(float64(20 + i%100)),
			"status":           []string{"pending", "completed"}[i%2],
			"notes":            nil,
			"created_by":       UUID("user", 0),
			"created_at":       TimestampStr(i),
			"completed_at":     nil,
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListWarehouseZones returns paginated mock zones for a warehouse (1L total).
func ListWarehouseZones(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	whID := c.Params("warehouseId")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":           UUID("zone", i),
			"tenant_id":    UUID("tenant", 0),
			"warehouse_id": whID,
			"code":         fmt.Sprintf("ZONE-%03d", i+1),
			"name":         fmt.Sprintf("Zone %d", i+1),
			"created_at":   TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListWarehouseRacks returns paginated mock racks for a zone (1L total).
func ListWarehouseRacks(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	zoneID := c.Params("zoneId")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("rack", i),
			"zone_id":    zoneID,
			"code":       fmt.Sprintf("RACK-%03d", i+1),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListWarehouseShelves returns paginated mock shelves for a rack (1L total).
func ListWarehouseShelves(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	rackID := c.Params("rackId")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("shelf", i),
			"rack_id":    rackID,
			"code":       fmt.Sprintf("SHLF-%03d", i+1),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListWarehouseBins returns paginated mock bins for a shelf (1L total).
func ListWarehouseBins(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	shelfID := c.Params("shelfId")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("bin", i),
			"shelf_id":   shelfID,
			"code":       fmt.Sprintf("BIN-%03d", i+1),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}
