package manufacturing

import (
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

func numericToFloat64(n pgtype.Numeric) float64 {
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

// Default work order operation types created from a production order
var defaultOperationTypes = []string{"CUTTING", "WELDING", "POLISHING", "INSPECTION"}

// --- Production Lines ---
func ListProductionLines(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListProductionLines(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListProductionLines(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list production lines"})
	}
	return c.JSON(list)
}

func CreateProductionLine(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}
	var desc pgtype.Text
	if req.Description != nil {
		desc.Scan(*req.Description)
	}
	q := db.New(database.Pool)
	line, err := q.CreateProductionLine(c.Context(), db.CreateProductionLineParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: desc,
	})
	if err != nil {
		log.Printf("CreateProductionLine: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create production line"})
	}
	return c.Status(fiber.StatusCreated).JSON(line)
}

func GetProductionLine(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	id, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	line, err := q.GetProductionLine(c.Context(), db.GetProductionLineParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Production line not found"})
	}
	return c.JSON(line)
}

// --- Production Orders ---
func ListProductionOrders(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListProductionOrders(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListProductionOrders(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list production orders"})
	}
	return c.JSON(list)
}

func CreateProductionOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	var req struct {
		PONumber         string  `json:"po_number"`
		ProductID        string  `json:"product_id"`
		Quantity         string  `json:"quantity"`
		StartDate        string  `json:"start_date"`
		EndDate          string  `json:"end_date"`
		ProductionLineID *string `json:"production_line_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.PONumber == "" || req.ProductID == "" || req.Quantity == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "po_number, product_id, quantity required"})
	}
	productID, _ := toUUID(req.ProductID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)
	var startDate, endDate pgtype.Date
	if req.StartDate != "" {
		if t, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			startDate.Scan(t)
		}
	}
	if req.EndDate != "" {
		if t, err := time.Parse("2006-01-02", req.EndDate); err == nil {
			endDate.Scan(t)
		}
	}
	var lineID pgtype.UUID
	if req.ProductionLineID != nil && *req.ProductionLineID != "" {
		lineID.Scan(*req.ProductionLineID)
	}
	q := db.New(database.Pool)
	po, err := q.CreateProductionOrder(c.Context(), db.CreateProductionOrderParams{
		TenantID:         tenantID,
		PoNumber:         req.PONumber,
		ProductID:        productID,
		Quantity:         qty,
		StartDate:        startDate,
		EndDate:          endDate,
		ProductionLineID: lineID,
		Status:           "PLANNED",
		CreatedBy:        userID,
	})
	if err != nil {
		log.Printf("CreateProductionOrder: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create production order"})
	}
	return c.Status(fiber.StatusCreated).JSON(po)
}

func GetProductionOrder(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetProductionOrder(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	id, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	po, err := q.GetProductionOrder(c.Context(), db.GetProductionOrderParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Production order not found"})
	}
	return c.JSON(po)
}

// ListWorkOrdersByProductionOrderID returns work orders for a production order (route: GET /production-orders/:id/work-orders).
func ListWorkOrdersByProductionOrderID(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWorkOrdersByProductionOrderID(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	poID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid production order ID"})
	}
	q := db.New(database.Pool)
	list, err := q.ListWorkOrdersByProductionOrder(c.Context(), db.ListWorkOrdersByProductionOrderParams{
		ProductionOrderID: poID,
		TenantID:          tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list work orders"})
	}
	return c.JSON(list)
}

func UpdateProductionOrderStatus(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	id, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status required"})
	}
	q := db.New(database.Pool)
	err = q.UpdateProductionOrderStatus(c.Context(), db.UpdateProductionOrderStatusParams{
		ID: id, TenantID: tenantID, Status: req.Status,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Updated"})
}

// CreateWorkOrdersFromProductionOrder creates multiple work orders (Cutting, Welding, Polishing, Inspection) for a production order.
func CreateWorkOrdersFromProductionOrder(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	poID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid production order ID"})
	}
	q := db.New(database.Pool)
	po, err := q.GetProductionOrder(c.Context(), db.GetProductionOrderParams{ID: poID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Production order not found"})
	}
	existing, _ := q.ListWorkOrdersByProductionOrder(c.Context(), db.ListWorkOrdersByProductionOrderParams{
		ProductionOrderID: poID, TenantID: tenantID,
	})
	if len(existing) > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Work orders already exist for this production order"})
	}
	var created []db.WorkOrder
	for i, opType := range defaultOperationTypes {
		woNumber := po.PoNumber + "-" + opType
		var opTypeText pgtype.Text
		opTypeText.Scan(opType)
		wo, err := q.CreateWorkOrderForProductionOrder(c.Context(), db.CreateWorkOrderForProductionOrderParams{
			TenantID:          tenantID,
			WoNumber:          woNumber,
			BomID:             pgtype.UUID{},
			ProductID:         po.ProductID,
			SalesOrderID:      pgtype.UUID{},
			Status:            "PLANNED",
			PlannedQuantity:   po.Quantity,
			StartDate:         po.StartDate,
			EndDate:           po.EndDate,
			CreatedBy:         userID,
			ProductionOrderID: po.ID,
			OperationType:     opTypeText,
			Sequence:          int32(i + 1),
			MachineID:         pgtype.UUID{},
			ScheduledStart:    pgtype.Timestamptz{},
			ScheduledEnd:      pgtype.Timestamptz{},
		})
		if err != nil {
			log.Printf("CreateWorkOrderForProductionOrder: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create work orders"})
		}
		created = append(created, wo)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"created": len(created), "work_orders": created})
}

// --- Machines ---
func ListMachines(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListMachines(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	list, err := q.ListMachines(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list machines"})
	}
	return c.JSON(list)
}

func CreateMachine(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	var req struct {
		Name              string  `json:"name"`
		ProductionLineID  *string `json:"production_line_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name required"})
	}
	var lineID pgtype.UUID
	if req.ProductionLineID != nil && *req.ProductionLineID != "" {
		lineID.Scan(*req.ProductionLineID)
	}
	q := db.New(database.Pool)
	m, err := q.CreateMachine(c.Context(), db.CreateMachineParams{
		TenantID:         tenantID,
		ProductionLineID: lineID,
		Name:             req.Name,
	})
	if err != nil {
		log.Printf("CreateMachine: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create machine"})
	}
	return c.Status(fiber.StatusCreated).JSON(m)
}

