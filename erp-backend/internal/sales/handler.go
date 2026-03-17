package sales

import (
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	v, err := n.Value()
	if err != nil {
		return 0
	}
	s, ok := v.(string)
	if !ok {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

type CustomerRequest struct {
	Name                string  `json:"name"`
	ContactPerson       *string `json:"contact_person"`
	Email               *string `json:"email"`
	Phone               *string `json:"phone"`
	BillingAddress     *string `json:"billing_address"`
	ShippingAddress     *string `json:"shipping_address"`
	TaxID               *string `json:"tax_id"`
	Gstin               *string `json:"gstin"`
	PlaceOfSupplyState  *string `json:"place_of_supply_state"`
	Pan                 *string `json:"pan"`
}

type SalesOrderRequest struct {
	CustomerID           string `json:"customer_id"`
	SONumber             string `json:"so_number"`
	ExpectedShippingDate string `json:"expected_shipping_date"` // YYYY-MM-DD
	TotalAmount          string `json:"total_amount"`           // numeric string
}

type SalesOrderItemRequest struct {
	SOID       string `json:"so_id"`
	ProductID  string `json:"product_id"`
	Quantity   string `json:"quantity"`
	UnitPrice  string `json:"unit_price"`
	TotalPrice string `json:"total_price"`
}

type InvoiceRequest struct {
	CustomerID          string   `json:"customer_id"`
	SOID                *string  `json:"so_id"`
	InvoiceNumber       string   `json:"invoice_number"`
	InvoiceDate         string   `json:"invoice_date"`
	DueDate             *string  `json:"due_date"`
	TotalAmount         string   `json:"total_amount"`
	Status              string   `json:"status"`
	PlaceOfSupplyState  *string  `json:"place_of_supply_state"`
	InvoiceType         string   `json:"invoice_type"` // TAX_INVOICE, BILL_OF_SUPPLY
	Subtotal            *string  `json:"subtotal"`
	CgstTotal           *string  `json:"cgst_total"`
	SgstTotal           *string  `json:"sgst_total"`
	IgstTotal           *string  `json:"igst_total"`
}

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

func CreateCustomer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req CustomerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var contact, email, phone, billing, shipping, tax pgtype.Text
	if req.ContactPerson != nil {
		contact.Scan(*req.ContactPerson)
	}
	if req.Email != nil {
		email.Scan(*req.Email)
	}
	if req.Phone != nil {
		phone.Scan(*req.Phone)
	}
	if req.BillingAddress != nil {
		billing.Scan(*req.BillingAddress)
	}
	if req.ShippingAddress != nil {
		shipping.Scan(*req.ShippingAddress)
	}
	if req.TaxID != nil {
		tax.Scan(*req.TaxID)
	}
	var gstin, placeOfSupply, pan pgtype.Text
	if req.Gstin != nil {
		gstin.Scan(*req.Gstin)
	}
	if req.PlaceOfSupplyState != nil {
		placeOfSupply.Scan(*req.PlaceOfSupplyState)
	}
	if req.Pan != nil {
		pan.Scan(*req.Pan)
	}

	q := db.New(database.Pool)
	customer, err := q.CreateCustomer(c.Context(), db.CreateCustomerParams{
		TenantID:           tenantID,
		Name:               req.Name,
		ContactPerson:      contact,
		Email:              email,
		Phone:              phone,
		BillingAddress:     billing,
		ShippingAddress:    shipping,
		TaxID:              tax,
		Gstin:              gstin,
		PlaceOfSupplyState: placeOfSupply,
		Pan:                pan,
	})
	if err != nil {
		log.Printf("CreateCustomer error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create customer"})
	}

	return c.Status(fiber.StatusCreated).JSON(customer)
}

// BulkCreateCustomersRequest body for Excel/bulk customer import
type BulkCreateCustomersRequest struct {
	Rows []CustomerRequest `json:"rows"`
}

