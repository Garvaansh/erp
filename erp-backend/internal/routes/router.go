package routes

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/reva-erp/backend/internal/audit"
	"github.com/reva-erp/backend/internal/auth"
	"github.com/reva-erp/backend/internal/finance"
	"github.com/reva-erp/backend/internal/inventory"
	"github.com/reva-erp/backend/internal/manufacturing"
	"github.com/reva-erp/backend/internal/notifications"
	"github.com/reva-erp/backend/internal/org"
	"github.com/reva-erp/backend/internal/purchase"
	"github.com/reva-erp/backend/internal/reports"
	"github.com/reva-erp/backend/internal/reva"
	"github.com/reva-erp/backend/internal/sales"
	"github.com/reva-erp/backend/internal/tenant"
	"github.com/reva-erp/backend/pkg/middleware"
)

func SetupRoutes(app *fiber.App) {
	// Root endpoint
	app.Get("/", func(c *fiber.Ctx) error {
		return c.Status(200).JSON(fiber.Map{
			"message": "Welcome to Reva ERP SaaS API",
		})
	})

	api := app.Group("/api/v1")

	// Authentication module
	setupAuthRoutes(api)

	// Users module
	setupUserRoutes(api)

	// Tenant configuration (settings)
	setupTenantRoutes(api)

	// Inventory module
	setupInventoryRoutes(api)

	// Purchase module
	setupPurchaseRoutes(api)

	// Sales module
	setupSalesRoutes(api)

	// Manufacturing module
	setupManufacturingRoutes(api)

	// Reports module
	setupReportRoutes(api)

	// Reva domain (coil consumption, purchase history, stock by type)
	setupRevaRoutes(api)

	// Audit & Compliance
	setupAuditRoutes(api)

	// Organization (company codes, plants)
	setupOrgRoutes(api)

	// Finance (chart of accounts, G/L accounts, cost centers)
	setupFinanceRoutes(api)

	// Notifications (WhatsApp)
	notifications.SetupRoutes(api)
}

func setupRevaRoutes(router fiber.Router) {
	revaGrp := router.Group("/reva")
	revaGrp.Use(middleware.JWTProtected())
	revaGrp.Use(middleware.MockData())

	// Coil consumption log (REVA-26)
	revaGrp.Post("/coil-consumption", reva.CreateCoilConsumptionLog)
	revaGrp.Post("/coil-consumption/bulk", reva.BulkCreateCoilConsumptionLogs)
	revaGrp.Get("/coil-consumption", reva.ListCoilConsumptionLogs)
	revaGrp.Get("/coil-consumption/product/:productId", reva.ListCoilConsumptionLogsByProduct)
	revaGrp.Get("/coil-consumption/product/:productId/last-remaining", reva.GetLastCoilRemaining)

	// Purchase history (Reva item purchase history view)
	revaGrp.Get("/purchase-history", reva.ListPurchaseHistory)

	// Stock levels with Reva fields (STOCK COIL tab). Query: category_id (optional)
	revaGrp.Get("/stock-levels", reva.ListStockLevelsWithReva)
	// Company profile (Reva name, address, GST, contact)
	revaGrp.Get("/company-profile", reva.GetCompanyProfile)
	revaGrp.Put("/company-profile", reva.UpsertCompanyProfile)
}

func setupTenantRoutes(router fiber.Router) {
	tenantGrp := router.Group("/tenant")
	tenantGrp.Use(middleware.JWTProtected())
	tenantGrp.Get("/settings", tenant.GetTenantSettings)
	tenantGrp.Put("/settings", tenant.UpdateTenantSettings)
}

func setupAuditRoutes(router fiber.Router) {
	auditGrp := router.Group("/audit")
	auditGrp.Use(middleware.JWTProtected())
	auditGrp.Use(middleware.MockData())
	auditGrp.Get("/logs", audit.ListAuditLogs)
	auditGrp.Get("/logs/entity", audit.ListAuditLogsByEntity)
}

func setupOrgRoutes(router fiber.Router) {
	orgGrp := router.Group("/organization")
	orgGrp.Use(middleware.JWTProtected())

	orgGrp.Get("/company-codes", org.ListCompanyCodes)
	orgGrp.Get("/company-codes/:id", org.GetCompanyCode)
	orgGrp.Post("/company-codes", org.CreateCompanyCode)
	orgGrp.Put("/company-codes/:id", org.UpdateCompanyCode)
	orgGrp.Delete("/company-codes/:id", org.DeleteCompanyCode)

	orgGrp.Get("/plants", org.ListPlants)
	orgGrp.Get("/plants/:id", org.GetPlant)
	orgGrp.Post("/plants", org.CreatePlant)
	orgGrp.Put("/plants/:id", org.UpdatePlant)
	orgGrp.Delete("/plants/:id", org.DeletePlant)
}

