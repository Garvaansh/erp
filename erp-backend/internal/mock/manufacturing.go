package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListBOMs returns paginated mock BOMs (1L total).
func ListBOMs(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("bom", i),
			"tenant_id":  UUID("tenant", 0),
			"product_id": UUID("product", i),
			"name":       fmt.Sprintf("BOM %d", i+1),
			"version":    "1.0",
			"is_active":  true,
			"created_at": TimestampStr(i),
			"updated_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListWorkOrders returns paginated mock work orders (1L total).
func ListWorkOrders(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                UUID("wo", i),
			"tenant_id":        UUID("tenant", 0),
			"wo_number":        fmt.Sprintf("WO-%07d", i+1),
			"bom_id":            UUID("bom", i),
			"product_id":        UUID("product", i),
			"sales_order_id":   UUID("so", i),
			"status":           []string{"planned", "in_progress", "completed"}[i%3],
			"planned_quantity":  NumericStr(float64(100 + i%500)),
			"produced_quantity": NumericStr(float64((100 + i%500) * (i % 100) / 100)),
			"start_date":       DateStr(i % 90),
			"end_date":         DateStr((i % 90) + 7),
			"created_by":       UUID("user", 0),
			"created_at":       TimestampStr(i),
			"updated_at":       TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListProductionLogsByWorkOrder returns paginated mock production logs (1L total).
func ListProductionLogsByWorkOrder(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":            UUID("plog", i),
			"tenant_id":     UUID("tenant", 0),
			"work_order_id": c.Params("id"),
			"warehouse_id":  UUID("wh", i%5),
			"quantity":      NumericStr(float64(10 + i%50)),
			"produced_at":   TimestampStr(i),
			"recorded_by":   UUID("user", 0),
			"notes":         nil,
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListMaterialConsumptionByWorkOrder returns paginated mock material consumption (1L total).
func ListMaterialConsumptionByWorkOrder(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":            UUID("mcons", i),
			"tenant_id":     UUID("tenant", 0),
			"work_order_id": c.Params("id"),
			"product_id":    UUID("product", i),
			"warehouse_id":  UUID("wh", i%5),
			"quantity":      NumericStr(float64(5 + i%30)),
			"consumed_at":   TimestampStr(i),
			"recorded_by":   UUID("user", 0),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListProductionLines returns mock production lines.
func ListProductionLines(c *fiber.Ctx) error {
	list := []map[string]interface{}{
		{"id": UUID("pline", 0), "tenant_id": UUID("tenant", 0), "name": "Line A", "description": "Assembly Line A", "created_at": TimestampStr(0)},
		{"id": UUID("pline", 1), "tenant_id": UUID("tenant", 0), "name": "Line B", "description": "Assembly Line B", "created_at": TimestampStr(0)},
	}
	return c.JSON(list)
}

// ListProductionOrders returns paginated mock production orders.
func ListProductionOrders(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                 UUID("po", i),
			"tenant_id":         UUID("tenant", 0),
			"po_number":         fmt.Sprintf("PO-%07d", i+1),
			"product_id":        UUID("product", i),
			"quantity":          NumericStr(float64(100 + i)),
			"start_date":        DateStr(i % 30),
			"end_date":          DateStr((i % 30) + 5),
			"production_line_id": UUID("pline", i%2),
			"status":            []string{"PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETED"}[i%4],
			"created_by":        UUID("user", 0),
			"created_at":        TimestampStr(i),
			"updated_at":        TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListMachines returns mock machines.
func ListMachines(c *fiber.Ctx) error {
	list := make([]map[string]interface{}, 0, 6)
	for i := 0; i < 6; i++ {
		list = append(list, map[string]interface{}{
			"id":                 UUID("machine", i),
			"tenant_id":          UUID("tenant", 0),
			"production_line_id": UUID("pline", i%2),
			"name":               fmt.Sprintf("Machine %d", i+1),
			"created_at":         TimestampStr(i),
		})
	}
	return c.JSON(list)
}

// ListBOMItemsByBOM returns mock BOM items for a BOM.
func ListBOMItemsByBOM(c *fiber.Ctx) error {
	list := make([]map[string]interface{}, 0, 5)
	for i := 0; i < 5; i++ {
		list = append(list, map[string]interface{}{
			"id":                    UUID("bomitem", i),
			"tenant_id":             UUID("tenant", 0),
			"bom_id":                c.Params("bomId"),
			"component_product_id":  UUID("product", i+10),
			"quantity":              NumericStr(float64(2 + i)),
			"instructions":          nil,
			"created_at":            TimestampStr(i),
		})
	}
	return c.JSON(list)
}

// ListQualityInspectionsByWorkOrder returns mock quality inspections.
func ListQualityInspectionsByWorkOrder(c *fiber.Ctx) error {
	list := []map[string]interface{}{
		{"id": UUID("qi", 0), "tenant_id": UUID("tenant", 0), "work_order_id": c.Params("id"), "result": "PASS", "inspector_id": UUID("user", 0), "notes": nil, "inspected_at": TimestampStr(0), "created_at": TimestampStr(0)},
	}
	return c.JSON(list)
}

// GetMRPReport returns mock MRP material requirements.
func GetMRPReport(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"production_orders_count": 10,
		"material_requirements": []map[string]interface{}{
			{"product_id": UUID("product", 1), "required_quantity": 500.0, "production_order_numbers": []string{"PO-0000001", "PO-0000002"}},
			{"product_id": UUID("product", 2), "required_quantity": 300.0, "production_order_numbers": []string{"PO-0000001"}},
		},
	})
}

// GetWorkOrder returns a single mock work order (for detail view).
func GetWorkOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(map[string]interface{}{
		"id":                   id,
		"tenant_id":            UUID("tenant", 0),
		"wo_number":            "WO-0000001",
		"bom_id":               UUID("bom", 0),
		"product_id":           UUID("product", 0),
		"sales_order_id":       UUID("so", 0),
		"production_order_id":  UUID("po", 0),
		"status":               "in_progress",
		"planned_quantity":     NumericStr(100),
		"produced_quantity":    NumericStr(45),
		"start_date":           DateStr(0),
		"end_date":             DateStr(7),
		"created_by":           UUID("user", 0),
		"created_at":           TimestampStr(0),
		"updated_at":           TimestampStr(0),
		"operation_type":       nil,
		"sequence":             0,
		"machine_id":           nil,
		"scheduled_start":     nil,
		"scheduled_end":       nil,
	})
}

// GetProductionOrder returns a single mock production order (for detail view).
func GetProductionOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(map[string]interface{}{
		"id":                  id,
		"tenant_id":           UUID("tenant", 0),
		"po_number":           "PO-0000001",
		"product_id":          UUID("product", 0),
		"quantity":            NumericStr(200),
		"start_date":          DateStr(0),
		"end_date":            DateStr(5),
		"production_line_id":  UUID("pline", 0),
		"status":              "RELEASED",
		"created_by":          UUID("user", 0),
		"created_at":          TimestampStr(0),
		"updated_at":          TimestampStr(0),
	})
}

// ListWorkOrdersByProductionOrderID returns paginated mock work orders for a production order (1L total).
func ListWorkOrdersByProductionOrderID(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	poID := c.Params("id")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                   UUID("wo", i),
			"tenant_id":            UUID("tenant", 0),
			"production_order_id":  poID,
			"wo_number":            fmt.Sprintf("WO-%07d", i+1),
			"bom_id":               UUID("bom", i),
			"product_id":           UUID("product", i),
			"sales_order_id":      nil,
			"status":               []string{"planned", "in_progress", "completed"}[i%3],
			"planned_quantity":     NumericStr(float64(50 + i%100)),
			"produced_quantity":    NumericStr(float64((50 + i%100) * (i % 100) / 100)),
			"start_date":          DateStr(i % 30),
			"end_date":            DateStr((i % 30) + 5),
			"created_by":          UUID("user", 0),
			"created_at":          TimestampStr(i),
			"updated_at":          TimestampStr(i),
			"operation_type":      nil,
			"sequence":            i,
			"machine_id":          nil,
			"scheduled_start":     nil,
			"scheduled_end":       nil,
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}
