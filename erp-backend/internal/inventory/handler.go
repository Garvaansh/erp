package inventory

import (
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/audit"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

type ProductRequest struct {
	CategoryID   pgtype.UUID `json:"category_id"`
	Name         string      `json:"name"`
	SKU          string      `json:"sku"`
	Price        float64     `json:"price"`
	ReorderPoint *float64    `json:"reorder_point"`
	SafetyStock  *float64    `json:"safety_stock"`
	LeadTimeDays *int32      `json:"lead_time_days"`
	Uom          string      `json:"uom"`
	ProductType  *string     `json:"product_type"` // Reva: e.g. 30 MM, 48 MM
	StockStatus  *string     `json:"stock_status"` // Reva: e.g. In stock
	TrNotes      *string     `json:"tr_notes"`     // Reva: e.g. OLD, NEW, 6 BUNDLE
	Brand        *string     `json:"brand"`        // Reva: RIR, Jindal
	HsnSac       *string     `json:"hsn_sac"`      // India: HSN/SAC code for GST
	GstRate      *float64    `json:"gst_rate"`     // India: default GST rate %
}

type WarehouseRequest struct {
	Name     string `json:"name"`
	Location string `json:"location"`
}

type TransactionRequest struct {
	ProductID         string  `json:"product_id"`
	WarehouseID       string  `json:"warehouse_id"`
	BatchID           *string `json:"batch_id"`
	TransactionType   string  `json:"transaction_type"`   // IN, OUT, ADJUSTMENT
	TransactionReason string  `json:"transaction_reason"` // RECEIPT, SHIPMENT, ADJUSTMENT, TRANSFER, RETURN
	Quantity          string  `json:"quantity"`
	ReferenceID       *string `json:"reference_id"`
	Notes             string  `json:"notes"`
}

// convertString2UUID helper
func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

func CreateProduct(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)

	// In pgtype.Numeric, price mapping handles it if emit_interface is setup,
	// but mapping floats directly to pgtype.Numeric needs care if sqlc doesn't do it automatically.
	// sqlc translates DECIMAL to pgtype.Numeric.
	var price pgtype.Numeric
	price.Scan(req.Price)
	reorderPt := pgtype.Numeric{}
	if req.ReorderPoint != nil {
		reorderPt.Scan(*req.ReorderPoint)
	}
	safety := pgtype.Numeric{}
	if req.SafetyStock != nil {
		safety.Scan(*req.SafetyStock)
	}
	var leadDays int32
	if req.LeadTimeDays != nil {
		leadDays = *req.LeadTimeDays
	}
	uom := "EA"
	if req.Uom != "" {
		uom = req.Uom
	}
	var productType, stockStatus, trNotes, brand pgtype.Text
	if req.ProductType != nil {
		productType.Scan(*req.ProductType)
	}
	if req.StockStatus != nil {
		stockStatus.Scan(*req.StockStatus)
	}
	if req.TrNotes != nil {
		trNotes.Scan(*req.TrNotes)
	}
	if req.Brand != nil {
		brand.Scan(*req.Brand)
	}
	var hsnSac pgtype.Text
	var gstRate pgtype.Numeric
	if req.HsnSac != nil {
		hsnSac.Scan(*req.HsnSac)
	}
	if req.GstRate != nil {
		gstRate.Scan(fmt.Sprintf("%.2f", *req.GstRate))
	}

	product, err := q.CreateProduct(c.Context(), db.CreateProductParams{
		TenantID:     tenantID,
		CategoryID:   req.CategoryID,
		Name:         req.Name,
		Sku:          req.SKU,
		Price:        price,
		ReorderPoint: reorderPt,
		SafetyStock:  safety,
		LeadTimeDays: leadDays,
		Uom:          uom,
		ProductType:  productType,
		StockStatus:  stockStatus,
		TrNotes:      trNotes,
		Brand:        brand,
		HsnSac:       hsnSac,
		GstRate:      gstRate,
	})
	if err != nil {
		log.Printf("CreateProduct error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create product"})
	}
	audit.LogFromFiber(c, "product", product.ID, "CREATE", nil, audit.ToJSON(product))
	return c.Status(fiber.StatusCreated).JSON(product)
}

// BulkCreateProductsRequest body for Excel/bulk product import
type BulkCreateProductsRequest struct {
	Rows []ProductRequest `json:"rows"`
}

