package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// ListCustomers returns paginated mock customers (1L total).
func ListCustomers(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":               UUID("customer", i),
			"tenant_id":        UUID("tenant", 0),
			"name":             fmt.Sprintf("Customer %d", i+1),
			"contact_person":   fmt.Sprintf("Contact %d", i+1),
			"email":            fmt.Sprintf("customer%d@mock.com", i+1),
			"phone":            fmt.Sprintf("+1-555-%07d", i),
			"billing_address":  fmt.Sprintf("Billing %d", i+1),
			"shipping_address": fmt.Sprintf("Shipping %d", i+1),
			"tax_id":           nil,
			"created_at":       TimestampStr(i),
			"updated_at":       TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListSalesOrders returns paginated mock sales orders (1L total).
func ListSalesOrders(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                      UUID("so", i),
			"tenant_id":               UUID("tenant", 0),
			"customer_id":             UUID("customer", i%100),
			"so_number":               fmt.Sprintf("SO-%07d", i+1),
			"status":                  []string{"draft", "confirmed", "shipped", "invoiced"}[i%4],
			"expected_shipping_date":  DateStr(i % 60),
			"total_amount":            NumericStr(500.0 + float64(i*5)),
			"created_by":              UUID("user", 0),
			"created_at":              TimestampStr(i),
			"updated_at":              TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListSalesOrderItems returns paginated mock SO items (1L total).
func ListSalesOrderItems(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":         UUID("soi", i),
			"tenant_id":  UUID("tenant", 0),
			"so_id":      c.Params("id"),
			"product_id": UUID("product", i),
			"quantity":   NumericStr(float64(5 + i%50)),
			"unit_price": NumericStr(30.0 + float64(i%40)),
			"total_price": NumericStr((30.0 + float64(i%40)) * float64(5+i%50)),
			"created_at": TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListInvoices returns paginated mock invoices (1L total).
func ListInvoices(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":             UUID("inv", i),
			"tenant_id":      UUID("tenant", 0),
			"customer_id":    UUID("customer", i%100),
			"so_id":          UUID("so", i),
			"invoice_number": fmt.Sprintf("INV-%07d", i+1),
			"invoice_date":   DateStr(i % 90),
			"due_date":       DateStr((i % 90) + 30),
			"total_amount":   NumericStr(1000.0 + float64(i*2)),
			"status":         []string{"draft", "sent", "paid"}[i%3],
			"created_at":     TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListInvoicePayments returns paginated mock payments for an invoice (1L total).
func ListInvoicePayments(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":                UUID("pay", i),
			"tenant_id":         UUID("tenant", 0),
			"invoice_id":        c.Params("id"),
			"amount":            NumericStr(500.0 + float64(i)),
			"payment_date":      DateStr(i % 30),
			"payment_method":   "bank_transfer",
			"reference_number": fmt.Sprintf("REF-%07d", i+1),
			"recorded_by":       UUID("user", 0),
			"created_at":        TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListInvoiceLineItems returns paginated mock invoice line items (1L total).
func ListInvoiceLineItems(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":          UUID("invline", i),
			"tenant_id":   UUID("tenant", 0),
			"invoice_id":  c.Params("id"),
			"description": fmt.Sprintf("Item %d", i+1),
			"quantity":    NumericStr(float64(1 + i%20)),
			"unit_price":  NumericStr(50.0 + float64(i%30)),
			"total_line":  NumericStr((50.0 + float64(i%30)) * float64(1+i%20)),
			"sort_order":  i,
			"created_at":  TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// ListShipments returns paginated mock shipments (1L total).
func ListShipments(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":               UUID("ship", i),
			"tenant_id":        UUID("tenant", 0),
			"shipment_number":  fmt.Sprintf("SHP-%07d", i+1),
			"sales_order_id":   UUID("so", i),
			"warehouse_id":     UUID("wh", i%5),
			"carrier_name":     "Mock Carrier",
			"tracking_number":  fmt.Sprintf("TRK%010d", i),
			"status":           []string{"pending", "shipped", "delivered"}[i%3],
			"shipped_at":       nil,
			"delivered_at":     nil,
			"created_by":       UUID("user", 0),
			"created_at":       TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// GetShipment returns a single mock shipment (for detail view).
func GetShipment(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(map[string]interface{}{
		"id":               id,
		"tenant_id":        UUID("tenant", 0),
		"shipment_number":  "SHP-0000001",
		"sales_order_id":   UUID("so", 0),
		"warehouse_id":     UUID("wh", 0),
		"carrier_name":     "Mock Carrier",
		"tracking_number":  "TRK0000000001",
		"status":           "shipped",
		"shipped_at":       TimestampStr(0),
		"delivered_at":     nil,
		"created_by":       UUID("user", 0),
		"created_at":       TimestampStr(0),
	})
}

// ListShipmentLines returns paginated mock shipment lines (1L total).
func ListShipmentLines(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	shipID := c.Params("id")
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":          UUID("shipline", i),
			"shipment_id": shipID,
			"product_id":  UUID("product", i),
			"quantity":    NumericStr(float64(10 + i%50)),
			"created_at":  TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(list)
}

// GetNextInvoiceNumber returns mock next invoice number for the tenant.
func GetNextInvoiceNumber(c *fiber.Ctx) error {
	return c.JSON(map[string]interface{}{
		"suggested":   "INV-2026-100001",
		"next_number": "INV-2026-100001",
		"year":        2026,
	})
}
