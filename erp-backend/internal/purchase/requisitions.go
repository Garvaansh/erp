package purchase

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

type RequisitionRequest struct {
	ReqNumber            *string  `json:"req_number"`             // optional; auto-generated if empty
	Department           *string  `json:"department"`
	ExpectedDeliveryDate *string  `json:"expected_delivery_date"`   // YYYY-MM-DD
	Budget               *string  `json:"budget"`
	Items                []ReqItem `json:"items"`
}

type ReqItem struct {
	ProductID string  `json:"product_id"`
	Quantity  string  `json:"quantity"`
	Notes     *string `json:"notes"`
}

func ListPurchaseRequisitions(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListPurchaseRequisitions(c)
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
	list, err := q.ListPurchaseRequisitions(c.Context(), db.ListPurchaseRequisitionsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list requisitions"})
	}
	return c.JSON(list)
}

func GetPurchaseRequisition(c *fiber.Ctx) error {
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	id, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}
	q := db.New(database.Pool)
	req, err := q.GetPurchaseRequisition(c.Context(), db.GetPurchaseRequisitionParams{ID: id, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Requisition not found"})
	}
	return c.JSON(req)
}

func CreatePurchaseRequisition(c *fiber.Ctx) error {
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	userID, _ := toUUID(c.Locals("user_id").(string))

	var body RequisitionRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	reqNumber := ""
	if body.ReqNumber != nil && *body.ReqNumber != "" {
		reqNumber = *body.ReqNumber
	} else {
		year := int32(time.Now().Year())
		q := db.New(database.Pool)
		seq, err := q.GetNextDocumentNumber(c.Context(), db.GetNextDocumentNumberParams{
			TenantID:     tenantID,
			DocumentType: "REQ",
			Year:         year,
			Prefix:       "REQ-",
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate requisition number"})
		}
		reqNumber = "REQ-" + strconv.Itoa(int(year)) + "-" + strconv.Itoa(int(seq.LastNumber))
	}

	var dept, expDate pgtype.Text
	var budget pgtype.Numeric
	if body.Department != nil {
		dept.Scan(*body.Department)
	}
	if body.ExpectedDeliveryDate != nil {
		expDate.Scan(*body.ExpectedDeliveryDate)
	}
	if body.Budget != nil {
		budget.Scan(*body.Budget)
	}
	var requesterID pgtype.UUID
	requesterID = userID

	q := db.New(database.Pool)
	var expDelivery pgtype.Date
	if body.ExpectedDeliveryDate != nil && *body.ExpectedDeliveryDate != "" {
		t, _ := time.Parse("2006-01-02", *body.ExpectedDeliveryDate)
		expDelivery.Scan(t)
	}
	req, err := q.CreatePurchaseRequisition(c.Context(), db.CreatePurchaseRequisitionParams{
		TenantID:             tenantID,
		ReqNumber:            reqNumber,
		Department:           dept,
		RequesterID:          requesterID,
		Status:               "DRAFT",
		ExpectedDeliveryDate: expDelivery,
		Budget:               budget,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create requisition"})
	}

	for _, it := range body.Items {
		productID, _ := toUUID(it.ProductID)
		var qty pgtype.Numeric
		qty.Scan(it.Quantity)
		var notes pgtype.Text
		if it.Notes != nil {
			notes.Scan(*it.Notes)
		}
		_, _ = q.CreatePurchaseRequisitionItem(c.Context(), db.CreatePurchaseRequisitionItemParams{
			RequisitionID: req.ID,
			ProductID:     productID,
			Quantity:      qty,
			Notes:         notes,
		})
	}
	// Reload with items
	items, _ := q.ListPurchaseRequisitionItems(c.Context(), req.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"requisition": req,
		"items":       items,
	})
}

func ListPurchaseRequisitionItems(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListPurchaseRequisitionItems(c)
	}
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	reqID, err := toUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid requisition ID"})
	}
	q := db.New(database.Pool)
	_, err = q.GetPurchaseRequisition(c.Context(), db.GetPurchaseRequisitionParams{ID: reqID, TenantID: tenantID})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Requisition not found"})
	}
	items, err := q.ListPurchaseRequisitionItems(c.Context(), reqID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list items"})
	}
	return c.JSON(items)
}

func UpdatePurchaseRequisitionStatus(c *fiber.Ctx) error {
	tenantID, _ := toUUID(c.Locals("tenant_id").(string))
	reqID, err := toUUID(c.Params("id"))
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
	updated, err := q.UpdatePurchaseRequisitionStatus(c.Context(), db.UpdatePurchaseRequisitionStatusParams{
		ID:       reqID,
		TenantID: tenantID,
		Status:   body.Status,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update status"})
	}
	return c.JSON(updated)
}