func BulkCreateCustomers(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req BulkCreateCustomersRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if len(req.Rows) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No rows to import"})
	}
	if len(req.Rows) > 500 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Maximum 500 rows per request"})
	}

	ctx := c.Context()
	tx, err := database.Pool.Begin(ctx)
	if err != nil {
		log.Printf("BulkCreateCustomers begin tx: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start import"})
	}
	defer tx.Rollback(ctx)

	q := db.New(database.Pool).WithTx(tx)
	created := 0
	var firstErr string
	for i := range req.Rows {
		r := &req.Rows[i]
		var contact, email, phone, billing, shipping, tax pgtype.Text
		if r.ContactPerson != nil {
			contact.Scan(*r.ContactPerson)
		}
		if r.Email != nil {
			email.Scan(*r.Email)
		}
		if r.Phone != nil {
			phone.Scan(*r.Phone)
		}
		if r.BillingAddress != nil {
			billing.Scan(*r.BillingAddress)
		}
		if r.ShippingAddress != nil {
			shipping.Scan(*r.ShippingAddress)
		}
		if r.TaxID != nil {
			tax.Scan(*r.TaxID)
		}
		var gstin, placeOfSupply, pan pgtype.Text
		if r.Gstin != nil {
			gstin.Scan(*r.Gstin)
		}
		if r.PlaceOfSupplyState != nil {
			placeOfSupply.Scan(*r.PlaceOfSupplyState)
		}
		if r.Pan != nil {
			pan.Scan(*r.Pan)
		}
		_, err := q.CreateCustomer(ctx, db.CreateCustomerParams{
			TenantID:           tenantID,
			Name:               r.Name,
			ContactPerson:      contact,
			Email:              email,
			Phone:              phone,
			BillingAddress:     billing,
			ShippingAddress:    shipping,
			TaxID:              tax,
			Gstin:              gstin,
			PlaceOfSupplyState: placeOfSupply,
			Pan:                pan,
		})
		if err != nil {
			if firstErr == "" {
				firstErr = fmt.Sprintf("row %d: %v", i+1, err)
			}
			continue
		}
		created++
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("BulkCreateCustomers commit: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete import"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"created": created, "total": len(req.Rows), "error": firstErr})
}

func ListCustomers(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListCustomers(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	q := db.New(database.Pool)
	customers, err := q.ListCustomers(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load customers"})
	}
	return c.JSON(customers)
}

func GetCustomer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	customerIDRaw := c.Params("id")
	customerID, err := toUUID(customerIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid customer ID"})
	}

	q := db.New(database.Pool)
	customer, err := q.GetCustomer(c.Context(), db.GetCustomerParams{
		ID:       customerID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Customer not found"})
	}
	return c.JSON(customer)
}

func UpdateCustomer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	customerIDRaw := c.Params("id")
	customerID, err := toUUID(customerIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid customer ID"})
	}

	var req CustomerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var contact, email, phone, billing, shipping, tax pgtype.Text
	if req.ContactPerson != nil {
		contact.Scan(*req.ContactPerson)
	}
	if req.Email != nil {
		email.Scan(*req.Email)
	}
	if req.Phone != nil {
		phone.Scan(*req.Phone)
	}
	if req.BillingAddress != nil {
		billing.Scan(*req.BillingAddress)
	}
	if req.ShippingAddress != nil {
		shipping.Scan(*req.ShippingAddress)
	}
		if req.TaxID != nil {
			tax.Scan(*req.TaxID)
		}
	var gstin, placeOfSupply, pan pgtype.Text
	if req.Gstin != nil {
		gstin.Scan(*req.Gstin)
	}
	if req.PlaceOfSupplyState != nil {
		placeOfSupply.Scan(*req.PlaceOfSupplyState)
	}
	if req.Pan != nil {
		pan.Scan(*req.Pan)
	}

	q := db.New(database.Pool)
	customer, err := q.UpdateCustomer(c.Context(), db.UpdateCustomerParams{
		ID:                 customerID,
		TenantID:           tenantID,
		Name:               req.Name,
		ContactPerson:      contact,
		Email:              email,
		Phone:              phone,
		BillingAddress:     billing,
		ShippingAddress:    shipping,
		TaxID:              tax,
		Gstin:              gstin,
		PlaceOfSupplyState: placeOfSupply,
		Pan:                pan,
	})
	if err != nil {
		log.Printf("UpdateCustomer error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update customer"})
	}
	return c.JSON(customer)
}

