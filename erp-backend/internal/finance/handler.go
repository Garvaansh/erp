package finance

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

// ListChartOfAccounts returns paginated chart of accounts. Query: limit, offset.
func ListChartOfAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	limit, offset := httputil.LimitOffset(c)

	q := db.New(database.Pool)
	ctx := c.Context()
	list, err := q.ListChartOfAccounts(ctx, db.ListChartOfAccountsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		log.Printf("ListChartOfAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list chart of accounts"})
	}
	total, _ := q.CountChartOfAccounts(ctx, tenantID)

	return c.JSON(fiber.Map{
		"data":  list,
		"total": total,
	})
}

// GetChartOfAccounts returns one chart of accounts by ID.
func GetChartOfAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid chart of accounts ID"})
	}

	q := db.New(database.Pool)
	row, err := q.GetChartOfAccounts(c.Context(), db.GetChartOfAccountsParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Chart of accounts not found"})
		}
		log.Printf("GetChartOfAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get chart of accounts"})
	}
	return c.JSON(row)
}

// CreateChartOfAccountsRequest is the body for POST /finance/chart-of-accounts.
type CreateChartOfAccountsRequest struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// CreateChartOfAccounts creates a chart of accounts.
func CreateChartOfAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	var req CreateChartOfAccountsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.Code == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "code and name are required"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	_, err = q.GetChartOfAccountsByCode(ctx, db.GetChartOfAccountsByCodeParams{TenantID: tenantID, Code: req.Code})
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Chart of accounts code already exists"})
	}

	created, err := q.CreateChartOfAccounts(ctx, db.CreateChartOfAccountsParams{
		TenantID: tenantID,
		Code:     req.Code,
		Name:     req.Name,
	})
	if err != nil {
		log.Printf("CreateChartOfAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create chart of accounts"})
	}
	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdateChartOfAccountsRequest is the body for PUT /finance/chart-of-accounts/:id.
type UpdateChartOfAccountsRequest struct {
	Name *string `json:"name"`
}

// UpdateChartOfAccounts updates a chart of accounts.
func UpdateChartOfAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid chart of accounts ID"})
	}

	var req UpdateChartOfAccountsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetChartOfAccounts(ctx, db.GetChartOfAccountsParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Chart of accounts not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get chart of accounts"})
	}

	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}

	updated, err := q.UpdateChartOfAccounts(ctx, db.UpdateChartOfAccountsParams{
		ID:       id,
		TenantID: tenantID,
		Name:     name,
	})
	if err != nil {
		log.Printf("UpdateChartOfAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update chart of accounts"})
	}
	return c.JSON(updated)
}

// DeleteChartOfAccounts deletes a chart of accounts.
func DeleteChartOfAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid chart of accounts ID"})
	}

	q := db.New(database.Pool)
	err = q.DeleteChartOfAccounts(c.Context(), db.DeleteChartOfAccountsParams{ID: id, TenantID: tenantID})
	if err != nil {
		log.Printf("DeleteChartOfAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete chart of accounts"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListGLAccounts returns paginated G/L accounts. Query: limit, offset. Optional: chart_of_accounts_id.
func ListGLAccounts(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	limit, offset := httputil.LimitOffset(c)
	chartID := c.Query("chart_of_accounts_id")

	q := db.New(database.Pool)
	ctx := c.Context()

	if chartID != "" {
		var chartUUID pgtype.UUID
		if err := chartUUID.Scan(chartID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid chart_of_accounts_id"})
		}
		list, err := q.ListGLAccountsByChart(ctx, db.ListGLAccountsByChartParams{
			TenantID:          tenantID,
			ChartOfAccountsID: chartUUID,
			Limit:             limit,
			Offset:            offset,
		})
		if err != nil {
			log.Printf("ListGLAccountsByChart: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list G/L accounts"})
		}
		total, _ := q.CountGLAccountsByChart(ctx, db.CountGLAccountsByChartParams{
			TenantID:          tenantID,
			ChartOfAccountsID: chartUUID,
		})
		return c.JSON(fiber.Map{"data": list, "total": total})
	}

	list, err := q.ListGLAccounts(ctx, db.ListGLAccountsParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		log.Printf("ListGLAccounts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list G/L accounts"})
	}
	total, _ := q.CountGLAccounts(ctx, tenantID)
	return c.JSON(fiber.Map{"data": list, "total": total})
}