// --- BOM Items ---
func ListBOMItemsByBOM(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListBOMItemsByBOM(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	bomID, err := toUUID(c.Params("bomId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid BOM ID"})
	}
	q := db.New(database.Pool)
	list, err := q.ListBOMItemsByBOM(c.Context(), db.ListBOMItemsByBOMParams{BomID: bomID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list BOM items"})
	}
	return c.JSON(list)
}

func AddBOMItemHandler(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	var req struct {
		BOMID               string  `json:"bom_id"`
		ComponentProductID  string  `json:"component_product_id"`
		Quantity            string  `json:"quantity"`
		Instructions        *string `json:"instructions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.BOMID == "" || req.ComponentProductID == "" || req.Quantity == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bom_id, component_product_id, quantity required"})
	}
	bomID, _ := toUUID(req.BOMID)
	compID, _ := toUUID(req.ComponentProductID)
	var qty pgtype.Numeric
	qty.Scan(req.Quantity)
	var instr pgtype.Text
	if req.Instructions != nil {
		instr.Scan(*req.Instructions)
	}
	q := db.New(database.Pool)
	item, err := q.AddBOMItem(c.Context(), db.AddBOMItemParams{
		TenantID:           tenantID,
		BomID:              bomID,
		ComponentProductID: compID,
		Quantity:           qty,
		Instructions:       instr,
	})
	if err != nil {
		log.Printf("AddBOMItem: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add BOM item"})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// --- Quality Inspections ---
func CreateQualityInspectionHandler(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	userIDRaw := c.Locals("user_id").(string)
	userID, _ := toUUID(userIDRaw)
	var req struct {
		WorkOrderID string  `json:"work_order_id"`
		Result      string  `json:"result"` // PASS, FAIL
		Notes       *string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.WorkOrderID == "" || (req.Result != "PASS" && req.Result != "FAIL") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "work_order_id and result (PASS/FAIL) required"})
	}
	woID, _ := toUUID(req.WorkOrderID)
	var notes pgtype.Text
	if req.Notes != nil {
		notes.Scan(*req.Notes)
	}
	inspectedAt := pgtype.Timestamptz{}
	inspectedAt.Scan(time.Now().UTC())
	q := db.New(database.Pool)
	ins, err := q.CreateQualityInspection(c.Context(), db.CreateQualityInspectionParams{
		TenantID:    tenantID,
		WorkOrderID: woID,
		Result:      req.Result,
		InspectorID: userID,
		Notes:       notes,
		InspectedAt: inspectedAt,
	})
	if err != nil {
		log.Printf("CreateQualityInspection: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record inspection"})
	}
	return c.Status(fiber.StatusCreated).JSON(ins)
}

func ListQualityInspectionsByWorkOrder(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListQualityInspectionsByWorkOrder(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	woID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid work order ID"})
	}
	q := db.New(database.Pool)
	list, err := q.ListQualityInspectionsByWorkOrder(c.Context(), db.ListQualityInspectionsByWorkOrderParams{
		WorkOrderID: woID, TenantID: tenantID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list inspections"})
	}
	return c.JSON(list)
}

// --- MRP Report: material requirements from open production orders ---
func GetMRPReport(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetMRPReport(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, _ := toUUID(tenantIDRaw)
	q := db.New(database.Pool)
	ctx := c.Context()
	orders, err := q.ListProductionOrders(ctx, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load production orders"})
	}
	type requirement struct {
		ProductID     string   `json:"product_id"`
		RequiredQty   float64  `json:"required_quantity"`
		ProductionPOs []string `json:"production_order_numbers"`
	}
	byProduct := make(map[[16]byte]*requirement)
	for _, po := range orders {
		if po.Status == "COMPLETED" || po.Status == "CANCELLED" {
			continue
		}
		bom, err := q.GetBOMByProduct(ctx, db.GetBOMByProductParams{TenantID: tenantID, ProductID: po.ProductID})
		if err != nil {
			continue
		}
		items, err := q.ListBOMItemsByBOM(ctx, db.ListBOMItemsByBOMParams{BomID: bom.ID, TenantID: tenantID})
		if err != nil {
			continue
		}
		poQty := numericToFloat64(po.Quantity)
		for _, it := range items {
			unitQty := numericToFloat64(it.Quantity)
			required := unitQty * poQty
			key := it.ComponentProductID.Bytes
			if byProduct[key] == nil {
				byProduct[key] = &requirement{ProductID: uuid.UUID(key).String(), RequiredQty: 0, ProductionPOs: nil}
			}
			byProduct[key].RequiredQty += required
			byProduct[key].ProductionPOs = append(byProduct[key].ProductionPOs, po.PoNumber)
		}
	}
	var list []*requirement
	for _, r := range byProduct {
		list = append(list, r)
	}
	return c.JSON(fiber.Map{
		"production_orders_count": len(orders),
		"material_requirements":   list,
	})
}