func setupFinanceRoutes(router fiber.Router) {
	finGrp := router.Group("/finance")
	finGrp.Use(middleware.JWTProtected())

	finGrp.Get("/chart-of-accounts", finance.ListChartOfAccounts)
	finGrp.Get("/chart-of-accounts/:id", finance.GetChartOfAccounts)
	finGrp.Post("/chart-of-accounts", finance.CreateChartOfAccounts)
	finGrp.Put("/chart-of-accounts/:id", finance.UpdateChartOfAccounts)
	finGrp.Delete("/chart-of-accounts/:id", finance.DeleteChartOfAccounts)

	finGrp.Get("/gl-accounts", finance.ListGLAccounts)
	finGrp.Get("/gl-accounts/:id", finance.GetGLAccount)
	finGrp.Post("/gl-accounts", finance.CreateGLAccount)
	finGrp.Put("/gl-accounts/:id", finance.UpdateGLAccount)
	finGrp.Delete("/gl-accounts/:id", finance.DeleteGLAccount)

	finGrp.Get("/cost-centers", finance.ListCostCenters)
	finGrp.Get("/cost-centers/:id", finance.GetCostCenter)
	finGrp.Post("/cost-centers", finance.CreateCostCenter)
	finGrp.Put("/cost-centers/:id", finance.UpdateCostCenter)
	finGrp.Delete("/cost-centers/:id", finance.DeleteCostCenter)
}

// Module Stubs
func setupAuthRoutes(router fiber.Router) {
	authGroup := router.Group("/auth")
	authGroup.Post("/register", auth.Register)
	authGroup.Post("/login", auth.Login)
}

func setupUserRoutes(router fiber.Router) {
	users := router.Group("/users")
	users.Get("/", func(c *fiber.Ctx) error { return c.SendStatus(200) })
}

func setupInventoryRoutes(router fiber.Router) {
	invGroup := router.Group("/inventory")
	// Protect all inventory routes
	invGroup.Use(middleware.JWTProtected())
	invGroup.Use(middleware.MockData())

	// Product categories (Reva IndiaMART catalog)
	invGroup.Get("/categories", inventory.ListProductCategories)
	invGroup.Post("/categories", inventory.CreateProductCategory)
	// Products
	invGroup.Get("/products", inventory.ListProducts)
	invGroup.Post("/products", inventory.CreateProduct)
	invGroup.Post("/products/bulk", inventory.BulkCreateProducts)
	invGroup.Get("/products/by-scan", inventory.GetProductByScan)
	invGroup.Get("/products/:id/qrcode", inventory.GetProductQRCode)
	invGroup.Get("/products/:id", inventory.GetProduct)
	invGroup.Put("/products/:id", inventory.UpdateProduct)
	invGroup.Delete("/products/:id", inventory.DeleteProduct)

	// Warehouses
	invGroup.Get("/warehouses", inventory.ListWarehouses)
	invGroup.Post("/warehouses", inventory.CreateWarehouse)
	// Warehouse hierarchy: zone -> rack -> shelf -> bin
	invGroup.Get("/warehouses/:warehouseId/zones", inventory.ListWarehouseZones)
	invGroup.Post("/warehouses/:warehouseId/zones", inventory.CreateWarehouseZone)
	invGroup.Get("/zones/:zoneId/racks", inventory.ListWarehouseRacks)
	invGroup.Post("/zones/:zoneId/racks", inventory.CreateWarehouseRack)
	invGroup.Get("/racks/:rackId/shelves", inventory.ListWarehouseShelves)
	invGroup.Post("/racks/:rackId/shelves", inventory.CreateWarehouseShelf)
	invGroup.Get("/shelves/:shelfId/bins", inventory.ListWarehouseBins)
	invGroup.Post("/shelves/:shelfId/bins", inventory.CreateWarehouseBin)

	// Inventory & ledger
	invGroup.Get("/stock-levels", inventory.ListStockLevels)
	invGroup.Get("/stock-by-warehouse", inventory.ListStockByWarehouse)
	invGroup.Get("/low-stock-alerts", inventory.ListLowStockAlerts)
	invGroup.Get("/kpis", inventory.GetInventoryKpis)
	invGroup.Get("/transactions", inventory.ListTransactions)
	invGroup.Get("/product/:productID/stock", inventory.GetStock)
	invGroup.Post("/transaction", inventory.RecordTransaction)

	// Batches (lot tracking)
	invGroup.Post("/batches", inventory.CreateBatch)
	invGroup.Get("/product/:productID/batches", inventory.ListBatches)

	// Reservations
	invGroup.Post("/reservations", inventory.CreateReservation)
	invGroup.Get("/reservations", inventory.ListReservations)
	invGroup.Delete("/reservations/:id", inventory.ReleaseReservation)

	// Warehouse transfers
	invGroup.Post("/transfers", inventory.CreateTransfer)
	invGroup.Get("/transfers", inventory.ListTransfers)
	invGroup.Post("/transfers/:id/complete", inventory.CompleteTransfer)

	// Inventory reports
	invGroup.Get("/reports/valuation", inventory.GetInventoryValuationReport)
}

