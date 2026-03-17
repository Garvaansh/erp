package reva

import (
	"errors"
	"log"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/middleware"
)

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

// CreateCoilConsumptionLogRequest mirrors REVA-26: date, coil type (product), total, scrap, shortlength, used, remaining, coil ended
type CreateCoilConsumptionLogRequest struct {
	ProductID   string  `json:"product_id"`
	OperationDate string `json:"operation_date"` // YYYY-MM-DD
	StartingKg   string  `json:"starting_kg"`
	ScrapKg      string  `json:"scrap_kg"`
	ShortlengthKg string `json:"shortlength_kg"`
	UsedKg       string  `json:"used_kg"`
	RemainingKg  string  `json:"remaining_kg"`
	CoilEnded    bool    `json:"coil_ended"`
	Notes        *string `json:"notes"`
}

func CreateCoilConsumptionLog(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw, _ := c.Locals("user_id").(string)
	var userID pgtype.UUID
	if userIDRaw != "" {
		_ = userID.Scan(userIDRaw)
	}

	var req CreateCoilConsumptionLogRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	productID, err := toUUID(req.ProductID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product_id"})
	}

	var opDate pgtype.Date
	if req.OperationDate != "" {
		t, err := time.Parse("2006-01-02", req.OperationDate)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "operation_date must be YYYY-MM-DD"})
		}
		opDate.Scan(t)
	} else {
		opDate.Scan(time.Now().UTC())
	}

	var startingKg, scrapKg, shortlengthKg, usedKg, remainingKg pgtype.Numeric
	_ = startingKg.Scan(req.StartingKg)
	_ = scrapKg.Scan(req.ScrapKg)
	_ = shortlengthKg.Scan(req.ShortlengthKg)
	_ = usedKg.Scan(req.UsedKg)
	_ = remainingKg.Scan(req.RemainingKg)

	var notes pgtype.Text
	if req.Notes != nil {
		notes.Scan(*req.Notes)
	}

	q := db.New(database.Pool)
	logEntry, err := q.CreateCoilConsumptionLog(c.Context(), db.CreateCoilConsumptionLogParams{
		TenantID:      tenantID,
		ProductID:     productID,
		OperationDate: opDate,
		StartingKg:    startingKg,
		ScrapKg:       scrapKg,
		ShortlengthKg: shortlengthKg,
		UsedKg:        usedKg,
		RemainingKg:   remainingKg,
		CoilEnded:     req.CoilEnded,
		Notes:         notes,
		CreatedBy:     userID,
	})
	if err != nil {
		log.Printf("CreateCoilConsumptionLog error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create coil consumption log"})
	}
	return c.Status(fiber.StatusCreated).JSON(logEntry)
}

// BulkCreateCoilConsumptionLogsRequest body for Excel/bulk coil log import
type BulkCreateCoilConsumptionLogsRequest struct {
	Rows []CreateCoilConsumptionLogRequest `json:"rows"`
}

func BulkCreateCoilConsumptionLogs(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	userIDRaw, _ := c.Locals("user_id").(string)
	var userID pgtype.UUID
	if userIDRaw != "" {
		_ = userID.Scan(userIDRaw)
	}

	var req BulkCreateCoilConsumptionLogsRequest
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
		log.Printf("BulkCreateCoilConsumptionLogs begin tx: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start import"})
	}
	defer tx.Rollback(ctx)

	q := db.New(database.Pool).WithTx(tx)
	created := 0
	var firstErr string
	for i := range req.Rows {
		r := &req.Rows[i]
		productID, err := toUUID(r.ProductID)
		if err != nil {
			if firstErr == "" {
				firstErr = "row " + strconv.Itoa(i+1) + ": invalid product_id"
			}
			continue
		}
		var opDate pgtype.Date
		if r.OperationDate != "" {
			t, err := time.Parse("2006-01-02", r.OperationDate)
			if err != nil {
				if firstErr == "" {
					firstErr = "row " + strconv.Itoa(i+1) + ": operation_date must be YYYY-MM-DD"
				}
				continue
			}
			opDate.Scan(t)
		} else {
			opDate.Scan(time.Now().UTC())
		}
		var startingKg, scrapKg, shortlengthKg, usedKg, remainingKg pgtype.Numeric
		_ = startingKg.Scan(r.StartingKg)
		_ = scrapKg.Scan(r.ScrapKg)
		_ = shortlengthKg.Scan(r.ShortlengthKg)
		_ = usedKg.Scan(r.UsedKg)
		_ = remainingKg.Scan(r.RemainingKg)
		var notes pgtype.Text
		if r.Notes != nil {
			notes.Scan(*r.Notes)
		}
		_, err = q.CreateCoilConsumptionLog(ctx, db.CreateCoilConsumptionLogParams{
			TenantID:      tenantID,
			ProductID:     productID,
			OperationDate: opDate,
			StartingKg:    startingKg,
			ScrapKg:       scrapKg,
			ShortlengthKg: shortlengthKg,
			UsedKg:        usedKg,
			RemainingKg:   remainingKg,
			CoilEnded:     r.CoilEnded,
			Notes:         notes,
			CreatedBy:     userID,
		})
		if err != nil {
			if firstErr == "" {
				firstErr = "row " + strconv.Itoa(i+1) + ": " + err.Error()
			}
			continue
		}
		created++
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("BulkCreateCoilConsumptionLogs commit: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete import"})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"created": created, "total": len(req.Rows), "error": firstErr})
}