func DeleteCustomer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	customerIDRaw := c.Params("id")
	customerID, err := toUUID(customerIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid customer ID"})
	}

	q := db.New(database.Pool)
	err = q.DeleteCustomer(c.Context(), db.DeleteCustomerParams{
		ID:       customerID,
		TenantID: tenantID,
	})
	if err != nil {
		log.Printf("DeleteCustomer error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete customer. It may have associated orders or invoices."})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Customer deleted successfully"})
}

func CreateSalesOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req SalesOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	customerID, _ := toUUID(req.CustomerID)
	var expectedDate pgtype.Date
	if req.ExpectedShippingDate != "" {
		parsedDate, _ := time.Parse("2006-01-02", req.ExpectedShippingDate)
		expectedDate.Scan(parsedDate)
	}

	var totalAmt pgtype.Numeric
	totalAmt.Scan(req.TotalAmount)

	q := db.New(database.Pool)
	so, err := q.CreateSalesOrder(c.Context(), db.CreateSalesOrderParams{
		TenantID:             tenantID,
		CustomerID:           customerID,
		SoNumber:             req.SONumber,
		Status:               "DRAFT", // initial status
		ExpectedShippingDate: expectedDate,
		TotalAmount:          totalAmt,
		CreatedBy:            userID,
	})
	if err != nil {
		log.Printf("Create SO error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create SO"})
	}
	return c.Status(fiber.StatusCreated).JSON(so)
}