func BulkCreateProducts(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	var req BulkCreateProductsRequest
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
		log.Printf("BulkCreateProducts begin tx: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start import"})
	}
	defer tx.Rollback(ctx)

	q := db.New(database.Pool).WithTx(tx)
	created := 0
	var firstErr string
	for i := range req.Rows {
		r := &req.Rows[i]
		var price pgtype.Numeric
		price.Scan(r.Price)
		reorderPt := pgtype.Numeric{}
		if r.ReorderPoint != nil {
			reorderPt.Scan(*r.ReorderPoint)
		}
		safety := pgtype.Numeric{}
		if r.SafetyStock != nil {
			safety.Scan(*r.SafetyStock)
		}
		var leadDays int32
		if r.LeadTimeDays != nil {
			leadDays = *r.LeadTimeDays
		}
		uom := "EA"
		if r.Uom != "" {
			uom = r.Uom
		}
		var productType, stockStatus, trNotes, brand pgtype.Text
		if r.ProductType != nil {
			productType.Scan(*r.ProductType)
		}
		if r.StockStatus != nil {
			stockStatus.Scan(*r.StockStatus)
		}
		if r.TrNotes != nil {
			trNotes.Scan(*r.TrNotes)
		}
		if r.Brand != nil {
			brand.Scan(*r.Brand)
		}
		var hsnSac pgtype.Text
		var gstRate pgtype.Numeric
		if r.HsnSac != nil {
			hsnSac.Scan(*r.HsnSac)
		}
		if r.GstRate != nil {
			gstRate.Scan(fmt.Sprintf("%.2f", *r.GstRate))
		}
		_, err := q.CreateProduct(ctx, db.CreateProductParams{
			TenantID:     tenantID,
			CategoryID:   r.CategoryID,
			Name:         r.Name,
			Sku:          r.SKU,
			Price:        price,
			ReorderPoint: reorderPt,
			SafetyStock:  safety,
			LeadTimeDays: leadDays,
			Uom:          uom,
			ProductType:  productType,
			StockStatus:  stockStatus,
			TrNotes:      trNotes,
			Brand:        brand,
			HsnSac:       hsnSac,
			GstRate:      gstRate,
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
		log.Printf("BulkCreateProducts commit: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete import"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"created": created, "total": len(req.Rows), "error": firstErr})
}

func ListProductCategories(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListProductCategories(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	q := db.New(database.Pool)
	categories, err := q.ListProductCategories(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load categories"})
	}
	return c.JSON(categories)
}

type CreateCategoryRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func CreateProductCategory(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}
	var desc pgtype.Text
	if req.Description != nil {
		desc.Scan(*req.Description)
	}
	q := db.New(database.Pool)
	cat, err := q.CreateProductCategory(c.Context(), db.CreateProductCategoryParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: desc,
	})
	if err != nil {
		log.Printf("CreateProductCategory error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create category"})
	}
	return c.Status(fiber.StatusCreated).JSON(cat)
}

