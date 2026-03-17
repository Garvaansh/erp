package reports

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/internal/mock"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/reva-erp/backend/pkg/gst"
	"github.com/reva-erp/backend/pkg/middleware"
)

func toUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

// parseReportDateRange returns start, end as pgtype.Date. If query params missing, uses last 30 days.
func parseReportDateRange(c *fiber.Ctx) (start, end pgtype.Date, startStr, endStr string) {
	now := time.Now().UTC()
	endTime := now
	startTime := now.AddDate(0, 0, -30)
	if e := c.Query("end_date"); e != "" {
		if t, err := time.Parse("2006-01-02", e); err == nil {
			endTime = t.UTC()
		}
	}
	if s := c.Query("start_date"); s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			startTime = t.UTC()
		}
	}
	startStr = startTime.Format("2006-01-02")
	endStr = endTime.Format("2006-01-02")
	start = pgtype.Date{Time: startTime, Valid: true}
	end = pgtype.Date{Time: endTime, Valid: true}
	return start, end, startStr, endStr
}

func getReportData(ctx context.Context, tenantID pgtype.UUID, start, end pgtype.Date) fiber.Map {
	q := db.New(database.Pool)

	var sales interface{}
	var output interface{}
	if start.Valid && end.Valid {
		salesRows, err := q.GetDailySalesWithRange(ctx, db.GetDailySalesWithRangeParams{
			TenantID: tenantID,
			Column2:  start,
			Column3:  end,
		})
		if err != nil {
			log.Printf("GetDailySalesWithRange error: %v", err)
			salesRows = []db.GetDailySalesWithRangeRow{}
		}
		outputRows, err := q.GetProductionOutputWithRange(ctx, db.GetProductionOutputWithRangeParams{
			TenantID: tenantID,
			Column2:  start,
			Column3:  end,
		})
		if err != nil {
			log.Printf("GetProductionOutputWithRange error: %v", err)
			outputRows = []db.GetProductionOutputWithRangeRow{}
		}
		sales = salesRows
		output = outputRows
	} else {
		salesRows, err := q.GetDailySales(ctx, tenantID)
		if err != nil {
			log.Printf("GetDailySales error: %v", err)
			salesRows = []db.GetDailySalesRow{}
		}
		outputRows, err := q.GetProductionOutput(ctx, tenantID)
		if err != nil {
			log.Printf("GetProductionOutput error: %v", err)
			outputRows = []db.GetProductionOutputRow{}
		}
		sales = salesRows
		output = outputRows
	}

	valuation, err := q.GetInventoryValuation(ctx, tenantID)
	if err != nil {
		log.Printf("GetInventoryValuation error: %v", err)
		valuation = pgtype.Numeric{}
	}

	procurementSpend, err := q.GetProcurementSpend30d(ctx, tenantID)
	if err != nil {
		log.Printf("GetProcurementSpend30d error: %v", err)
		procurementSpend = pgtype.Numeric{}
	}

	vendorCount, _ := q.GetVendorCount(ctx, tenantID)
	poCount30d, _ := q.GetPurchaseOrderCount30d(ctx, tenantID)

	stockAging90d, err := q.GetStockAgingOver90d(ctx, tenantID)
	if err != nil {
		log.Printf("GetStockAgingOver90d error: %v", err)
		stockAging90d = pgtype.Numeric{}
	}

	return fiber.Map{
		"daily_sales":            sales,
		"production_output":      output,
		"inventory_valuation":    valuation,
		"procurement_spend_30d":  procurementSpend,
		"vendor_count":           vendorCount,
		"purchase_order_count_30d": poCount30d,
		"stock_aging_over_90d":    stockAging90d,
	}
}

func logReportAccess(ctx context.Context, tenantID, userID pgtype.UUID, reportType string, params map[string]string, exportFormat *string) {
	q := db.New(database.Pool)
	paramsJSON, _ := json.Marshal(params)
	var expFmt pgtype.Text
	if exportFormat != nil {
		expFmt.String = *exportFormat
		expFmt.Valid = true
	}
	_, err := q.InsertReportAccessLog(ctx, db.InsertReportAccessLogParams{
		TenantID:     tenantID,
		UserID:       userID,
		ReportType:   reportType,
		Parameters:   paramsJSON,
		ExportFormat: expFmt,
	})
	if err != nil {
		log.Printf("InsertReportAccessLog error: %v", err)
	}
}

// GetReportSummary returns full report data (GET /reports). Supports query params: start_date, end_date (YYYY-MM-DD).
func GetReportSummary(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetDashboardMetrics(c)
	}
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	start, end, startStr, endStr := parseReportDateRange(c)
	cacheKey := reportCacheKey(tenantIDRaw, startStr, endStr)
	if cached, ok := getCachedReport(cacheKey); ok {
		return c.JSON(cached)
	}

	data := getReportData(c.Context(), tenantID, start, end)
	setCachedReport(cacheKey, data)

	var userID pgtype.UUID
	if u, ok := c.Locals("user_id").(string); ok && u != "" {
		_ = userID.Scan(u)
	}
	logReportAccess(c.Context(), tenantID, userID, "summary", map[string]string{
		"start_date": startStr,
		"end_date":   endStr,
	}, nil)

	return c.JSON(data)
}