// GetGLAccount returns one G/L account by ID.
func GetGLAccount(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid G/L account ID"})
	}

	q := db.New(database.Pool)
	row, err := q.GetGLAccount(c.Context(), db.GetGLAccountParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "G/L account not found"})
		}
		log.Printf("GetGLAccount: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get G/L account"})
	}
	return c.JSON(row)
}

// CreateGLAccountRequest is the body for POST /finance/gl-accounts.
type CreateGLAccountRequest struct {
	ChartOfAccountsID string  `json:"chart_of_accounts_id"`
	AccountNumber     string  `json:"account_number"`
	AccountType       string  `json:"account_type"` // P=Profit/Loss, B=Balance sheet
	GroupCode         *string `json:"group_code"`
}

// CreateGLAccount creates a G/L account.
func CreateGLAccount(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	var req CreateGLAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.ChartOfAccountsID == "" || req.AccountNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "chart_of_accounts_id and account_number are required"})
	}
	if req.AccountType == "" {
		req.AccountType = "P"
	}

	var chartID pgtype.UUID
	if err := chartID.Scan(req.ChartOfAccountsID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid chart_of_accounts_id"})
	}
	var groupCode pgtype.Text
	if req.GroupCode != nil && *req.GroupCode != "" {
		groupCode.Scan(*req.GroupCode)
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	_, err = q.GetGLAccountByNumber(ctx, db.GetGLAccountByNumberParams{
		TenantID:          tenantID,
		ChartOfAccountsID: chartID,
		AccountNumber:    req.AccountNumber,
	})
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "G/L account number already exists in this chart"})
	}

	created, err := q.CreateGLAccount(ctx, db.CreateGLAccountParams{
		TenantID:          tenantID,
		ChartOfAccountsID: chartID,
		AccountNumber:     req.AccountNumber,
		AccountType:       req.AccountType,
		GroupCode:         groupCode,
	})
	if err != nil {
		log.Printf("CreateGLAccount: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create G/L account"})
	}
	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdateGLAccountRequest is the body for PUT /finance/gl-accounts/:id.
type UpdateGLAccountRequest struct {
	AccountType *string `json:"account_type"`
	GroupCode   *string `json:"group_code"`
}

// UpdateGLAccount updates a G/L account.
func UpdateGLAccount(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid G/L account ID"})
	}

	var req UpdateGLAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetGLAccount(ctx, db.GetGLAccountParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "G/L account not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get G/L account"})
	}

	accountType := existing.AccountType
	if req.AccountType != nil {
		accountType = *req.AccountType
	}
	groupCode := existing.GroupCode
	if req.GroupCode != nil {
		groupCode = pgtype.Text{}
		if *req.GroupCode != "" {
			groupCode.Scan(*req.GroupCode)
		}
	}

	updated, err := q.UpdateGLAccount(ctx, db.UpdateGLAccountParams{
		ID:          id,
		TenantID:    tenantID,
		AccountType: accountType,
		GroupCode:   groupCode,
	})
	if err != nil {
		log.Printf("UpdateGLAccount: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update G/L account"})
	}
	return c.JSON(updated)
}

// DeleteGLAccount deletes a G/L account.
func DeleteGLAccount(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid G/L account ID"})
	}

	q := db.New(database.Pool)
	err = q.DeleteGLAccount(c.Context(), db.DeleteGLAccountParams{ID: id, TenantID: tenantID})
	if err != nil {
		log.Printf("DeleteGLAccount: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete G/L account"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListCostCenters returns paginated cost centers. Query: limit, offset. Optional: company_code_id.
func ListCostCenters(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	limit, offset := httputil.LimitOffset(c)
	companyCodeID := c.Query("company_code_id")

	q := db.New(database.Pool)
	ctx := c.Context()

	if companyCodeID != "" {
		var ccUUID pgtype.UUID
		if err := ccUUID.Scan(companyCodeID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid company_code_id"})
		}
		list, err := q.ListCostCentersByCompanyCode(ctx, db.ListCostCentersByCompanyCodeParams{
			TenantID:      tenantID,
			CompanyCodeID: ccUUID,
			Limit:         limit,
			Offset:        offset,
		})
		if err != nil {
			log.Printf("ListCostCentersByCompanyCode: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list cost centers"})
		}
		total, _ := q.CountCostCenters(ctx, tenantID)
		return c.JSON(fiber.Map{"data": list, "total": total})
	}

	list, err := q.ListCostCenters(ctx, db.ListCostCentersParams{
		TenantID: tenantID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		log.Printf("ListCostCenters: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list cost centers"})
	}
	total, _ := q.CountCostCenters(ctx, tenantID)
	return c.JSON(fiber.Map{"data": list, "total": total})
}

// GetCostCenter returns one cost center by ID.
func GetCostCenter(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid cost center ID"})
	}

	q := db.New(database.Pool)
	row, err := q.GetCostCenter(c.Context(), db.GetCostCenterParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Cost center not found"})
		}
		log.Printf("GetCostCenter: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get cost center"})
	}
	return c.JSON(row)
}

