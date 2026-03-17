package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListVendors returns paginated mock vendors (1L total).
func ListVendors(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("vendor", i),
			"tenant_id":      UUID("tenant", 0),
			"name":           fmt.Sprintf("Vendor %d", i+1),
			"contact_person": fmt.Sprintf("Contact %d", i+1),
			"email":          fmt.Sprintf("vendor%d@mock.com", i+1),
			"phone":          fmt.Sprintf("+1-555-%07d", i),
			"address":        fmt.Sprintf("Address %d", i+1),
			"status_notes":   nil,
			"created_at":     TimestampStr(i),
			"updated_at":     TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListPurchaseOrders returns paginated mock purchase orders (1L total).
func ListPurchaseOrders(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                     UUID("po", i),
			"tenant_id":              UUID("tenant", 0),
			"vendor_id":              UUID("vendor", i%100),
			"po_number":              fmt.Sprintf("PO-%07d", i+1),
			"status":                 []string{"draft", "sent", "received"}[i%3],
			"expected_delivery_date": DateStr(i % 90),
			"total_amount":           NumericStr(1000.0 + float64(i*10)),
			"created_by":             UUID("user", 0),
			"created_at":             TimestampStr(i),
			"updated_at":             TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListPurchaseOrderItems returns paginated mock PO items (1L total).
func ListPurchaseOrderItems(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("poi", i),
			"tenant_id":  UUID("tenant", 0),
			"po_id":      c.Params("id"),
			"product_id": UUID("product", i),
			"quantity":   NumericStr(float64(10 + i%100)),
			"unit_price": NumericStr(25.5 + float64(i%50)),
			"total_price": NumericStr((25.5 + float64(i%50)) * float64(10+i%100)),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListGoodsReceipts returns paginated mock goods receipts (1L total).
func ListGoodsReceipts(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("gr", i),
			"tenant_id":      UUID("tenant", 0),
			"po_id":          UUID("po", i),
			"warehouse_id":   UUID("wh", i%5),
			"receipt_number": fmt.Sprintf("GR-%07d", i+1),
			"receipt_date":   DateStr(i % 90),
			"received_by":   UUID("user", 0),
			"notes":          nil,
			"created_at":    TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListVendorInvoices returns paginated mock vendor invoices (1L total).
func ListVendorInvoices(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("vinv", i),
			"tenant_id":      UUID("tenant", 0),
			"vendor_id":      UUID("vendor", i%100),
			"po_id":          UUID("po", i),
			"invoice_number": fmt.Sprintf("VINV-%07d", i+1),
			"invoice_date":   DateStr(i % 90),
			"due_date":       DateStr((i % 90) + 30),
			"total_amount":   NumericStr(5000.0 + float64(i*20)),
			"status":         []string{"draft", "posted", "paid"}[i%3],
			"notes":          nil,
			"created_at":     TimestampStr(i),
			"tds_section":    nil,
			"tds_rate":       nil,
			"tds_amount":     nil,
			"tds_paid_at":    nil,
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListPurchaseRequisitions returns paginated mock purchase requisitions (1L total).
func ListPurchaseRequisitions(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                     UUID("req", i),
			"tenant_id":              UUID("tenant", 0),
			"req_number":             fmt.Sprintf("REQ-%07d", i+1),
			"department":             "Procurement",
			"requester_id":           UUID("user", 0),
			"status":                 []string{"draft", "approved", "ordered"}[i%3],
			"expected_delivery_date":  DateStr(i % 60),
			"budget":                 NumericStr(10000.0 + float64(i*100)),
			"created_at":             TimestampStr(i),
			"updated_at":             TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListPurchaseRequisitionItems returns paginated mock requisition items (1L total).
func ListPurchaseRequisitionItems(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	reqID := c.Params("id")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("reqi", i),
			"requisition_id": reqID,
			"product_id":     UUID("product", i),
			"quantity":       NumericStr(float64(10 + i%100)),
			"notes":          nil,
			"created_at":     TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}
