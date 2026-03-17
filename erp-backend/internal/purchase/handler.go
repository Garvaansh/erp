package purchase

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/audit"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

type VendorRequest struct {
	Name          string  `json:"name"`
	ContactPerson *string `json:"contact_person"`
	Email         *string `json:"email"`
	Phone         *string `json:"phone"`
	Address       *string `json:"address"`
	StatusNotes   *string `json:"status_notes"` // Reva: e.g. RATES given, don't sell, CALL NOT PICK
	Gstin         *string `json:"gstin"`
	Pan           *string `json:"pan"`
}

type PurchaseOrderRequest struct {
	VendorID             string `json:"vendor_id"`
	PONumber             string `json:"po_number"`
	ExpectedDeliveryDate string `json:"expected_delivery_date"` // YYYY-MM-DD
	TotalAmount          string `json:"total_amount"`           // numeric string
}

type POItemRequest struct {
	POID       string `json:"po_id"`
	ProductID  string `json:"product_id"`
	Quantity   string `json:"quantity"`
	UnitPrice  string `json:"unit_price"`
	TotalPrice string `json:"total_price"`
}

type GoodsReceiptRequest struct {
	POID         string `json:"po_id"`
	WarehouseID  string `json:"warehouse_id"`
	ReceiptDate  string `json:"receipt_date"` // YYYY-MM-DD
	Notes        string `json:"notes"`
}

type UpdatePOStatusRequest struct {
	Status string `json:"status"` // DRAFT, ISSUED, PARTIAL_RECEIPT, COMPLETED, CANCELLED
}

type VendorInvoiceRequest struct {
	VendorID       string   `json:"vendor_id"`
	POID           *string  `json:"po_id"`
	InvoiceNumber  string   `json:"invoice_number"`
	InvoiceDate    string   `json:"invoice_date"`
	DueDate        string   `json:"due_date"`
	TotalAmount    string   `json:"total_amount"`
	Notes          string   `json:"notes"`
	TdsSection     *string  `json:"tds_section"`
	TdsRate        *string  `json:"tds_rate"`
	TdsAmount      *string  `json:"tds_amount"`
	TdsPaidAt      *string  `json:"tds_paid_at"` // ISO date-time
	ChallanNumber  *string  `json:"challan_number"`
}

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

func CreateVendor(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req VendorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var contact, email, phone, addr pgtype.Text
	if req.ContactPerson != nil {
		contact.Scan(*req.ContactPerson)
	}
	if req.Email != nil {
		email.Scan(*req.Email)
	}
	if req.Phone != nil {
		phone.Scan(*req.Phone)
	}
	if req.Address != nil {
		addr.Scan(*req.Address)
	}
	var statusNotes pgtype.Text
	if req.StatusNotes != nil {
		statusNotes.Scan(*req.StatusNotes)
	}
	var gstin, pan pgtype.Text
	if req.Gstin != nil {
		gstin.Scan(*req.Gstin)
	}
	if req.Pan != nil {
		pan.Scan(*req.Pan)
	}

	q := db.New(database.Pool)
	vendor, err := q.CreateVendor(c.Context(), db.CreateVendorParams{
		TenantID:      tenantID,
		Name:          req.Name,
		ContactPerson: contact,
		Email:         email,
		Phone:         phone,
		Address:       addr,
		StatusNotes:   statusNotes,
		Gstin:         gstin,
		Pan:           pan,
	})
	if err != nil {
		log.Printf("CreateVendor error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create vendor"})
	}
	audit.LogFromFiber(c, "vendor", vendor.ID, "CREATE", nil, audit.ToJSON(vendor))
	return c.Status(fiber.StatusCreated).JSON(vendor)
}

// BulkCreateVendorsRequest body for Excel/bulk vendor import
type BulkCreateVendorsRequest struct {
	Rows []VendorRequest `json:"rows"`
}

