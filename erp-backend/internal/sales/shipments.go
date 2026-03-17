package sales

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

type CreateShipmentRequest struct {
	SalesOrderID   *string  `json:"sales_order_id"`
	WarehouseID    *string  `json:"warehouse_id"`
	CarrierName    *string  `json:"carrier_name"`
	TrackingNumber *string  `json:"tracking_number"`
	Lines          []ShipmentLineRequest `json:"lines"`
}

type ShipmentLineRequest struct {
	ProductID string `json:"product_id"`
	Quantity  string `json:"quantity"`
}

func ListShipments(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListShipments(c)
	}
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	limit := int32(50)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.ParseInt(l, 10, 32); err == nil && n > 0 && n <= 200 {
			limit = int32(n)
		}
	}
	offset := int32(0)
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.ParseInt(o, 10, 32); err == nil && n >= 0 {
			offset = int32(n)
		}
	}
	q := db.New(database.Pool)
	list, err := q.ListShipments(c.Context(), db.ListShipmentsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list shipments"})
	}
	return c.JSON(list)
}

func GetShipment(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetShipment(c)
	}
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	id, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	ship, err := q.GetShipment(c.Context(), db.GetShipmentParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shipment not found"})
	}
	return c.JSON(ship)
}

func CreateShipment(c *fiber.Ctx) error {
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	userID, _ := toUUID(c.Locals("user_id").(string))

	var body CreateShipmentRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if len(body.Lines) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "At least one line required"})
	}

	year := int32(time.Now().Year())
	q := db.New(database.Pool)
	seq, err := q.GetNextDocumentNumber(c.Context(), db.GetNextDocumentNumberParams{
		TenantID:     tenantID,
		DocumentType: "SHP",
		Year:         year,
		Prefix:       "SHP-",
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate shipment number"})
	}
	shipmentNumber := "SHP-" + strconv.Itoa(int(year)) + "-" + strconv.Itoa(int(seq.LastNumber))

	var soID, whID pgtype.UUID
	var carrier, tracking pgtype.Text
	if body.SalesOrderID != nil {
		soID.Scan(*body.SalesOrderID)
	}
	if body.WarehouseID != nil {
		whID.Scan(*body.WarehouseID)
	}
	if body.CarrierName != nil {
		carrier.Scan(*body.CarrierName)
	}
	if body.TrackingNumber != nil {
		tracking.Scan(*body.TrackingNumber)
	}

	ship, err := q.CreateShipment(c.Context(), db.CreateShipmentParams{
		TenantID:       tenantID,
		ShipmentNumber: shipmentNumber,
		SalesOrderID:   soID,
		WarehouseID:    whID,
		CarrierName:    carrier,
		TrackingNumber: tracking,
		Status:         "PENDING",
		CreatedBy:      userID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create shipment"})
	}

	for _, line := range body.Lines {
		productID, _ := toUUID(line.ProductID)
		var qty pgtype.Numeric
		qty.Scan(line.Quantity)
		_, _ = q.CreateShipmentLine(c.Context(), db.CreateShipmentLineParams{
			ShipmentID: ship.ID,
			ProductID:  productID,
			Quantity:   qty,
		})
	}
	lines, _ := q.ListShipmentLines(c.Context(), ship.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"shipment": ship,
		"lines":    lines,
	})
}

func ListShipmentLines(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListShipmentLines(c)
	}
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	shipID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid shipment ID"})
	}
	q := db.New(database.Pool)
	_, err = q.GetShipment(c.Context(), db.GetShipmentParams{ID: shipID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shipment not found"})
	}
	lines, err := q.ListShipmentLines(c.Context(), shipID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list lines"})
	}
	return c.JSON(lines)
}

func UpdateShipmentStatus(c *fiber.Ctx) error {
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	shipID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil || body.Status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status required"})
	}
	q := db.New(database.Pool)
	updated, err := q.UpdateShipmentStatus(c.Context(), db.UpdateShipmentStatusParams{
		ID:       shipID,
		TenantID: tenantID,
		Status:   body.Status,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}
	return c.JSON(updated)
}