func ListSalesOrders(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListSalesOrders(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	q := db.New(database.Pool)
	sos, err := q.ListSalesOrders(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load SOs"})
	}
	return c.JSON(sos)
}

// Valid status transitions: DRAFT->CONFIRMED, CONFIRMED->SHIPPED, SHIPPED->DELIVERED, any->CANCELLED
var validStatusTransitions = map[string][]string{
	"DRAFT":     {"CONFIRMED", "CANCELLED"},
	"CONFIRMED": {"SHIPPED", "CANCELLED"},
	"SHIPPED":   {"DELIVERED", "CANCELLED"},
	"DELIVERED": {},
	"CANCELLED": {},
}

func GetSalesOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	soID := c.Params("id")
	soUUID, err := toUUID(soID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sales order ID"})
	}

	q := db.New(database.Pool)
	so, err := q.GetSalesOrder(c.Context(), db.GetSalesOrderParams{TenantID: tenantID, ID: soUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sales order not found"})
	}
	return c.JSON(so)
}

func ListSalesOrderItems(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListSalesOrderItems(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	soID := c.Params("id")
	soUUID, err := toUUID(soID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sales order ID"})
	}

	q := db.New(database.Pool)
	items, err := q.ListSalesOrderItems(c.Context(), db.ListSalesOrderItemsParams{TenantID: tenantID, SoID: soUUID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load line items"})
	}
	return c.JSON(items)
}

func UpdateSalesOrderStatus(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw, _ := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	soID := c.Params("id")
	soUUID, err := toUUID(soID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid sales order ID"})
	}

	var req struct {
		Status      string `json:"status"`
		WarehouseID string `json:"warehouse_id"` // optional; required when status=SHIPPED to deduct inventory
	}
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status is required"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	so, err := q.GetSalesOrder(ctx, db.GetSalesOrderParams{TenantID: tenantID, ID: soUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sales order not found"})
	}

	allowed := validStatusTransitions[so.Status]
	valid := false
	for _, s := range allowed {
		if s == req.Status {
			valid = true
			break
		}
	}
	if !valid {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid status transition",
			"from":  so.Status,
			"to":    req.Status,
		})
	}

	if err := q.UpdateSalesOrderStatus(ctx, db.UpdateSalesOrderStatusParams{
		ID: soUUID, TenantID: tenantID, Status: req.Status,
	}); err != nil {
		log.Printf("UpdateSalesOrderStatus error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}

	// When marking as SHIPPED, deduct inventory from the given warehouse (if provided).
	if req.Status == "SHIPPED" && req.WarehouseID != "" {
		warehouseID, wErr := toUUID(req.WarehouseID)
		if wErr == nil {
			items, _ := q.ListSalesOrderItems(ctx, db.ListSalesOrderItemsParams{SoID: soUUID, TenantID: tenantID})
			reason := pgtype.Text{String: "SHIPMENT", Valid: true}
			soRef := soUUID
			for _, item := range items {
				_, _ = q.CreateInventoryTransaction(ctx, db.CreateInventoryTransactionParams{
					TenantID:          tenantID,
					ProductID:         item.ProductID,
					WarehouseID:       warehouseID,
					BatchID:           pgtype.UUID{},
					TransactionType:   "OUT",
					TransactionReason: reason,
					Quantity:          item.Quantity,
					ReferenceID:       soRef,
					Notes:             pgtype.Text{},
					CreatedBy:         userID,
				})
			}
		}
	}
	return c.JSON(fiber.Map{"ok": true, "status": req.Status})
}

func AddSalesOrderItem(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req SalesOrderItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	soID, _ := toUUID(req.SOID)
	productID, _ := toUUID(req.ProductID)

	// Only DRAFT orders can have items added
	q := db.New(database.Pool)
	so, err := q.GetSalesOrder(c.Context(), db.GetSalesOrderParams{TenantID: tenantID, ID: soID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sales order not found"})
	}
	if so.Status != "DRAFT" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Only DRAFT orders can be modified"})
	}

	var qty, unitPrice, totalPrice pgtype.Numeric
	qty.Scan(req.Quantity)
	unitPrice.Scan(req.UnitPrice)
	totalPrice.Scan(req.TotalPrice)

	item, err := q.AddSalesOrderItem(c.Context(), db.AddSalesOrderItemParams{
		TenantID:   tenantID,
		SoID:       soID,
		ProductID:  productID,
		Quantity:   qty,
		UnitPrice:  unitPrice,
		TotalPrice: totalPrice,
	})
	if err != nil {
		log.Printf("AddSalesOrderItem error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add SO item"})
	}
	_ = q.UpdateSalesOrderTotal(c.Context(), db.UpdateSalesOrderTotalParams{ID: soID, TenantID: tenantID})
	return c.Status(fiber.StatusCreated).JSON(item)
}

