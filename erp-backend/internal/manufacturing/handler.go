package manufacturing

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

type CreateBOMRequest struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	Version   string `json:"version"`
}

type CreateWorkOrderRequest struct {
	WONumber     string  `json:"wo_number"`
	BOMID        *string `json:"bom_id"`
	ProductID    string  `json:"product_id"`
	SalesOrderID *string `json:"sales_order_id"`
	PlannedQty   string  `json:"planned_quantity"`
	StartDate    string  `json:"start_date"`
	EndDate      string  `json:"end_date"`
}

type ProductionLogRequest struct {
	WorkOrderID string  `json:"work_order_id"`
	WarehouseID string  `json:"warehouse_id"`
	Quantity    string  `json:"quantity"`
	Notes       *string `json:"notes"`
}

type MaterialConsumptionRequest struct {
	WorkOrderID string `json:"work_order_id"`
	ProductID   string `json:"product_id"`
	WarehouseID string `json:"warehouse_id"`
	Quantity    string `json:"quantity"`
}

type UpdateWorkOrderStatusRequest struct {
	Status string `json:"status"`
}

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

func CreateBOM(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)

	var req CreateBOMRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	productID, _ := toUUID(req.ProductID)
	version := "1.0"
	if req.Version != "" {
		version = req.Version
	}

	q := db.New(database.Pool)
	bom, err := q.CreateBOM(c.Context(), db.CreateBOMParams{
		TenantID:  tenantID,
		ProductID: productID,
		Name:      req.Name,
		Version:   version,
		IsActive:  true,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create BOM"})
	}

	return c.Status(fiber.StatusCreated).JSON(bom)
}

func ListBOMs(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListBOMs(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListBOMs(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list BOMs"})
	}
	return c.JSON(list)
}

func CreateWorkOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req CreateWorkOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	productID, _ := toUUID(req.ProductID)

	var bomID pgtype.UUID
	if req.BOMID != nil {
		bomID.Scan(*req.BOMID)
	}
	var soID pgtype.UUID
	if req.SalesOrderID != nil {
		soID.Scan(*req.SalesOrderID)
	}

	var plannedQty pgtype.Numeric
	plannedQty.Scan(req.PlannedQty)

	var startDate pgtype.Date
	if req.StartDate != "" {
		sd, _ := time.Parse("2006-01-02", req.StartDate)
		startDate.Scan(sd)
	}

	var endDate pgtype.Date
	if req.EndDate != "" {
		ed, _ := time.Parse("2006-01-02", req.EndDate)
		endDate.Scan(ed)
	}

	q := db.New(database.Pool)

	// Create mapping for date correctly using helper workaround
	var finalStartDate pgtype.Date
	if req.StartDate != "" {
		sd, _ := time.Parse("2006-01-02", req.StartDate)
		finalStartDate.Scan(sd)
	}

	wo, err := q.CreateWorkOrder(c.Context(), db.CreateWorkOrderParams{
		TenantID:        tenantID,
		WoNumber:        req.WONumber,
		BomID:           bomID,
		ProductID:       productID,
		SalesOrderID:    soID,
		Status:          "PLANNED",
		PlannedQuantity: plannedQty,
		StartDate:       finalStartDate,
		EndDate:         endDate,
		CreatedBy:       userID,
	})
	if err != nil {
		log.Printf("CreateWO error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create Work Order"})
	}
	return c.Status(fiber.StatusCreated).JSON(wo)
}

func ListWorkOrders(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWorkOrders(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListWorkOrders(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list work orders"})
	}
	return c.JSON(list)
}

func GetWorkOrder(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetWorkOrder(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	woID := c.Params("id")
	if woID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Work order ID required"})
	}
	id, err := toUUID(woID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid work order ID"})
	}
	q := db.New(database.Pool)
	wo, err := q.GetWorkOrder(c.Context(), db.GetWorkOrderParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Work order not found"})
	}
	return c.JSON(wo)
}

func ListProductionLogsByWorkOrder(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListProductionLogsByWorkOrder(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	woID := c.Params("id")
	if woID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Work order ID required"})
	}
	id, err := toUUID(woID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid work order ID"})
	}
	q := db.New(database.Pool)
	list, err := q.ListProductionLogsByWorkOrder(c.Context(), db.ListProductionLogsByWorkOrderParams{
		WorkOrderID: id,
		TenantID:    tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list production logs"})
	}
	return c.JSON(list)
}

func ListMaterialConsumptionByWorkOrder(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListMaterialConsumptionByWorkOrder(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	woID := c.Params("id")
	if woID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Work order ID required"})
	}
	id, err := toUUID(woID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid work order ID"})
	}
	q := db.New(database.Pool)
	list, err := q.ListMaterialConsumptionByWorkOrder(c.Context(), db.ListMaterialConsumptionByWorkOrderParams{
		WorkOrderID: id,
		TenantID:    tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list material consumption"})
	}
	return c.JSON(list)
}

func UpdateWorkOrderStatus(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	woID := c.Params("id")
	if woID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Work order ID required"})
	}
	id, err := toUUID(woID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid work order ID"})
	}
	var req UpdateWorkOrderStatusRequest
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Status is required"})
	}
	q := db.New(database.Pool)
	err = q.UpdateWorkOrderStatus(c.Context(), db.UpdateWorkOrderStatusParams{
		Status:   req.Status,
		ID:       id,
		TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update work order status"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Updated"})
}

func RecordMaterialConsumption(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req MaterialConsumptionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	woID, _ := toUUID(req.WorkOrderID)
	productID, _ := toUUID(req.ProductID)
	whID, _ := toUUID(req.WarehouseID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)

	q := db.New(database.Pool)
	rec, err := q.RecordMaterialConsumption(c.Context(), db.RecordMaterialConsumptionParams{
		TenantID:    tenantID,
		WorkOrderID: woID,
		ProductID:   productID,
		WarehouseID: whID,
		Quantity:    qty,
		RecordedBy:  userID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record material consumption"})
	}
	return c.Status(fiber.StatusCreated).JSON(rec)
}

func RecordProductionLog(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)

	var req ProductionLogRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	woID, _ := toUUID(req.WorkOrderID)
	whID, _ := toUUID(req.WarehouseID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)

	var notes pgtype.Text
	if req.Notes != nil {
		notes.Scan(*req.Notes)
	}

	ctx := c.Context()

	// We should ideally act in a Tx here to also update WO stock and append into inventory
	q := db.New(database.Pool)

	logRecord, err := q.RecordProductionLog(ctx, db.RecordProductionLogParams{
		TenantID:    tenantID,
		WorkOrderID: woID,
		WarehouseID: whID,
		Quantity:    qty,
		Notes:       notes,
		RecordedBy:  userID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to log production"})
	}

	// Update Work Order incrementing its produced qty
	err = q.UpdateWorkOrderProducedQty(ctx, db.UpdateWorkOrderProducedQtyParams{
		ProducedQuantity: qty,
		ID:               woID,
		TenantID:         tenantID,
	})
	if err != nil {
		log.Printf("Warning: Failed to update WO increment but recorded log: %v", err)
	}

	return c.Status(fiber.StatusCreated).JSON(logRecord)
}