func BulkCreateVendors(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req BulkCreateVendorsRequest
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
		log.Printf("BulkCreateVendors begin tx: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start import"})
	}
	defer tx.Rollback(ctx)

	q := db.New(database.Pool).WithTx(tx)
	created := 0
	var firstErr string
	for i := range req.Rows {
		r := &req.Rows[i]
		var contact, email, phone, addr pgtype.Text
		if r.ContactPerson != nil {
			contact.Scan(*r.ContactPerson)
		}
		if r.Email != nil {
			email.Scan(*r.Email)
		}
		if r.Phone != nil {
			phone.Scan(*r.Phone)
		}
		if r.Address != nil {
			addr.Scan(*r.Address)
		}
		var statusNotes pgtype.Text
		if r.StatusNotes != nil {
			statusNotes.Scan(*r.StatusNotes)
		}
		var gstin, pan pgtype.Text
		if r.Gstin != nil {
			gstin.Scan(*r.Gstin)
		}
		if r.Pan != nil {
			pan.Scan(*r.Pan)
		}
		_, err := q.CreateVendor(ctx, db.CreateVendorParams{
			TenantID:      tenantID,
			Name:          r.Name,
			ContactPerson: contact,
			Email:         email,
			Phone:         phone,
			Address:       addr,
			StatusNotes:   statusNotes,
			Gstin:         gstin,
			Pan:           pan,
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
		log.Printf("BulkCreateVendors commit: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete import"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"created": created, "total": len(req.Rows), "error": firstErr})
}

func ListVendors(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListVendors(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	q := db.New(database.Pool)
	vendors, err := q.ListVendors(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load vendors"})
	}
	return c.JSON(vendors)
}

func GetVendor(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	vendorIDRaw := c.Params("id")
	vendorID, err := toUUID(vendorIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid vendor ID"})
	}

	q := db.New(database.Pool)
	vendor, err := q.GetVendor(c.Context(), db.GetVendorParams{
		ID:       vendorID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Vendor not found"})
	}
	return c.JSON(vendor)
}

func UpdateVendor(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	vendorIDRaw := c.Params("id")
	vendorID, err := toUUID(vendorIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid vendor ID"})
	}

	var req VendorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var contact, email, phone, addr pgtype.Text
	if req.ContactPerson != nil {
		contact.Scan(*req.ContactPerson)
	}
	if req.Email != nil {
		email.Scan(*req.Email)
	}
	if req.Phone != nil {
		phone.Scan(*req.Phone)
	}
	if req.Address != nil {
		addr.Scan(*req.Address)
	}
	var statusNotes pgtype.Text
	if req.StatusNotes != nil {
		statusNotes.Scan(*req.StatusNotes)
	}
	var gstin, pan pgtype.Text
	if req.Gstin != nil {
		gstin.Scan(*req.Gstin)
	}
	if req.Pan != nil {
		pan.Scan(*req.Pan)
	}

	q := db.New(database.Pool)
	oldVendor, _ := q.GetVendor(c.Context(), db.GetVendorParams{ID: vendorID, TenantID: tenantID})
	vendor, err := q.UpdateVendor(c.Context(), db.UpdateVendorParams{
		ID:            vendorID,
		TenantID:      tenantID,
		Name:          req.Name,
		ContactPerson: contact,
		Email:         email,
		Phone:         phone,
		Address:       addr,
		StatusNotes:   statusNotes,
		Gstin:         gstin,
		Pan:           pan,
	})
	if err != nil {
		log.Printf("UpdateVendor error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update vendor"})
	}
	audit.LogFromFiber(c, "vendor", vendor.ID, "UPDATE", audit.ToJSON(oldVendor), audit.ToJSON(vendor))
	return c.JSON(vendor)
}

func DeleteVendor(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	vendorIDRaw := c.Params("id")
	vendorID, err := toUUID(vendorIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid vendor ID"})
	}

	q := db.New(database.Pool)
	oldVendor, _ := q.GetVendor(c.Context(), db.GetVendorParams{ID: vendorID, TenantID: tenantID})
	err = q.DeleteVendor(c.Context(), db.DeleteVendorParams{
		ID:       vendorID,
		TenantID: tenantID,
	})
	if err != nil {
		log.Printf("DeleteVendor error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete vendor. It may have associated purchase orders."})
	}
	audit.LogFromFiber(c, "vendor", vendorID, "DELETE", audit.ToJSON(oldVendor), nil)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Vendor deleted successfully"})
}

func CreatePurchaseOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req PurchaseOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	vendorID, _ := toUUID(req.VendorID)
	var expectedDate pgtype.Date
	if req.ExpectedDeliveryDate != "" {
		parsedDate, _ := time.Parse("2006-01-02", req.ExpectedDeliveryDate)
		expectedDate.Scan(parsedDate)
	}

	var totalAmt pgtype.Numeric
	totalAmt.Scan(req.TotalAmount)

	q := db.New(database.Pool)
	po, err := q.CreatePurchaseOrder(c.Context(), db.CreatePurchaseOrderParams{
		TenantID:             tenantID,
		VendorID:             vendorID,
		PoNumber:             req.PONumber,
		Status:               "DRAFT", // initial status
		ExpectedDeliveryDate: expectedDate,
		TotalAmount:          totalAmt,
		CreatedBy:            userID,
	})
	if err != nil {
		log.Printf("Create PO error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create PO"})
	}
	audit.LogFromFiber(c, "purchase_order", po.ID, "CREATE", nil, audit.ToJSON(po))
	return c.Status(fiber.StatusCreated).JSON(po)
}