func DeleteSalesOrderItem(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	itemID := c.Params("id")
	itemUUID, err := toUUID(itemID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid item ID"})
	}

	q := db.New(database.Pool)
	item, err := q.GetSalesOrderItemByID(c.Context(), db.GetSalesOrderItemByIDParams{TenantID: tenantID, ID: itemUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Line item not found"})
	}

	so, err := q.GetSalesOrder(c.Context(), db.GetSalesOrderParams{TenantID: tenantID, ID: item.SoID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Sales order not found"})
	}
	if so.Status != "DRAFT" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Only DRAFT orders can have items removed"})
	}

	if err := q.DeleteSalesOrderItem(c.Context(), db.DeleteSalesOrderItemParams{ID: itemUUID, TenantID: tenantID}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete item"})
	}
	_ = q.UpdateSalesOrderTotal(c.Context(), db.UpdateSalesOrderTotalParams{ID: item.SoID, TenantID: tenantID})
	return c.JSON(fiber.Map{"ok": true})
}

func CreateInvoice(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req InvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	if req.CustomerID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "customer_id is required"})
	}
	customerID, err := toUUID(req.CustomerID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid customer_id"})
	}

	var soID pgtype.UUID
	if req.SOID != nil && *req.SOID != "" {
		soID.Scan(*req.SOID)
	}

	if req.InvoiceDate == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invoice_date is required"})
	}
	parsedInv, err := time.Parse("2006-01-02", req.InvoiceDate)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice_date (use YYYY-MM-DD)"})
	}
	var invDate pgtype.Date
	invDate.Scan(parsedInv)

	var dueDate pgtype.Date
	if req.DueDate != nil && *req.DueDate != "" {
		parsedDue, _ := time.Parse("2006-01-02", *req.DueDate)
		dueDate.Scan(parsedDue)
	}

	var totalAmt pgtype.Numeric
	if err := totalAmt.Scan(req.TotalAmount); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid total_amount"})
	}
	if numericToFloat(totalAmt) <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "total_amount must be positive"})
	}

	status := "DRAFT"
	if req.Status != "" && validInvoiceStatuses[req.Status] {
		status = req.Status
	}
	invoiceType := "TAX_INVOICE"
	if req.InvoiceType != "" {
		invoiceType = req.InvoiceType
	}
	var placeOfSupply pgtype.Text
	if req.PlaceOfSupplyState != nil {
		placeOfSupply.Scan(*req.PlaceOfSupplyState)
	}
	var subtotal, cgstTotal, sgstTotal, igstTotal pgtype.Numeric
	if req.Subtotal != nil && *req.Subtotal != "" {
		subtotal.Scan(*req.Subtotal)
	}
	if req.CgstTotal != nil && *req.CgstTotal != "" {
		cgstTotal.Scan(*req.CgstTotal)
	}
	if req.SgstTotal != nil && *req.SgstTotal != "" {
		sgstTotal.Scan(*req.SgstTotal)
	}
	if req.IgstTotal != nil && *req.IgstTotal != "" {
		igstTotal.Scan(*req.IgstTotal)
	}

	invoiceNumber := req.InvoiceNumber
	if invoiceNumber == "" {
		q := db.New(database.Pool)
		seq, err := q.NextInvoiceNumber(c.Context(), db.NextInvoiceNumberParams{TenantID: tenantID, Year: int32(time.Now().Year())})
		if err != nil {
			log.Printf("NextInvoiceNumber error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate invoice number"})
		}
		invoiceNumber = fmt.Sprintf("INV-%d-%05d", time.Now().Year(), seq)
	}

	q := db.New(database.Pool)
	inv, err := q.CreateInvoice(c.Context(), db.CreateInvoiceParams{
		TenantID:           tenantID,
		CustomerID:         customerID,
		SoID:               soID,
		InvoiceNumber:      invoiceNumber,
		InvoiceDate:       invDate,
		DueDate:           dueDate,
		TotalAmount:       totalAmt,
		Status:             status,
		PlaceOfSupplyState: placeOfSupply,
		InvoiceType:        invoiceType,
		Subtotal:           subtotal,
		CgstTotal:          cgstTotal,
		SgstTotal:          sgstTotal,
		IgstTotal:          igstTotal,
	})
	if err != nil {
		log.Printf("CreateInvoice error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create Invoice"})
	}

	return c.Status(fiber.StatusCreated).JSON(inv)
}