// GetDashboardMetrics returns dashboard metrics (GET /reports/dashboard). No date params; uses last 30 days.
func GetDashboardMetrics(c *fiber.Ctx) error {
	if v, ok := c.Locals(middleware.MockDataKey).(bool); ok && v {
		return mock.GetDashboardMetrics(c)
	}
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	var start, end pgtype.Date
	return c.JSON(getReportData(c.Context(), tenantID, start, end))
}

// parseGSTRDateRange returns start, end. On error returns code != 0 and message.
func parseGSTRDateRange(c *fiber.Ctx) (start, end pgtype.Date, code int, msg string) {
	startStr := c.Query("start_date")
	endStr := c.Query("end_date")
	if startStr == "" || endStr == "" {
		return pgtype.Date{}, pgtype.Date{}, fiber.StatusBadRequest, "start_date and end_date (YYYY-MM-DD) required"
	}
	startTime, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, fiber.StatusBadRequest, "Invalid start_date"
	}
	endTime, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, fiber.StatusBadRequest, "Invalid end_date"
	}
	start = pgtype.Date{Time: startTime.UTC(), Valid: true}
	end = pgtype.Date{Time: endTime.UTC(), Valid: true}
	if endTime.Before(startTime) {
		return pgtype.Date{}, pgtype.Date{}, fiber.StatusBadRequest, "end_date must be >= start_date"
	}
	return start, end, 0, ""
}

// GetGSTROutward returns outward supplies (sales) with line-level HSN/tax for GSTR-1 style export. Query: start_date, end_date (YYYY-MM-DD).
func GetGSTROutward(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	start, end, code, msg := parseGSTRDateRange(c)
	if code != 0 {
		return c.Status(code).JSON(fiber.Map{"error": msg})
	}
	q := db.New(database.Pool)
	rows, err := q.ListOutwardSuppliesByDateRange(c.Context(), db.ListOutwardSuppliesByDateRangeParams{
		TenantID: tenantID,
		Column2:  start,
		Column3:  end,
	})
	if err != nil {
		log.Printf("ListOutwardSuppliesByDateRange error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch outward supplies"})
	}
	return c.JSON(fiber.Map{"data": rows, "start_date": start.Time.Format("2006-01-02"), "end_date": end.Time.Format("2006-01-02")})
}

// GetGSTRInward returns inward supplies (vendor invoices) for the date range. Query: start_date, end_date.
func GetGSTRInward(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	start, end, code, msg := parseGSTRDateRange(c)
	if code != 0 {
		return c.Status(code).JSON(fiber.Map{"error": msg})
	}
	q := db.New(database.Pool)
	rows, err := q.ListInwardSuppliesByDateRange(c.Context(), db.ListInwardSuppliesByDateRangeParams{
		TenantID: tenantID,
		Column2:  start,
		Column3:  end,
	})
	if err != nil {
		log.Printf("ListInwardSuppliesByDateRange error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch inward supplies"})
	}
	return c.JSON(fiber.Map{"data": rows, "start_date": start.Time.Format("2006-01-02"), "end_date": end.Time.Format("2006-01-02")})
}

// GetGSTRSalesSummaryByHSN returns sales summary grouped by HSN/SAC for the date range. Query: start_date, end_date.
func GetGSTRSalesSummaryByHSN(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	start, end, code, msg := parseGSTRDateRange(c)
	if code != 0 {
		return c.Status(code).JSON(fiber.Map{"error": msg})
	}
	q := db.New(database.Pool)
	rows, err := q.ListSalesSummaryByHSN(c.Context(), db.ListSalesSummaryByHSNParams{
		TenantID: tenantID,
		Column2:  start,
		Column3:  end,
	})
	if err != nil {
		log.Printf("ListSalesSummaryByHSN error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch sales summary by HSN"})
	}
	return c.JSON(fiber.Map{"data": rows, "start_date": start.Time.Format("2006-01-02"), "end_date": end.Time.Format("2006-01-02")})
}

// CalculateGSTRequest body for POST /reports/gst/calculate
type CalculateGSTRequest struct {
	SellerState  string  `json:"seller_state"`
	BuyerState   string  `json:"buyer_state"`
	TaxableValue float64 `json:"taxable_value"`
	RatePct      float64 `json:"rate_pct"`
}

// CalculateGST returns CGST, SGST, IGST for the given taxable value and rate (India rules).
func CalculateGST(c *fiber.Ctx) error {
	var req CalculateGSTRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	cgst, sgst, igst := gst.Calculate(req.SellerState, req.BuyerState, req.TaxableValue, req.RatePct)
	totalTax := cgst + sgst + igst
	return c.JSON(fiber.Map{
		"cgst":          cgst,
		"sgst":          sgst,
		"igst":          igst,
		"total_tax":     totalTax,
		"grand_total":   req.TaxableValue + totalTax,
	})
}