func setupPurchaseRoutes(router fiber.Router) {
	purchaseGrp := router.Group("/purchase")
	purchaseGrp.Use(middleware.JWTProtected())
	purchaseGrp.Use(middleware.MockData())

	// Vendors
	purchaseGrp.Get("/vendors", purchase.ListVendors)
	purchaseGrp.Post("/vendors", purchase.CreateVendor)
	purchaseGrp.Post("/vendors/bulk", purchase.BulkCreateVendors)
	purchaseGrp.Get("/vendors/:id", purchase.GetVendor)
	purchaseGrp.Put("/vendors/:id", purchase.UpdateVendor)
	purchaseGrp.Delete("/vendors/:id", purchase.DeleteVendor)

	// Purchase Orders
	purchaseGrp.Get("/purchase-orders", purchase.ListPurchaseOrders)
	purchaseGrp.Post("/purchase-orders", purchase.CreatePurchaseOrder)
	purchaseGrp.Get("/purchase-orders/:id", purchase.GetPurchaseOrder)
	purchaseGrp.Get("/purchase-orders/:id/items", purchase.ListPurchaseOrderItems)
	purchaseGrp.Post("/purchase-orders/item", purchase.AddPOItem)
	purchaseGrp.Patch("/purchase-orders/:id/status", purchase.UpdatePurchaseOrderStatus)

	purchaseGrp.Get("/goods-receipts", purchase.ListGoodsReceipts)
	purchaseGrp.Post("/goods-receipts", purchase.CreateGoodsReceipt)
	purchaseGrp.Get("/goods-receipts/:id", purchase.GetGoodsReceipt)

	purchaseGrp.Get("/vendor-invoices", purchase.ListVendorInvoices)
	purchaseGrp.Post("/vendor-invoices", purchase.CreateVendorInvoice)
	purchaseGrp.Get("/vendor-invoices/:id", purchase.GetVendorInvoice)
	purchaseGrp.Patch("/vendor-invoices/:id/tds", purchase.UpdateVendorInvoiceTDS)

	// Purchase requisitions
	purchaseGrp.Get("/requisitions", purchase.ListPurchaseRequisitions)
	purchaseGrp.Post("/requisitions", purchase.CreatePurchaseRequisition)
	purchaseGrp.Get("/requisitions/:id", purchase.GetPurchaseRequisition)
	purchaseGrp.Get("/requisitions/:id/items", purchase.ListPurchaseRequisitionItems)
	purchaseGrp.Patch("/requisitions/:id/status", purchase.UpdatePurchaseRequisitionStatus)
}

func setupSalesRoutes(router fiber.Router) {
	salesGrp := router.Group("/sales")
	salesGrp.Use(middleware.JWTProtected())
	salesGrp.Use(middleware.MockData())

	// Customers
	salesGrp.Get("/customers", sales.ListCustomers)
	salesGrp.Post("/customers", sales.CreateCustomer)
	salesGrp.Post("/customers/bulk", sales.BulkCreateCustomers)
	salesGrp.Get("/customers/:id", sales.GetCustomer)
	salesGrp.Put("/customers/:id", sales.UpdateCustomer)
	salesGrp.Delete("/customers/:id", sales.DeleteCustomer)

	// Sales Orders
	salesGrp.Get("/sales-orders", sales.ListSalesOrders)
	salesGrp.Post("/sales-orders", sales.CreateSalesOrder)
	salesGrp.Get("/sales-orders/:id", sales.GetSalesOrder)
	salesGrp.Get("/sales-orders/:id/items", sales.ListSalesOrderItems)
	salesGrp.Patch("/sales-orders/:id/status", sales.UpdateSalesOrderStatus)
	salesGrp.Post("/sales-orders/item", sales.AddSalesOrderItem)
	salesGrp.Delete("/sales-orders/items/:id", sales.DeleteSalesOrderItem)

	// Invoices
	salesGrp.Get("/invoices", sales.ListInvoices)
	salesGrp.Get("/invoices/next-number", sales.GetNextInvoiceNumber)
	salesGrp.Get("/invoices/:id", sales.GetInvoice)
	salesGrp.Patch("/invoices/:id/status", sales.UpdateInvoiceStatus)
	salesGrp.Get("/invoices/:id/payments", sales.ListInvoicePayments)
	salesGrp.Post("/invoices/:id/payments", sales.CreatePayment)
	salesGrp.Get("/invoices/:id/line-items", sales.ListInvoiceLineItems)
	salesGrp.Post("/invoices/:id/line-items", sales.AddInvoiceLineItem)
	salesGrp.Post("/invoices", sales.CreateInvoice)

	// Shipments (logistics)
	salesGrp.Get("/shipments", sales.ListShipments)
	salesGrp.Post("/shipments", sales.CreateShipment)
	salesGrp.Get("/shipments/:id", sales.GetShipment)
	salesGrp.Get("/shipments/:id/lines", sales.ListShipmentLines)
	salesGrp.Patch("/shipments/:id/status", sales.UpdateShipmentStatus)
}