func ListInvoices(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListInvoices(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	q := db.New(database.Pool)
	invoices, err := q.ListInvoices(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load invoices"})
	}
	return c.JSON(invoices)
}

func GetInvoice(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	q := db.New(database.Pool)
	inv, err := q.GetInvoice(c.Context(), db.GetInvoiceParams{TenantID: tenantID, ID: invUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Invoice not found"})
	}

	// Production: include payments, paid total, balance, overdue
	payments, _ := q.ListPaymentsByInvoice(c.Context(), db.ListPaymentsByInvoiceParams{TenantID: tenantID, InvoiceID: invUUID})
	sumPaid, _ := q.SumPaymentsByInvoice(c.Context(), db.SumPaymentsByInvoiceParams{TenantID: tenantID, InvoiceID: invUUID})
	paidTotal := numericToFloat(sumPaid)
	total := numericToFloat(inv.TotalAmount)
	balanceDue := total - paidTotal
	if balanceDue < 0 {
		balanceDue = 0
	}
	var overdue bool
	if inv.DueDate.Valid && inv.Status != "PAID" && inv.Status != "CANCELLED" {
		overdue = time.Now().After(inv.DueDate.Time)
	}

	lineItems, _ := q.ListInvoiceLineItems(c.Context(), db.ListInvoiceLineItemsParams{TenantID: tenantID, InvoiceID: invUUID})

	return c.JSON(fiber.Map{
		"invoice":      inv,
		"payments":    payments,
		"line_items":  lineItems,
		"paid_total":  paidTotal,
		"balance_due": balanceDue,
		"overdue":     overdue,
	})
}

func GetNextInvoiceNumber(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetNextInvoiceNumber(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	year := time.Now().Year()

	q := db.New(database.Pool)
	seq, err := q.NextInvoiceNumber(c.Context(), db.NextInvoiceNumberParams{TenantID: tenantID, Year: int32(year)})
	if err != nil {
		log.Printf("NextInvoiceNumber error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get next invoice number"})
	}
	suggested := fmt.Sprintf("INV-%d-%05d", year, seq)
	return c.JSON(fiber.Map{"suggested": suggested})
}

func ListInvoicePayments(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListInvoicePayments(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	q := db.New(database.Pool)
	payments, err := q.ListPaymentsByInvoice(c.Context(), db.ListPaymentsByInvoiceParams{TenantID: tenantID, InvoiceID: invUUID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load payments"})
	}
	return c.JSON(payments)
}

type PaymentRequest struct {
	Amount          string  `json:"amount"`
	PaymentDate     string  `json:"payment_date"`
	PaymentMethod   *string `json:"payment_method"`
	ReferenceNumber *string `json:"reference_number"`
}

func CreatePayment(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	var req PaymentRequest
	if err := c.BodyParser(&req); err != nil || req.Amount == "" || req.PaymentDate == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "amount and payment_date are required"})
	}

	q := db.New(database.Pool)
	inv, err := q.GetInvoice(c.Context(), db.GetInvoiceParams{TenantID: tenantID, ID: invUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Invoice not found"})
	}
	if inv.Status == "CANCELLED" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot record payment on cancelled invoice"})
	}

	sumPaid, _ := q.SumPaymentsByInvoice(c.Context(), db.SumPaymentsByInvoiceParams{TenantID: tenantID, InvoiceID: invUUID})
	total := numericToFloat(inv.TotalAmount)
	paidTotal := numericToFloat(sumPaid)
	var payAmt pgtype.Numeric
	payAmt.Scan(req.Amount)
	paymentAmount := numericToFloat(payAmt)
	if paymentAmount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Payment amount must be positive"})
	}
	if paidTotal+paymentAmount > total {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":        "Payment exceeds balance due",
			"total":        total,
			"paid_total":   paidTotal,
			"balance_due":  total - paidTotal,
		})
	}

	parsedDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payment_date format (use YYYY-MM-DD)"})
	}
	var payDate pgtype.Date
	payDate.Scan(parsedDate)

	var method, ref pgtype.Text
	if req.PaymentMethod != nil {
		method.Scan(*req.PaymentMethod)
	}
	if req.ReferenceNumber != nil {
		ref.Scan(*req.ReferenceNumber)
	}

	payment, err := q.CreatePayment(c.Context(), db.CreatePaymentParams{
		TenantID:        tenantID,
		InvoiceID:       invUUID,
		Amount:          payAmt,
		PaymentDate:     payDate,
		PaymentMethod:   method,
		ReferenceNumber: ref,
		RecordedBy:      userID,
	})
	if err != nil {
		log.Printf("CreatePayment error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record payment"})
	}

	newPaidTotal := paidTotal + paymentAmount
	var newStatus string
	if newPaidTotal >= total {
		newStatus = "PAID"
	} else {
		newStatus = "PARTIAL"
	}
	_ = q.UpdateInvoiceStatus(c.Context(), db.UpdateInvoiceStatusParams{TenantID: tenantID, ID: invUUID, Status: newStatus})

	return c.Status(fiber.StatusCreated).JSON(payment)
}