func ListProducts(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListProducts(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	q := db.New(database.Pool)
	categoryIDStr := c.Query("category_id")
	if categoryIDStr != "" {
		categoryID, err := toUUID(categoryIDStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid category_id"})
		}
		products, err := q.ListProductsByCategory(c.Context(), db.ListProductsByCategoryParams{
			TenantID:   tenantID,
			CategoryID: categoryID,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load products"})
		}
		return c.JSON(products)
	}
	products, err := q.ListProducts(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load products"})
	}
	return c.JSON(products)
}

func GetProduct(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	productIDRaw := c.Params("id")
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
	return c.JSON(product)
}

func UpdateProduct(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	productIDRaw := c.Params("id")
	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	var req ProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var price pgtype.Numeric
	price.Scan(req.Price)
	reorderPt := pgtype.Numeric{}
	if req.ReorderPoint != nil {
		reorderPt.Scan(*req.ReorderPoint)
	}
	safety := pgtype.Numeric{}
	if req.SafetyStock != nil {
		safety.Scan(*req.SafetyStock)
	}
	var leadDays int32
	if req.LeadTimeDays != nil {
		leadDays = *req.LeadTimeDays
	}
	uom := "EA"
	if req.Uom != "" {
		uom = req.Uom
	}
	var productType, stockStatus, trNotes, brand pgtype.Text
	if req.ProductType != nil {
		productType.Scan(*req.ProductType)
	}
	if req.StockStatus != nil {
		stockStatus.Scan(*req.StockStatus)
	}
	if req.TrNotes != nil {
		trNotes.Scan(*req.TrNotes)
	}
	if req.Brand != nil {
		brand.Scan(*req.Brand)
	}
	var hsnSac pgtype.Text
	var gstRate pgtype.Numeric
	if req.HsnSac != nil {
		hsnSac.Scan(*req.HsnSac)
	}
	if req.GstRate != nil {
		gstRate.Scan(fmt.Sprintf("%.2f", *req.GstRate))
	}

	q := db.New(database.Pool)
	oldProduct, err := q.GetProduct(c.Context(), db.GetProductParams{ID: productID, TenantID: tenantID})
	if err == nil {
		// have old state for audit
	}
	product, err := q.UpdateProduct(c.Context(), db.UpdateProductParams{
		ID:           productID,
		TenantID:     tenantID,
		CategoryID:   req.CategoryID,
		Name:         req.Name,
		Sku:          req.SKU,
		Price:        price,
		ReorderPoint: reorderPt,
		SafetyStock:  safety,
		LeadTimeDays: leadDays,
		Uom:          uom,
		ProductType:  productType,
		StockStatus:  stockStatus,
		TrNotes:      trNotes,
		Brand:        brand,
		HsnSac:       hsnSac,
		GstRate:      gstRate,
	})
	if err != nil {
		log.Printf("UpdateProduct error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update product"})
	}
	audit.LogFromFiber(c, "product", product.ID, "UPDATE", audit.ToJSON(oldProduct), audit.ToJSON(product))
	return c.JSON(product)
}

func DeleteProduct(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	productIDRaw := c.Params("id")
	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	q := db.New(database.Pool)
	oldProduct, _ := q.GetProduct(c.Context(), db.GetProductParams{ID: productID, TenantID: tenantID})
	err = q.DeleteProduct(c.Context(), db.DeleteProductParams{
		ID:       productID,
		TenantID: tenantID,
	})
	if err != nil {
		log.Printf("DeleteProduct error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete product. It may be in use by orders or inventory."})
	}
	audit.LogFromFiber(c, "product", productID, "DELETE", audit.ToJSON(oldProduct), nil)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Product deleted successfully"})
}