// CreateCostCenterRequest is the body for POST /finance/cost-centers.
type CreateCostCenterRequest struct {
	CompanyCodeID      string  `json:"company_code_id"`
	Code               string  `json:"code"`
	Name               string  `json:"name"`
	ParentCostCenterID *string `json:"parent_cost_center_id"`
	IsBlocked          *bool   `json:"is_blocked"`
}

// CreateCostCenter creates a cost center.
func CreateCostCenter(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	var req CreateCostCenterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if req.CompanyCodeID == "" || req.Code == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "company_code_id, code and name are required"})
	}

	var companyCodeID pgtype.UUID
	if err := companyCodeID.Scan(req.CompanyCodeID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid company_code_id"})
	}
	var parentID pgtype.UUID
	if req.ParentCostCenterID != nil && *req.ParentCostCenterID != "" {
		_ = parentID.Scan(*req.ParentCostCenterID)
	}
	isBlocked := false
	if req.IsBlocked != nil {
		isBlocked = *req.IsBlocked
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	_, err = q.GetCostCenterByCode(ctx, db.GetCostCenterByCodeParams{
		TenantID:      tenantID,
		CompanyCodeID: companyCodeID,
		Code:          req.Code,
	})
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Cost center code already exists for this company code"})
	}

	created, err := q.CreateCostCenter(ctx, db.CreateCostCenterParams{
		TenantID:           tenantID,
		CompanyCodeID:      companyCodeID,
		Code:               req.Code,
		Name:               req.Name,
		ParentCostCenterID: parentID,
		IsBlocked:          isBlocked,
	})
	if err != nil {
		log.Printf("CreateCostCenter: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create cost center"})
	}
	return c.Status(fiber.StatusCreated).JSON(created)
}

// UpdateCostCenterRequest is the body for PUT /finance/cost-centers/:id.
type UpdateCostCenterRequest struct {
	Name               *string `json:"name"`
	ParentCostCenterID *string `json:"parent_cost_center_id"`
	IsBlocked          *bool   `json:"is_blocked"`
}

// UpdateCostCenter updates a cost center.
func UpdateCostCenter(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid cost center ID"})
	}

	var req UpdateCostCenterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetCostCenter(ctx, db.GetCostCenterParams{ID: id, TenantID: tenantID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Cost center not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get cost center"})
	}

	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}
	parentID := existing.ParentCostCenterID
	if req.ParentCostCenterID != nil {
		parentID = pgtype.UUID{}
		if *req.ParentCostCenterID != "" {
			_ = parentID.Scan(*req.ParentCostCenterID)
		}
	}
	isBlocked := existing.IsBlocked
	if req.IsBlocked != nil {
		isBlocked = *req.IsBlocked
	}

	updated, err := q.UpdateCostCenter(ctx, db.UpdateCostCenterParams{
		ID:                 id,
		TenantID:           tenantID,
		Name:               name,
		ParentCostCenterID: parentID,
		IsBlocked:          isBlocked,
	})
	if err != nil {
		log.Printf("UpdateCostCenter: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update cost center"})
	}
	return c.JSON(updated)
}

// DeleteCostCenter deletes a cost center.
func DeleteCostCenter(c *fiber.Ctx) error {
	tenantID, err := httputil.TenantUUID(c)
	if err != nil {
		return err
	}
	idParam := c.Params("id")
	var id pgtype.UUID
	if err := id.Scan(idParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid cost center ID"})
	}

	q := db.New(database.Pool)
	err = q.DeleteCostCenter(c.Context(), db.DeleteCostCenterParams{ID: id, TenantID: tenantID})
	if err != nil {
		log.Printf("DeleteCostCenter: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete cost center"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
