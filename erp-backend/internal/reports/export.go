package reports

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
	"github.com/xuri/excelize/v2"
)

func numericToString(n pgtype.Numeric) string {
	if !n.Valid {
		return "0"
	}
	// pgtype.Numeric can be Int or big.Int based; use MarshalJSON and trim quotes
	b, _ := n.MarshalJSON()
	if len(b) >= 2 && b[0] == '"' {
		return string(b[1 : len(b)-1])
	}
	return string(b)
}

func dateToString(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

// getReportDataForExport returns raw data for export (same as getReportData but returns typed slices for CSV/Excel).
func getReportDataForExport(ctx context.Context, tenantID pgtype.UUID, start, end pgtype.Date) (
	sales []db.GetDailySalesWithRangeRow,
	production []db.GetProductionOutputWithRangeRow,
	valuation pgtype.Numeric,
	err error,
) {
	q := db.New(database.Pool)
	if start.Valid && end.Valid {
		sales, err = q.GetDailySalesWithRange(ctx, db.GetDailySalesWithRangeParams{TenantID: tenantID, Column2: start, Column3: end})
		if err != nil {
			return nil, nil, pgtype.Numeric{}, err
		}
		production, err = q.GetProductionOutputWithRange(ctx, db.GetProductionOutputWithRangeParams{TenantID: tenantID, Column2: start, Column3: end})
		if err != nil {
			return nil, nil, pgtype.Numeric{}, err
		}
	} else {
		sales30, _ := q.GetDailySales(ctx, tenantID)
		prod30, _ := q.GetProductionOutput(ctx, tenantID)
		sales = make([]db.GetDailySalesWithRangeRow, len(sales30))
		for i := range sales30 {
			sales[i] = db.GetDailySalesWithRangeRow{SaleDate: sales30[i].SaleDate, TotalRevenue: sales30[i].TotalRevenue}
		}
		production = make([]db.GetProductionOutputWithRangeRow, len(prod30))
		for i := range prod30 {
			production[i] = db.GetProductionOutputWithRangeRow{ProductionDate: prod30[i].ProductionDate, TotalProduced: prod30[i].TotalProduced}
		}
	}
	valuation, err = q.GetInventoryValuation(ctx, tenantID)
	if err != nil {
		valuation = pgtype.Numeric{}
	}
	return sales, production, valuation, nil
}

// ExportReport handles GET /reports/export?format=csv|excel&report=daily_sales|production_output|summary&start_date=&end_date=
func ExportReport(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}
	tenantID, err := toUUID(tenantIDRaw)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid tenant context"})
	}

	format := c.Query("format", "csv")
	if format != "csv" && format != "excel" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "format must be csv or excel"})
	}
	reportType := c.Query("report", "summary")
	start, end, startStr, endStr := parseReportDateRange(c)

	sales, production, valuation, err := getReportDataForExport(c.Context(), tenantID, start, end)
	if err != nil {
		log.Printf("getReportDataForExport error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate report"})
	}

	var userID pgtype.UUID
	if u, ok := c.Locals("user_id").(string); ok && u != "" {
		_ = userID.Scan(u)
	}
	logReportAccess(c.Context(), tenantID, userID, "export_"+reportType, map[string]string{
		"start_date": startStr, "end_date": endStr, "format": format,
	}, &format)

	filename := fmt.Sprintf("report_%s_%s", reportType, time.Now().Format("20060102"))

	switch format {
	case "csv":
		return exportCSV(c, reportType, filename, sales, production, valuation)
	case "excel":
		return exportExcel(c, reportType, filename, sales, production, valuation)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported format"})
	}
}

func exportCSV(c *fiber.Ctx, reportType, filename string, sales []db.GetDailySalesWithRangeRow, production []db.GetProductionOutputWithRangeRow, valuation pgtype.Numeric) error {
	buf := new(bytes.Buffer)
	w := csv.NewWriter(buf)
	w.Write([]string{"Report", "Date", "Value"})
	for _, r := range sales {
		w.Write([]string{"daily_sales", dateToString(r.SaleDate), numericToString(r.TotalRevenue)})
	}
	for _, r := range production {
		w.Write([]string{"production_output", dateToString(r.ProductionDate), numericToString(r.TotalProduced)})
	}
	if reportType == "summary" {
		w.Write([]string{"inventory_valuation", "", numericToString(valuation)})
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "CSV generation failed"})
	}
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", "attachment; filename=\""+filename+".csv\"")
	return c.Send(buf.Bytes())
}

func exportExcel(c *fiber.Ctx, reportType, filename string, sales []db.GetDailySalesWithRangeRow, production []db.GetProductionOutputWithRangeRow, valuation pgtype.Numeric) error {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Report"
	// Daily Sales
	f.SetCellValue(sheet, "A1", "Report")
	f.SetCellValue(sheet, "B1", "Date")
	f.SetCellValue(sheet, "C1", "Value")
	row := 2
	for _, r := range sales {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), "daily_sales")
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), dateToString(r.SaleDate))
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), numericToString(r.TotalRevenue))
		row++
	}
	for _, r := range production {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), "production_output")
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), dateToString(r.ProductionDate))
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), numericToString(r.TotalProduced))
		row++
	}
	if reportType == "summary" {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), "inventory_valuation")
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), numericToString(valuation))
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Excel generation failed"})
	}
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=\""+filename+".xlsx\"")
	return c.Send(buf.Bytes())
}