func setupManufacturingRoutes(router fiber.Router) {
	mfgGrp := router.Group("/manufacturing")
	mfgGrp.Use(middleware.JWTProtected())
	mfgGrp.Use(middleware.MockData())

	// BOM
	mfgGrp.Get("/bom", manufacturing.ListBOMs)
	mfgGrp.Post("/bom", manufacturing.CreateBOM)
	mfgGrp.Get("/bom/:bomId/items", manufacturing.ListBOMItemsByBOM)
	mfgGrp.Post("/bom/items", manufacturing.AddBOMItemHandler)

	// Production lines
	mfgGrp.Get("/production-lines", manufacturing.ListProductionLines)
	mfgGrp.Post("/production-lines", manufacturing.CreateProductionLine)
	mfgGrp.Get("/production-lines/:id", manufacturing.GetProductionLine)

	// Production orders (MRP parent)
	mfgGrp.Get("/production-orders", manufacturing.ListProductionOrders)
	mfgGrp.Post("/production-orders", manufacturing.CreateProductionOrder)
	mfgGrp.Get("/production-orders/:id/work-orders", manufacturing.ListWorkOrdersByProductionOrderID)
	mfgGrp.Get("/production-orders/:id", manufacturing.GetProductionOrder)
	mfgGrp.Patch("/production-orders/:id/status", manufacturing.UpdateProductionOrderStatus)
	mfgGrp.Post("/production-orders/:id/create-work-orders", manufacturing.CreateWorkOrdersFromProductionOrder)

	// Machines (scheduling)
	mfgGrp.Get("/machines", manufacturing.ListMachines)
	mfgGrp.Post("/machines", manufacturing.CreateMachine)

	// Work orders (specific paths before :id)
	mfgGrp.Get("/work-orders", manufacturing.ListWorkOrders)
	mfgGrp.Get("/work-orders/:id/production-logs", manufacturing.ListProductionLogsByWorkOrder)
	mfgGrp.Get("/work-orders/:id/material-consumption", manufacturing.ListMaterialConsumptionByWorkOrder)
	mfgGrp.Get("/work-orders/:id/quality-inspections", manufacturing.ListQualityInspectionsByWorkOrder)
	mfgGrp.Get("/work-orders/:id", manufacturing.GetWorkOrder)
	mfgGrp.Post("/work-orders", manufacturing.CreateWorkOrder)
	mfgGrp.Patch("/work-orders/:id", manufacturing.UpdateWorkOrderStatus)
	mfgGrp.Post("/production-log", manufacturing.RecordProductionLog)
	mfgGrp.Post("/material-consumption", manufacturing.RecordMaterialConsumption)

	// Quality inspections
	mfgGrp.Post("/quality-inspections", manufacturing.CreateQualityInspectionHandler)

	// MRP report (material requirements from open production orders)
	mfgGrp.Get("/mrp/report", manufacturing.GetMRPReport)
}

func setupReportRoutes(router fiber.Router) {
	reportsGrp := router.Group("/reports")
	reportsGrp.Use(middleware.JWTProtected())
	reportsGrp.Use(middleware.MockData())

	reportsGrp.Get("/", reports.GetReportSummary)
	reportsGrp.Get("/dashboard", reports.GetDashboardMetrics)
	// Export: rate-limited (15 requests per minute per IP)
	reportsGrp.Get("/export", limiter.New(limiter.Config{
		Max:        15,
		Expiration: 1 * time.Minute,
	}), reports.ExportReport)
	// Scheduled reports
	reportsGrp.Get("/schedules", reports.ListSchedules)
	reportsGrp.Post("/schedules", reports.CreateSchedule)
	reportsGrp.Delete("/schedules/:id", reports.DeleteSchedule)
	// India GSTR-ready exports (query: start_date, end_date YYYY-MM-DD)
	reportsGrp.Get("/gstr/outward", reports.GetGSTROutward)
	reportsGrp.Get("/gstr/inward", reports.GetGSTRInward)
	reportsGrp.Get("/gstr/sales-summary-by-hsn", reports.GetGSTRSalesSummaryByHSN)
	// GST calculation (CGST/SGST/IGST from state + rate)
	reportsGrp.Post("/gst/calculate", reports.CalculateGST)
}
