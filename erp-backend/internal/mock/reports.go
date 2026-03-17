package mock

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

// GetDashboardMetrics returns mock dashboard data (daily_sales, production_output, inventory_valuation).
// Shape must match real API: daily_sales[].sale_date, total_revenue; production_output[].production_date, total_produced.
func GetDashboardMetrics(c *fiber.Ctx) error {
	const days = 30
	dailySales := make([]map[string]interface{}, days)
	for i := 0; i < days; i++ {
		dailySales[i] = map[string]interface{}{
			"sale_date":     DateStr(i),
			"total_revenue": NumericStr(10000.0 + float64(i*500)),
		}
	}
	productionOutput := make([]map[string]interface{}, days)
	for i := 0; i < days; i++ {
		productionOutput[i] = map[string]interface{}{
			"production_date": DateStr(i),
			"total_produced":  NumericStr(5000.0 + float64(i*100)),
		}
	}
	return c.JSON(fiber.Map{
		"daily_sales":              dailySales,
		"production_output":        productionOutput,
		"inventory_valuation":      NumericStr(2500000.0),
		"procurement_spend_30d":     NumericStr(850000.0),
		"vendor_count":             int64(24),
		"purchase_order_count_30d": int64(18),
		"stock_aging_over_90d":      NumericStr(120000.0),
	})
}

// ListSchedules returns paginated mock report schedules (1L total).
func ListSchedules(c *fiber.Ctx) error {
	limit, offset := LimitOffset(c)
	list := make([]map[string]interface{}, 0, limit)
	for i := offset; i < offset+limit && i < TotalMockRecords; i++ {
		list = append(list, map[string]interface{}{
			"id":               UUID("sched", i),
			"tenant_id":        UUID("tenant", 0),
			"created_by":       UUID("user", 0),
			"name":             fmt.Sprintf("Schedule %d", i+1),
			"report_type":      "summary",
			"frequency":        "daily",
			"export_format":    "xlsx",
			"recipient_email":  fmt.Sprintf("user%d@mock.com", i+1),
			"parameters":       nil,
			"last_run_at":      nil,
			"next_run_at":      TimestampStr(i),
			"created_at":       TimestampStr(i),
		})
	}
	c.Set("X-Total-Count", fmt.Sprintf("%d", TotalMockRecords))
	return c.JSON(fiber.Map{"schedules": list})
}
