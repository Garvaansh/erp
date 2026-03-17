package inventory

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

// Zone request/response
type ZoneRequest struct {
	Code string  `json:"code"`
	Name *string `json:"name"`
}

// ListWarehouseZones returns zones for a warehouse. Path: warehouseId
func ListWarehouseZones(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWarehouseZones(c)
	}
	tenantID, err := toUUID(c.Locals("tenant_id").(string))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	warehouseID, err := toUUID(c.Params("warehouseId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid warehouse ID"})
	}
	q := db.New(database.Pool)
	zones, err := q.ListWarehouseZones(c.Context(), db.ListWarehouseZonesParams{
		TenantID:     tenantID,
		WarehouseID:  warehouseID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list zones"})
	}
	return c.JSON(zones)
}

// CreateWarehouseZone creates a zone in a warehouse. Path: warehouseId. Body: code, name
func CreateWarehouseZone(c *fiber.Ctx) error {
	tenantID, err := toUUID(c.Locals("tenant_id").(string))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	warehouseID, err := toUUID(c.Params("warehouseId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid warehouse ID"})
	}
	var req ZoneRequest
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code is required"})
	}
	var name pgtype.Text
	if req.Name != nil {
		name.Scan(*req.Name)
	}
	q := db.New(database.Pool)
	zone, err := q.CreateWarehouseZone(c.Context(), db.CreateWarehouseZoneParams{
		TenantID:    tenantID,
		WarehouseID: warehouseID,
		Code:        req.Code,
		Name:        name,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create zone"})
	}
	return c.Status(fiber.StatusCreated).JSON(zone)
}

// ListWarehouseRacks returns racks in a zone. Path: zoneId
func ListWarehouseRacks(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWarehouseRacks(c)
	}
	zoneID, err := toUUID(c.Params("zoneId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid zone ID"})
	}
	q := db.New(database.Pool)
	racks, err := q.ListWarehouseRacks(c.Context(), zoneID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list racks"})
	}
	return c.JSON(racks)
}

// CreateWarehouseRack creates a rack in a zone. Path: zoneId. Body: code
func CreateWarehouseRack(c *fiber.Ctx) error {
	zoneID, err := toUUID(c.Params("zoneId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid zone ID"})
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code is required"})
	}
	q := db.New(database.Pool)
	rack, err := q.CreateWarehouseRack(c.Context(), db.CreateWarehouseRackParams{
		ZoneID: zoneID,
		Code:   req.Code,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create rack"})
	}
	return c.Status(fiber.StatusCreated).JSON(rack)
}

// ListWarehouseShelves returns shelves in a rack. Path: rackId
func ListWarehouseShelves(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWarehouseShelves(c)
	}
	rackID, err := toUUID(c.Params("rackId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid rack ID"})
	}
	q := db.New(database.Pool)
	shelves, err := q.ListWarehouseShelves(c.Context(), rackID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list shelves"})
	}
	return c.JSON(shelves)
}

// CreateWarehouseShelf creates a shelf in a rack. Path: rackId. Body: code
func CreateWarehouseShelf(c *fiber.Ctx) error {
	rackID, err := toUUID(c.Params("rackId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid rack ID"})
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code is required"})
	}
	q := db.New(database.Pool)
	shelf, err := q.CreateWarehouseShelf(c.Context(), db.CreateWarehouseShelfParams{
		RackID: rackID,
		Code:   req.Code,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create shelf"})
	}
	return c.Status(fiber.StatusCreated).JSON(shelf)
}

// ListWarehouseBins returns bins in a shelf. Path: shelfId
func ListWarehouseBins(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListWarehouseBins(c)
	}
	shelfID, err := toUUID(c.Params("shelfId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid shelf ID"})
	}
	q := db.New(database.Pool)
	bins, err := q.ListWarehouseBins(c.Context(), shelfID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list bins"})
	}
	return c.JSON(bins)
}

// CreateWarehouseBin creates a bin in a shelf. Path: shelfId. Body: code
func CreateWarehouseBin(c *fiber.Ctx) error {
	shelfID, err := toUUID(c.Params("shelfId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid shelf ID"})
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code is required"})
	}
	q := db.New(database.Pool)
	bin, err := q.CreateWarehouseBin(c.Context(), db.CreateWarehouseBinParams{
		ShelfID: shelfID,
		Code:    req.Code,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create bin"})
	}
	return c.Status(fiber.StatusCreated).JSON(bin)
}