func CreateWarehouse(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	var req WarehouseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	var loc pgtype.Text
	loc.Scan(req.Location)

	q := db.New(database.Pool)
	warehouse, err := q.CreateWarehouse(c.Context(), db.CreateWarehouseParams{
		TenantID: tenantID,
		Name:     req.Name,
		Location: loc,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create warehouse"})
	}

	return c.Status(fiber.StatusCreated).JSON(warehouse)
}

func ListWarehouses(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWarehouses(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	q := db.New(database.Pool)
	warehouses, err := q.ListWarehouses(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load warehouses"})
	}

	return c.JSON(warehouses)
}

func RecordTransaction(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req TransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	productID, _ := toUUID(req.ProductID)
	warehouseID, _ := toUUID(req.WarehouseID)

	var batchID pgtype.UUID
	if req.BatchID != nil {
		batchID.Scan(*req.BatchID)
	}

	var referenceID pgtype.UUID
	if req.ReferenceID != nil {
		referenceID.Scan(*req.ReferenceID)
	}

	var notes pgtype.Text
	notes.Scan(req.Notes)

	var quantity pgtype.Numeric
	quantity.Scan(req.Quantity)

	var txReason pgtype.Text
	txReason.Scan(req.TransactionReason)

	q := db.New(database.Pool)
	tx, err := q.CreateInventoryTransaction(c.Context(), db.CreateInventoryTransactionParams{
		TenantID:          tenantID,
		ProductID:         productID,
		WarehouseID:       warehouseID,
		BatchID:           batchID,
		TransactionType:   req.TransactionType,
		TransactionReason: txReason,
		Quantity:          quantity,
		ReferenceID:       referenceID,
		Notes:             notes,
		CreatedBy:         userID,
	})
	if err != nil {
		log.Printf("RecordTransaction error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record transaction"})
	}

	return c.Status(fiber.StatusCreated).JSON(tx)
}

// ListStockLevels returns all products with their current total stock
func ListStockLevels(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListStockLevels(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	q := db.New(database.Pool)
	levels, err := q.ListProductStockLevels(c.Context(), tenantID)
	if err != nil {
		log.Printf("ListProductStockLevels error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load stock levels"})
	}

	return c.JSON(levels)
}

// ListTransactions returns recent inventory transactions (stock ledger)
func ListTransactions(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListTransactions(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	limit := int32(100)
	if l := c.Query("limit"); l != "" {
		if n, err := parseInt32(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	var productID *pgtype.UUID
	if pidStr := c.Query("product_id"); pidStr != "" {
		pid, err := toUUID(pidStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product_id"})
		}
		productID = &pid
	}
	var warehouseID *pgtype.UUID
	if widStr := c.Query("warehouse_id"); widStr != "" {
		wid, err := toUUID(widStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid warehouse_id"})
		}
		warehouseID = &wid
	}

	q := db.New(database.Pool)
	// If no scoped filters, use sqlc-generated query.
	if productID == nil && warehouseID == nil {
		txs, err := q.ListInventoryTransactions(c.Context(), db.ListInventoryTransactionsParams{
			TenantID: tenantID,
			Limit:    limit,
		})
		if err != nil {
			log.Printf("ListInventoryTransactions error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load transactions"})
		}
		return c.JSON(txs)
	}

	// Scoped ledger (product_id and/or warehouse_id) via direct SQL (sqlc not required).
	sql := "SELECT id, tenant_id, product_id, warehouse_id, batch_id, transaction_type, transaction_reason, quantity, reference_id, notes, created_by, created_at FROM inventory_transactions WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argN := 2
	if productID != nil {
		sql += fmt.Sprintf(" AND product_id = $%d", argN)
		args = append(args, *productID)
		argN++
	}
	if warehouseID != nil {
		sql += fmt.Sprintf(" AND warehouse_id = $%d", argN)
		args = append(args, *warehouseID)
		argN++
	}
	sql += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argN)
	args = append(args, limit)

	rows, err := database.Pool.Query(c.Context(), sql, args...)
	if err != nil {
		log.Printf("ListTransactions scoped query error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load transactions"})
	}
	defer rows.Close()

	out := make([]db.InventoryTransaction, 0, 50)
	for rows.Next() {
		var t db.InventoryTransaction
		if err := rows.Scan(
			&t.ID, &t.TenantID, &t.ProductID, &t.WarehouseID, &t.BatchID,
			&t.TransactionType, &t.TransactionReason, &t.Quantity,
			&t.ReferenceID, &t.Notes, &t.CreatedBy, &t.CreatedAt,
		); err != nil {
			log.Printf("ListTransactions scan error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse transactions"})
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("ListTransactions rows error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load transactions"})
	}
	return c.JSON(out)
}