func ListCoilConsumptionLogs(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListCoilConsumptionLogs(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	limit := int32(200)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = int32(n)
		}
	}

	q := db.New(database.Pool)
	logs, err := q.ListCoilConsumptionLogs(c.Context(), db.ListCoilConsumptionLogsParams{
		TenantID: tenantID,
		Limit:   limit,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list coil consumption logs"})
	}
	return c.JSON(logs)
}

func ListCoilConsumptionLogsByProduct(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListCoilConsumptionLogsByProduct(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	productID, err := toUUID(c.Params("productId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product_id"})
	}

	limit := int32(100)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = int32(n)
		}
	}

	q := db.New(database.Pool)
	logs, err := q.ListCoilConsumptionLogsByProduct(c.Context(), db.ListCoilConsumptionLogsByProductParams{
		TenantID:  tenantID,
		ProductID: productID,
		Limit:     limit,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list coil consumption logs"})
	}
	return c.JSON(logs)
}

func GetLastCoilRemaining(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetLastCoilRemaining(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	productID, err := toUUID(c.Params("productId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product_id"})
	}

	q := db.New(database.Pool)
	remaining, err := q.GetLastCoilRemainingByProduct(c.Context(), db.GetLastCoilRemainingByProductParams{
		TenantID:  tenantID,
		ProductID: productID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No previous log for this product", "remaining_kg": nil})
	}
	return c.JSON(fiber.Map{"remaining_kg": remaining})
}

func ListPurchaseHistory(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListPurchaseHistory(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	limit := int32(300)
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 1000 {
			limit = int32(n)
		}
	}

	q := db.New(database.Pool)
	rows, err := q.ListPurchaseHistory(c.Context(), db.ListPurchaseHistoryParams{
		TenantID: tenantID,
		Limit:    limit,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list purchase history"})
	}
	return c.JSON(rows)
}

func ListStockLevelsWithReva(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.ListStockLevelsWithReva(c)
	}
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	arg := db.ListStockLevelsWithRevaParams{TenantID: tenantID}
	if catStr := c.Query("category_id"); catStr != "" {
		if catID, err := toUUID(catStr); err == nil {
			arg.CategoryID = catID
		}
	}
	q := db.New(database.Pool)
	rows, err := q.ListStockLevelsWithReva(c.Context(), arg)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list stock levels"})
	}
	return c.JSON(rows)
}

var defaultCompanyProfile = db.CompanyProfile{}

func GetCompanyProfile(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.JSON(defaultCompanyProfile)
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.JSON(defaultCompanyProfile)
	}
	q := db.New(database.Pool)
	profile, err := q.GetCompanyProfile(c.Context(), tenantID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("GetCompanyProfile: %v (returning default)", err)
		}
		return c.JSON(defaultCompanyProfile)
	}
	return c.JSON(profile)
}

type CompanyProfileRequest struct {
	CompanyName  string  `json:"company_name"`
	AddressLine1 *string `json:"address_line1"`
	AddressLine2 *string `json:"address_line2"`
	City         *string `json:"city"`
	State        *string `json:"state"`
	StateCode    *string `json:"state_code"` // India: 2-digit state code for GST
	Pincode      *string `json:"pincode"`
	Country      *string `json:"country"`
	GstNumber    *string `json:"gst_number"`
	Tan          *string `json:"tan"` // India: TAN for TDS
	ContactEmail *string `json:"contact_email"`
	ContactPhone *string `json:"contact_phone"`
}

func UpsertCompanyProfile(c *fiber.Ctx) error {
	tenantIDRaw := c.Locals("tenant_id").(string)
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	var req CompanyProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	companyName := req.CompanyName
	if companyName == "" {
		companyName = "Reva Technologies"
	}
	var addr1, addr2, city, state, pincode, country, gst, email, phone pgtype.Text
	if req.AddressLine1 != nil {
		addr1.Scan(*req.AddressLine1)
	}
	if req.AddressLine2 != nil {
		addr2.Scan(*req.AddressLine2)
	}
	if req.City != nil {
		city.Scan(*req.City)
	}
	if req.State != nil {
		state.Scan(*req.State)
	}
	if req.Pincode != nil {
		pincode.Scan(*req.Pincode)
	}
	if req.Country != nil {
		country.Scan(*req.Country)
	} else {
		country.Scan("India")
	}
	if req.GstNumber != nil {
		gst.Scan(*req.GstNumber)
	}
	if req.ContactEmail != nil {
		email.Scan(*req.ContactEmail)
	}
	if req.ContactPhone != nil {
		phone.Scan(*req.ContactPhone)
	}
	var stateCode, tan pgtype.Text
	if req.StateCode != nil {
		stateCode.Scan(*req.StateCode)
	}
	if req.Tan != nil {
		tan.Scan(*req.Tan)
	}
	q := db.New(database.Pool)
	profile, err := q.UpsertCompanyProfile(c.Context(), db.UpsertCompanyProfileParams{
		TenantID:     tenantID,
		CompanyName:  companyName,
		AddressLine1: addr1,
		AddressLine2: addr2,
		City:         city,
		State:        state,
		StateCode:    stateCode,
		Pincode:      pincode,
		Country:      country,
		GstNumber:    gst,
		Tan:          tan,
		ContactEmail: email,
		ContactPhone: phone,
	})
	if err != nil {
		log.Printf("UpsertCompanyProfile error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save company profile"})
	}
	return c.JSON(profile)
}