func AddPOItem(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req POItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	poID, _ := toUUID(req.POID)
	productID, _ := toUUID(req.ProductID)

	var qty, unitPrice, totalPrice pgtype.Numeric
	qty.Scan(req.Quantity)
	unitPrice.Scan(req.UnitPrice)
	totalPrice.Scan(req.TotalPrice)

	q := db.New(database.Pool)
	item, err := q.AddPurchaseOrderItem(c.Context(), db.AddPurchaseOrderItemParams{
		TenantID:   tenantID,
		PoID:       poID,
		ProductID:  productID,
		Quantity:   qty,
		UnitPrice:  unitPrice,
		TotalPrice: totalPrice,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add PO item"})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func ListPurchaseOrders(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListPurchaseOrders(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	q := db.New(database.Pool)
	pos, err := q.ListPurchaseOrders(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load POs"})
	}
	return c.JSON(pos)
}

func GetPurchaseOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	poIDRaw := c.Params("id")
	poID, err := toUUID(poIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid PO ID"})
	}

	q := db.New(database.Pool)
	po, err := q.GetPurchaseOrder(c.Context(), db.GetPurchaseOrderParams{
		ID:       poID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Purchase order not found"})
	}
	return c.JSON(po)
}

func ListPurchaseOrderItems(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListPurchaseOrderItems(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	poIDRaw := c.Params("id")
	poID, err := toUUID(poIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid PO ID"})
	}

	q := db.New(database.Pool)
	items, err := q.ListPurchaseOrderItems(c.Context(), db.ListPurchaseOrderItemsParams{
		PoID:     poID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load PO items"})
	}
	return c.JSON(items)
}

// CreateGoodsReceipt creates a GRN and records IN inventory transactions for each PO line.
func CreateGoodsReceipt(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req GoodsReceiptRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	poID, err := toUUID(req.POID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid po_id"})
	}
	warehouseID, err := toUUID(req.WarehouseID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid warehouse_id"})
	}

	var receiptDate pgtype.Date
	if req.ReceiptDate != "" {
		parsed, _ := time.Parse("2006-01-02", req.ReceiptDate)
		receiptDate.Scan(parsed)
	} else {
		receiptDate.Scan(time.Now())
	}
	var notes pgtype.Text
	notes.Scan(req.Notes)

	q := db.New(database.Pool)
	ctx := c.Context()
	year := int32(time.Now().Year())
	next, err := q.GetNextDocumentNumber(ctx, db.GetNextDocumentNumberParams{
		TenantID:     tenantID,
		DocumentType: "GRN",
		Year:         year,
		Prefix:       "GRN-",
	})
	if err != nil {
		log.Printf("GetNextDocumentNumber GRN: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get GRN number"})
	}
	receiptNumber := fmt.Sprintf("%s%d", next.Prefix, next.LastNumber)

	grn, err := q.CreateGoodsReceipt(ctx, db.CreateGoodsReceiptParams{
		TenantID:      tenantID,
		PoID:          poID,
		WarehouseID:   warehouseID,
		ReceiptNumber: receiptNumber,
		ReceiptDate:   receiptDate,
		ReceivedBy:    userID,
		Notes:         notes,
	})
	if err != nil {
		log.Printf("CreateGoodsReceipt: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create goods receipt"})
	}

	items, err := q.ListPurchaseOrderItems(ctx, db.ListPurchaseOrderItemsParams{PoID: poID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load PO items"})
	}
	reason := pgtype.Text{String: "RECEIPT", Valid: true}
	refID := grn.ID
	for _, item := range items {
		_, err = q.CreateInventoryTransaction(ctx, db.CreateInventoryTransactionParams{
			TenantID:          tenantID,
			ProductID:         item.ProductID,
			WarehouseID:       warehouseID,
			BatchID:           pgtype.UUID{},
			TransactionType:   "IN",
			TransactionReason: reason,
			Quantity:          item.Quantity,
			ReferenceID:       refID,
			Notes:             notes,
			CreatedBy:         userID,
		})
		if err != nil {
			log.Printf("CreateInventoryTransaction for GRN: %v", err)
		}
	}
	_ = q.UpdatePurchaseOrderStatus(ctx, db.UpdatePurchaseOrderStatusParams{
		Status:  "PARTIAL_RECEIPT",
		ID:      poID,
		TenantID: tenantID,
	})

	return c.Status(fiber.StatusCreated).JSON(grn)
}

func ListGoodsReceipts(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListGoodsReceipts(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListGoodsReceipts(c.Context(), tenantID)
	if err != nil {
		log.Printf("ListGoodsReceipts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list goods receipts"})
	}
	return c.JSON(list)
}

func GetGoodsReceipt(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	idRaw := c.Params("id")
	id, err := toUUID(idRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	grn, err := q.GetGoodsReceipt(c.Context(), db.GetGoodsReceiptParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Goods receipt not found"})
	}
	return c.JSON(grn)
}

func UpdatePurchaseOrderStatus(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	poIDRaw := c.Params("id")
	poID, err := toUUID(poIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid PO ID"})
	}
	var req UpdatePOStatusRequest
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status required"})
	}
	q := db.New(database.Pool)
	err = q.UpdatePurchaseOrderStatus(c.Context(), db.UpdatePurchaseOrderStatusParams{
		Status:   req.Status,
		ID:       poID,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Status updated"})
}

func CreateVendorInvoice(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	var req VendorInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	vendorID, err := toUUID(req.VendorID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid vendor_id"})
	}
	var poID pgtype.UUID
	if req.POID != nil && *req.POID != "" {
		poID.Scan(*req.POID)
	}
	var invoiceDate, dueDate pgtype.Date
	invoiceDate.Scan(req.InvoiceDate)
	if req.DueDate != "" {
		dueDate.Scan(req.DueDate)
	}
	var totalAmt pgtype.Numeric
	totalAmt.Scan(req.TotalAmount)
	var notes pgtype.Text
	notes.Scan(req.Notes)
	var tdsSection, challanNumber pgtype.Text
	var tdsRate, tdsAmount pgtype.Numeric
	var tdsPaidAt pgtype.Timestamptz
	if req.TdsSection != nil {
		tdsSection.Scan(*req.TdsSection)
	}
	if req.TdsRate != nil && *req.TdsRate != "" {
		tdsRate.Scan(*req.TdsRate)
	}
	if req.TdsAmount != nil && *req.TdsAmount != "" {
		tdsAmount.Scan(*req.TdsAmount)
	}
	if req.TdsPaidAt != nil && *req.TdsPaidAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.TdsPaidAt); err == nil {
			tdsPaidAt.Scan(t)
		}
	}
	if req.ChallanNumber != nil {
		challanNumber.Scan(*req.ChallanNumber)
	}

	q := db.New(database.Pool)
	vinv, err := q.CreateVendorInvoice(c.Context(), db.CreateVendorInvoiceParams{
		TenantID:      tenantID,
		VendorID:      vendorID,
		PoID:          poID,
		InvoiceNumber: req.InvoiceNumber,
		InvoiceDate:   invoiceDate,
		DueDate:       dueDate,
		TotalAmount:   totalAmt,
		Status:        "UNPAID",
		Notes:         notes,
		TdsSection:    tdsSection,
		TdsRate:       tdsRate,
		TdsAmount:     tdsAmount,
		TdsPaidAt:     tdsPaidAt,
		ChallanNumber: challanNumber,
	})
	if err != nil {
		log.Printf("CreateVendorInvoice: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create vendor invoice"})
	}
	return c.Status(fiber.StatusCreated).JSON(vinv)
}

func ListVendorInvoices(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListVendorInvoices(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListVendorInvoices(c.Context(), tenantID)
	if err != nil {
		log.Printf("ListVendorInvoices: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list vendor invoices"})
	}
	return c.JSON(list)
}

// UpdateVendorInvoiceTDSRequest body for PATCH /vendor-invoices/:id/tds (India TDS)
type UpdateVendorInvoiceTDSRequest struct {
	TdsSection    *string `json:"tds_section"`
	TdsRate       *string `json:"tds_rate"`
	TdsAmount     *string `json:"tds_amount"`
	TdsPaidAt     *string `json:"tds_paid_at"` // ISO date-time
	ChallanNumber *string `json:"challan_number"`
}

func UpdateVendorInvoiceTDS(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	idRaw := c.Params("id")
	id, err := toUUID(idRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	var req UpdateVendorInvoiceTDSRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	var tdsSection, challanNumber pgtype.Text
	var tdsRate, tdsAmount pgtype.Numeric
	var tdsPaidAt pgtype.Timestamptz
	if req.TdsSection != nil {
		tdsSection.Scan(*req.TdsSection)
	}
	if req.TdsRate != nil && *req.TdsRate != "" {
		tdsRate.Scan(*req.TdsRate)
	}
	if req.TdsAmount != nil && *req.TdsAmount != "" {
		tdsAmount.Scan(*req.TdsAmount)
	}
	if req.TdsPaidAt != nil && *req.TdsPaidAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.TdsPaidAt); err == nil {
			tdsPaidAt.Scan(t)
		}
	}
	if req.ChallanNumber != nil {
		challanNumber.Scan(*req.ChallanNumber)
	}
	q := db.New(database.Pool)
	updated, err := q.UpdateVendorInvoiceTDS(c.Context(), db.UpdateVendorInvoiceTDSParams{
		ID:            id,
		TenantID:      tenantID,
		TdsSection:    tdsSection,
		TdsRate:       tdsRate,
		TdsAmount:     tdsAmount,
		TdsPaidAt:     tdsPaidAt,
		ChallanNumber: challanNumber,
	})
	if err != nil {
		log.Printf("UpdateVendorInvoiceTDS: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update TDS"})
	}
	return c.JSON(updated)
}

func GetVendorInvoice(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	idRaw := c.Params("id")
	id, err := toUUID(idRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	vinv, err := q.GetVendorInvoice(c.Context(), db.GetVendorInvoiceParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Vendor invoice not found"})
	}
	return c.JSON(vinv)
}