var validInvoiceStatuses = map[string]bool{
	"DRAFT": true, "UNPAID": true, "PARTIAL": true, "PAID": true, "OVERDUE": true, "CANCELLED": true,
}

func UpdateInvoiceStatus(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status is required"})
	}
	if !validInvoiceStatuses[req.Status] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid status"})
	}

	q := db.New(database.Pool)
	_, err = q.GetInvoice(c.Context(), db.GetInvoiceParams{TenantID: tenantID, ID: invUUID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Invoice not found"})
	}
	// Cannot set to PAID/PARTIAL via status update; use payments. Can only set OVERDUE, CANCELLED, DRAFT, UNPAID.
	if req.Status == "PAID" || req.Status == "PARTIAL" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Use Record Payment to set PAID/PARTIAL"})
	}

	if err := q.UpdateInvoiceStatus(c.Context(), db.UpdateInvoiceStatusParams{TenantID: tenantID, ID: invUUID, Status: req.Status}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}
	return c.JSON(fiber.Map{"ok": true, "status": req.Status})
}

func ListInvoiceLineItems(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListInvoiceLineItems(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	q := db.New(database.Pool)
	items, err := q.ListInvoiceLineItems(c.Context(), db.ListInvoiceLineItemsParams{TenantID: tenantID, InvoiceID: invUUID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load line items"})
	}
	return c.JSON(items)
}

type InvoiceLineItemRequest struct {
	Description   string  `json:"description"`
	Quantity      string  `json:"quantity"`
	UnitPrice     string  `json:"unit_price"`
	TotalLine     string  `json:"total_line"`
	SortOrder     *int32  `json:"sort_order"`
	HsnSac        *string `json:"hsn_sac"`
	TaxableValue  *string `json:"taxable_value"`
	Cgst          *string `json:"cgst"`
	Sgst          *string `json:"sgst"`
	Igst          *string `json:"igst"`
}

func AddInvoiceLineItem(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	invoiceID := c.Params("id")
	invUUID, err := toUUID(invoiceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid invoice ID"})
	}

	var req InvoiceLineItemRequest
	if err := c.BodyParser(&req); err != nil || req.Description == "" || req.Quantity == "" || req.UnitPrice == "" || req.TotalLine == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "description, quantity, unit_price, total_line are required"})
	}

	var qty, unitPrice, totalLine pgtype.Numeric
	qty.Scan(req.Quantity)
	unitPrice.Scan(req.UnitPrice)
	totalLine.Scan(req.TotalLine)
	sortOrder := int32(0)
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	var hsnSac pgtype.Text
	var taxableValue, cgst, sgst, igst pgtype.Numeric
	if req.HsnSac != nil {
		hsnSac.Scan(*req.HsnSac)
	}
	if req.TaxableValue != nil && *req.TaxableValue != "" {
		taxableValue.Scan(*req.TaxableValue)
	}
	if req.Cgst != nil && *req.Cgst != "" {
		cgst.Scan(*req.Cgst)
	}
	if req.Sgst != nil && *req.Sgst != "" {
		sgst.Scan(*req.Sgst)
	}
	if req.Igst != nil && *req.Igst != "" {
		igst.Scan(*req.Igst)
	}

	q := db.New(database.Pool)
	item, err := q.AddInvoiceLineItem(c.Context(), db.AddInvoiceLineItemParams{
		TenantID:     tenantID,
		InvoiceID:    invUUID,
		Description:  req.Description,
		Quantity:     qty,
		UnitPrice:    unitPrice,
		TotalLine:    totalLine,
		SortOrder:    sortOrder,
		HsnSac:       hsnSac,
		TaxableValue: taxableValue,
		Cgst:         cgst,
		Sgst:         sgst,
		Igst:         igst,
	})
	if err != nil {
		log.Printf("AddInvoiceLineItem error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add line item"})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}
