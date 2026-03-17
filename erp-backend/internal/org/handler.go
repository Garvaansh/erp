package org

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/httputil"
)

// ListCompanyCodes returns paginated company codes. Query: limit, offset.
func ListCompanyCodes(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	limit, offset := httputil.LimitOffset(c)

	q := db.New(database.Pool)
	ctx := c.Context()
	list, err := q.ListCompanyCodes(ctx, db.ListCompanyCodesParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		log.Printf("ListCompanyCodes: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list company codes"})
	}
	total, _ := q.CountCompanyCodes(ctx, tenantID)

	return c.JSON(fiber.Map{
		"data":  list,
		"total": total,
	})
}

// GetCompanyCode returns one company code by ID.
func GetCompanyCode(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid company code ID"})
	}

	q := db.New(database.Pool)
	row, err := q.GetCompanyCode(c.Context(), db.GetCompanyCodeParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Company code not found"})
		}
		log.Printf("GetCompanyCode: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get company code"})
	}
	return c.JSON(row)
}

// CreateCompanyCodeRequest is the body for POST /organization/company-codes.
type CreateCompanyCodeRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	CountryCode string `json:"country_code"`
	Currency    string `json:"currency"`
}

// CreateCompanyCode creates a company code. Validates code and name non-empty.
func CreateCompanyCode(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	var req CreateCompanyCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.Code == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code and name are required"})
	}
	if req.CountryCode == "" {
		req.CountryCode = "IN"
	}
	if req.Currency == "" {
		req.Currency = "INR"
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	_, err = q.GetCompanyCodeByCode(ctx, db.GetCompanyCodeByCodeParams{TenantID: tenantID, Code: req.Code})
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Company code already exists"})
	}

	created, err := q.CreateCompanyCode(ctx, db.CreateCompanyCodeParams{
		TenantID:    tenantID,
		Code:        req.Code,
		Name:        req.Name,
		CountryCode: req.CountryCode,
		Currency:    req.Currency,
	})
	if err != nil {
		log.Printf("CreateCompanyCode: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create company code"})
	}
	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdateCompanyCodeRequest is the body for PUT /organization/company-codes/:id.
type UpdateCompanyCodeRequest struct {
	Name        *string `json:"name"`
	CountryCode *string `json:"country_code"`
	Currency    *string `json:"currency"`
}

// UpdateCompanyCode updates a company code.
func UpdateCompanyCode(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid company code ID"})
	}

	var req UpdateCompanyCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetCompanyCode(ctx, db.GetCompanyCodeParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Company code not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get company code"})
	}

	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}
	countryCode := existing.CountryCode
	if req.CountryCode != nil {
		countryCode = *req.CountryCode
	}
	currency := existing.Currency
	if req.Currency != nil {
		currency = *req.Currency
	}

	updated, err := q.UpdateCompanyCode(ctx, db.UpdateCompanyCodeParams{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		CountryCode: countryCode,
		Currency:    currency,
	})
	if err != nil {
		log.Printf("UpdateCompanyCode: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update company code"})
	}
	return c.JSON(updated)
}

// DeleteCompanyCode deletes a company code.
func DeleteCompanyCode(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid company code ID"})
	}

	q := db.New(database.Pool)
	err = q.DeleteCompanyCode(c.Context(), db.DeleteCompanyCodeParams{ID: id, TenantID: tenantID})
	if err != nil {
		log.Printf("DeleteCompanyCode: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete company code"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListPlants returns paginated plants. Query: limit, offset. Optional: company_code_id filter.
func ListPlants(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	limit, offset := httputil.LimitOffset(c)

	q := db.New(database.Pool)
	ctx := c.Context()
	list, err := q.ListPlants(ctx, db.ListPlantsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		log.Printf("ListPlants: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list plants"})
	}
	total, _ := q.CountPlants(ctx, tenantID)

	return c.JSON(fiber.Map{
		"data":  list,
		"total": total,
	})
}

// GetPlant returns one plant by ID.
func GetPlant(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid plant ID"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	row, err := q.GetPlant(ctx, db.GetPlantParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Plant not found"})
		}
		log.Printf("GetPlant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get plant"})
	}
	return c.JSON(row)
}

// CreatePlantRequest is the body for POST /organization/plants.
type CreatePlantRequest struct {
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	CompanyCodeID   *string `json:"company_code_id"`
	TimeZone        *string `json:"time_zone"`
}

// CreatePlant creates a plant.
func CreatePlant(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	var req CreatePlantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.Code == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code and name are required"})
	}

	var companyCodeID pgtype.UUID
	if req.CompanyCodeID != nil && *req.CompanyCodeID != "" {
		_ = companyCodeID.Scan(*req.CompanyCodeID)
	}
	var timeZone pgtype.Text
	if req.TimeZone != nil && *req.TimeZone != "" {
		timeZone.Scan(*req.TimeZone)
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	_, err = q.GetPlantByCode(ctx, db.GetPlantByCodeParams{TenantID: tenantID, Code: req.Code})
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Plant code already exists"})
	}

	created, err := q.CreatePlant(ctx, db.CreatePlantParams{
		TenantID:      tenantID,
		Code:          req.Code,
		Name:          req.Name,
		CompanyCodeID: companyCodeID,
		TimeZone:      timeZone,
	})
	if err != nil {
		log.Printf("CreatePlant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create plant"})
	}
	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdatePlantRequest is the body for PUT /organization/plants/:id.
type UpdatePlantRequest struct {
	Name            *string `json:"name"`
	CompanyCodeID   *string `json:"company_code_id"`
	TimeZone        *string `json:"time_zone"`
}

// UpdatePlant updates a plant.
func UpdatePlant(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid plant ID"})
	}

	var req UpdatePlantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetPlant(ctx, db.GetPlantParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Plant not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get plant"})
	}

	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}
	companyCodeID := existing.CompanyCodeID
	if req.CompanyCodeID != nil {
		companyCodeID = pgtype.UUID{}
		if *req.CompanyCodeID != "" {
			_ = companyCodeID.Scan(*req.CompanyCodeID)
		}
	}
	timeZone := existing.TimeZone
	if req.TimeZone != nil {
		timeZone = pgtype.Text{}
		if req.TimeZone != nil && *req.TimeZone != "" {
			timeZone.Scan(*req.TimeZone)
		}
	}

	updated, err := q.UpdatePlant(ctx, db.UpdatePlantParams{
		ID:             id,
		TenantID:       tenantID,
		Name:           name,
		CompanyCodeID:  companyCodeID,
		TimeZone:       timeZone,
	})
	if err != nil {
		log.Printf("UpdatePlant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update plant"})
	}
	return c.JSON(updated)
}

// DeletePlant deletes a plant.
func DeletePlant(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid plant ID"})
	}

	q := db.New(database.Pool)
	err = q.DeletePlant(c.Context(), db.DeletePlantParams{ID: id, TenantID: tenantID})
	if err != nil {
		log.Printf("DeletePlant: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete plant"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