// GetInventoryKpis returns top-of-page KPI aggregates for the inventory module.
func GetInventoryKpis(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetInventoryKpis(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	deadDays := int32(90)
	if s := c.Query("dead_days"); s != "" {
		if n, err := parseInt32(s); err == nil && n >= 0 && n <= 3650 {
			deadDays = n
		}
	}
	q := db.New(database.Pool)

	// Total inventory value (existing report query).
	totalVal, err := q.GetInventoryValuation(c.Context(), tenantID)
	if err != nil {
		log.Printf("GetInventoryValuation error (KPIs): %v", err)
		totalVal = pgtype.Numeric{}
	}

	// Total SKUs.
	var totalSkus int64
	if err := database.Pool.QueryRow(c.Context(), "SELECT COUNT(*)::BIGINT FROM products WHERE tenant_id = $1", tenantID).Scan(&totalSkus); err != nil {
		log.Printf("total_skus query error: %v", err)
	}

	// Low stock items count.
	var lowStock int64
	lowStockSQL := `
		WITH stock AS (
		  SELECT product_id, COALESCE(SUM(CASE WHEN transaction_type='IN' THEN quantity WHEN transaction_type='OUT' THEN -quantity ELSE 0 END),0) AS on_hand
		  FROM inventory_transactions
		  WHERE tenant_id = $1
		  GROUP BY product_id
		)
		SELECT COUNT(*)::BIGINT
		FROM products p
		LEFT JOIN stock s ON s.product_id = p.id
		WHERE p.tenant_id = $1
		  AND p.reorder_point > 0
		  AND COALESCE(s.on_hand,0) < p.reorder_point;
	`
	if err := database.Pool.QueryRow(c.Context(), lowStockSQL, tenantID).Scan(&lowStock); err != nil {
		log.Printf("low_stock_items query error: %v", err)
	}

	// Out of stock items count.
	var outOfStock int64
	outOfStockSQL := `
		WITH stock AS (
		  SELECT product_id, COALESCE(SUM(CASE WHEN transaction_type='IN' THEN quantity WHEN transaction_type='OUT' THEN -quantity ELSE 0 END),0) AS on_hand
		  FROM inventory_transactions
		  WHERE tenant_id = $1
		  GROUP BY product_id
		)
		SELECT COUNT(*)::BIGINT
		FROM products p
		LEFT JOIN stock s ON s.product_id = p.id
		WHERE p.tenant_id = $1
		  AND COALESCE(s.on_hand,0) <= 0;
	`
	if err := database.Pool.QueryRow(c.Context(), outOfStockSQL, tenantID).Scan(&outOfStock); err != nil {
		log.Printf("out_of_stock_items query error: %v", err)
	}

	// Reserved qty.
	var reservedQty pgtype.Numeric
	if err := database.Pool.QueryRow(c.Context(),
		"SELECT COALESCE(SUM(quantity),0)::DECIMAL FROM inventory_reservations WHERE tenant_id=$1 AND status='ACTIVE'",
		tenantID,
	).Scan(&reservedQty); err != nil {
		log.Printf("reserved_qty query error: %v", err)
		reservedQty = pgtype.Numeric{}
	}

	// In transit qty.
	var inTransitQty pgtype.Numeric
	if err := database.Pool.QueryRow(c.Context(),
		"SELECT COALESCE(SUM(quantity),0)::DECIMAL FROM warehouse_transfers WHERE tenant_id=$1 AND status='PENDING'",
		tenantID,
	).Scan(&inTransitQty); err != nil {
		log.Printf("in_transit_qty query error: %v", err)
		inTransitQty = pgtype.Numeric{}
	}

	// Dead stock items count (no movement in N days, but on-hand > 0).
	var deadStock int64
	deadStockSQL := `
		WITH stock AS (
		  SELECT
		    product_id,
		    MAX(created_at) AS last_movement_at,
		    COALESCE(SUM(CASE WHEN transaction_type='IN' THEN quantity WHEN transaction_type='OUT' THEN -quantity ELSE 0 END),0) AS on_hand
		  FROM inventory_transactions
		  WHERE tenant_id = $1
		  GROUP BY product_id
		)
		SELECT COUNT(*)::BIGINT
		FROM products p
		LEFT JOIN stock s ON s.product_id = p.id
		WHERE p.tenant_id = $1
		  AND COALESCE(s.on_hand,0) > 0
		  AND (s.last_movement_at IS NULL OR s.last_movement_at < (NOW() - ($2::int || ' days')::interval));
	`
	if err := database.Pool.QueryRow(c.Context(), deadStockSQL, tenantID, deadDays).Scan(&deadStock); err != nil {
		log.Printf("dead_stock_items query error: %v", err)
	}

	return c.JSON(fiber.Map{
		"total_skus":            totalSkus,
		"total_inventory_value": totalVal,
		"low_stock_items":       lowStock,
		"out_of_stock_items":    outOfStock,
		"reserved_qty":          reservedQty,
		"in_transit_qty":        inTransitQty,
		"dead_stock_items":      deadStock,
		"dead_days":             deadDays,
	})
}

func parseInt32(s string) (int32, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return int32(n), err
}

// GetStock returns the current total stock for a given product
func GetStock(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	productIDRaw := c.Params("productID")
	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	q := db.New(database.Pool)
	stock, err := q.GetProductStock(c.Context(), db.GetProductStockParams{
		ProductID: productID,
		TenantID:  tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get stock level"})
	}

	return c.JSON(fiber.Map{"stock_level": stock})
}

// ListStockByWarehouse returns stock quantity per product per warehouse.
func ListStockByWarehouse(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListStockByWarehouse(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	q := db.New(database.Pool)
	rows, err := q.ListStockByWarehouse(c.Context(), tenantID)
	if err != nil {
		log.Printf("ListStockByWarehouse error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load stock by warehouse"})
	}
	return c.JSON(rows)
}

// ListLowStockAlerts returns products below reorder point.
func ListLowStockAlerts(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListLowStockAlerts(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	q := db.New(database.Pool)
	rows, err := q.ListProductsBelowReorderPoint(c.Context(), tenantID)
	if err != nil {
		log.Printf("ListProductsBelowReorderPoint error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load low-stock alerts"})
	}
	return c.JSON(rows)
}

// GetInventoryValuationReport returns total inventory valuation and per-product breakdown.
func GetInventoryValuationReport(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return c.JSON(fiber.Map{"total_valuation": "0", "by_product": []interface{}{}})
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	q := db.New(database.Pool)
	ctx := c.Context()
	total, err := q.GetInventoryValuation(ctx, tenantID)
	if err != nil {
		log.Printf("GetInventoryValuation error: %v", err)
		total = pgtype.Numeric{}
	}
	byProduct, err := q.ListInventoryValuationByProduct(ctx, tenantID)
	if err != nil {
		log.Printf("ListInventoryValuationByProduct error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load valuation by product"})
	}
	return c.JSON(fiber.Map{
		"total_valuation": total,
		"by_product":      byProduct,
	})
}

// CreateBatch creates a product batch (lot).
func CreateBatch(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	var req struct {
		ProductID       string  `json:"product_id"`
		BatchNumber     string  `json:"batch_number"`
		ManufactureDate *string `json:"manufacture_date"`
		ExpiryDate      *string `json:"expiry_date"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	productID, _ := toUUID(req.ProductID)
	var mfgDate, expDate pgtype.Date
	if req.ManufactureDate != nil && *req.ManufactureDate != "" {
		mfgDate.Scan(*req.ManufactureDate)
	}
	if req.ExpiryDate != nil && *req.ExpiryDate != "" {
		expDate.Scan(*req.ExpiryDate)
	}
	q := db.New(database.Pool)
	batch, err := q.CreateProductBatch(c.Context(), db.CreateProductBatchParams{
		TenantID:        tenantID,
		ProductID:       productID,
		BatchNumber:     req.BatchNumber,
		ManufactureDate: mfgDate,
		ExpiryDate:      expDate,
	})
	if err != nil {
		log.Printf("CreateProductBatch error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create batch"})
	}
	return c.Status(fiber.StatusCreated).JSON(batch)
}

// ListBatches returns batches for a product.
func ListBatches(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListBatches(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	productIDRaw := c.Params("productID")
	productID, err := toUUID(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}
	q := db.New(database.Pool)
	batches, err := q.ListBatchesByProduct(c.Context(), db.ListBatchesByProductParams{
		TenantID:  tenantID,
		ProductID: productID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load batches"})
	}
	return c.JSON(batches)
}

// CreateReservation reserves quantity for a reference (e.g. sales order).
func CreateReservation(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	var req struct {
		ProductID     string  `json:"product_id"`
		WarehouseID   string  `json:"warehouse_id"`
		Quantity      string  `json:"quantity"`
		ReferenceType string  `json:"reference_type"`
		ReferenceID   string  `json:"reference_id"`
		ExpiresAt     *string `json:"expires_at"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	productID, _ := toUUID(req.ProductID)
	warehouseID, _ := toUUID(req.WarehouseID)
	refID, _ := toUUID(req.ReferenceID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)
	var expiresAt pgtype.Timestamptz
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		expiresAt.Scan(*req.ExpiresAt)
	}
	q := db.New(database.Pool)
	res, err := q.CreateInventoryReservation(c.Context(), db.CreateInventoryReservationParams{
		TenantID:      tenantID,
		ProductID:     productID,
		WarehouseID:   warehouseID,
		Quantity:      qty,
		ReferenceType: req.ReferenceType,
		ReferenceID:   refID,
		ExpiresAt:     expiresAt,
		CreatedBy:     userID,
	})
	if err != nil {
		log.Printf("CreateInventoryReservation error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create reservation"})
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

// ListReservations returns active reservations.
func ListReservations(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListReservations(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	limit := int32(100)
	if l := c.Query("limit"); l != "" {
		if n, err := parseInt32(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}
	q := db.New(database.Pool)
	list, err := q.ListReservations(c.Context(), db.ListReservationsParams{TenantID: tenantID, Limit: limit})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load reservations"})
	}
	return c.JSON(list)
}

// ReleaseReservation cancels a reservation.
func ReleaseReservation(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	resIDRaw := c.Params("id")
	resID, err := toUUID(resIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid reservation ID"})
	}
	q := db.New(database.Pool)
	err = q.UpdateReservationStatus(c.Context(), db.UpdateReservationStatusParams{
		ID: resID, TenantID: tenantID, Status: "CANCELLED",
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to release reservation"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Reservation released"})
}

// CreateTransfer creates a pending warehouse transfer.
func CreateTransfer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	var req struct {
		FromWarehouseID string `json:"from_warehouse_id"`
		ToWarehouseID   string `json:"to_warehouse_id"`
		ProductID       string `json:"product_id"`
		Quantity        string `json:"quantity"`
		Notes           string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	fromID, _ := toUUID(req.FromWarehouseID)
	toID, _ := toUUID(req.ToWarehouseID)
	productID, _ := toUUID(req.ProductID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)
	var notes pgtype.Text
	notes.Scan(req.Notes)
	q := db.New(database.Pool)
	tr, err := q.CreateWarehouseTransfer(c.Context(), db.CreateWarehouseTransferParams{
		TenantID:        tenantID,
		FromWarehouseID: fromID,
		ToWarehouseID:   toID,
		ProductID:       productID,
		Quantity:        qty,
		Notes:           notes,
		CreatedBy:       userID,
	})
	if err != nil {
		log.Printf("CreateWarehouseTransfer error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create transfer"})
	}
	return c.Status(fiber.StatusCreated).JSON(tr)
}

// ListTransfers returns warehouse transfers.
func ListTransfers(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListTransfers(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	limit := int32(50)
	if l := c.Query("limit"); l != "" {
		if n, err := parseInt32(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	q := db.New(database.Pool)
	list, err := q.ListWarehouseTransfers(c.Context(), db.ListWarehouseTransfersParams{TenantID: tenantID, Limit: limit})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load transfers"})
	}
	return c.JSON(list)
}

// CompleteTransfer marks transfer completed and creates OUT + IN transactions.
func CompleteTransfer(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	transferIDRaw := c.Params("id")
	transferID, err := toUUID(transferIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid transfer ID"})
	}
	q := db.New(database.Pool)
	tr, err := q.GetWarehouseTransfer(c.Context(), db.GetWarehouseTransferParams{ID: transferID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Transfer not found"})
	}
	if tr.Status == "COMPLETED" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Transfer already completed"})
	}
	var reason pgtype.Text
	reason.Scan("TRANSFER")
	// OUT from source
	_, err = q.CreateInventoryTransaction(c.Context(), db.CreateInventoryTransactionParams{
		TenantID:          tenantID,
		ProductID:         tr.ProductID,
		WarehouseID:       tr.FromWarehouseID,
		BatchID:           pgtype.UUID{},
		TransactionType:   "OUT",
		TransactionReason: reason,
		Quantity:          tr.Quantity,
		ReferenceID:       transferID,
		Notes:             tr.Notes,
		CreatedBy:         userID,
	})
	if err != nil {
		log.Printf("CompleteTransfer OUT error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record OUT transaction"})
	}
	// IN to destination
	_, err = q.CreateInventoryTransaction(c.Context(), db.CreateInventoryTransactionParams{
		TenantID:          tenantID,
		ProductID:         tr.ProductID,
		WarehouseID:       tr.ToWarehouseID,
		BatchID:           pgtype.UUID{},
		TransactionType:   "IN",
		TransactionReason: reason,
		Quantity:          tr.Quantity,
		ReferenceID:       transferID,
		Notes:             tr.Notes,
		CreatedBy:         userID,
	})
	if err != nil {
		log.Printf("CompleteTransfer IN error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record IN transaction"})
	}
	err = q.CompleteWarehouseTransfer(c.Context(), db.CompleteWarehouseTransferParams{ID: transferID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete transfer"})
	}
	tr.Status = "COMPLETED"
	return c.JSON(tr)
}
