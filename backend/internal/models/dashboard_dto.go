package models

// DashboardRecentActivityDTO is a sanitized activity row for dashboard cards.
type DashboardRecentActivityDTO struct {
	JournalID   string  `json:"journal_id"`
	CreatedAt   string  `json:"created_at"`
	WorkerName  string  `json:"worker_name"`
	SourceBatch string  `json:"source_batch"`
	InputQty    float64 `json:"input_qty"`
	FinishedQty float64 `json:"finished_qty"`
	ScrapQty    float64 `json:"scrap_qty"`
}

// DashboardSummaryDTO is the API payload returned by dashboard summary endpoint.
type DashboardSummaryDTO struct {
	TotalRawMaterialWeight   float64                      `json:"total_raw_material_weight"`
	TotalFinishedPipesWeight float64                      `json:"total_finished_pipes_weight"`
	PendingPOCount           int64                        `json:"pending_po_count"`
	TotalActiveUsers         int64                        `json:"total_active_users"`
	TotalItemsSKU            int64                        `json:"total_items_sku"`
	LowStockCount            int64                        `json:"low_stock_count"`
	TotalVendors             int64                        `json:"total_vendors"`
	RecentActivity           []DashboardRecentActivityDTO `json:"recent_activity"`
}
