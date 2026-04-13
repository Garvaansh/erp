package services

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrReportQueryFailed = errors.New("report query failed")
)

type ReportService struct {
	pool *pgxpool.Pool
}

func NewReportService(pool *pgxpool.Pool) *ReportService {
	return &ReportService{pool: pool}
}

// ── Inventory Report ──

type InventoryReportRow struct {
	ItemID       string  `json:"item_id"`
	SKU          string  `json:"sku"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	TotalQty     float64 `json:"total_qty"`
	AvailableQty float64 `json:"available_qty"`
	ReservedQty  float64 `json:"reserved_qty"`
	MinQty       float64 `json:"min_qty"`
	MaxQty       float64 `json:"max_qty"`
	IsLowStock   bool    `json:"is_low_stock"`
	BatchCount   int     `json:"batch_count"`
}

type InventoryMovementRow struct {
	Date      string  `json:"date"`
	Direction string  `json:"direction"`
	TotalQty  float64 `json:"total_qty"`
	TxCount   int     `json:"tx_count"`
}

type InventoryReportResult struct {
	StockOnHand    []InventoryReportRow   `json:"stock_on_hand"`
	MovementByDay  []InventoryMovementRow `json:"movement_by_day"`
	TotalItems     int                    `json:"total_items"`
	LowStockCount  int                    `json:"low_stock_count"`
	TotalStockQty  float64                `json:"total_stock_qty"`
}

func (s *ReportService) GetInventoryReport(ctx context.Context, days int) (*InventoryReportResult, error) {
	if s.pool == nil {
		return nil, ErrReportQueryFailed
	}

	if days <= 0 {
		days = 30
	}

	// Stock on hand per item
	stockRows, err := s.pool.Query(ctx, `
		SELECT
			i.id::text, COALESCE(i.sku,''), i.name, i.category::text,
			COALESCE(SUM(b.remaining_qty), 0) AS total_qty,
			COALESCE(SUM(b.remaining_qty) - SUM(COALESCE(b.reserved_qty, 0)), 0) AS available_qty,
			COALESCE(SUM(COALESCE(b.reserved_qty, 0)), 0) AS reserved_qty,
			i.min_qty, i.max_qty,
			COUNT(b.id) AS batch_count
		FROM items i
		LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.status IN ('NEW','ACTIVE')
		WHERE i.is_active = true
		GROUP BY i.id, i.sku, i.name, i.category, i.min_qty, i.max_qty
		ORDER BY i.name
	`)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer stockRows.Close()

	var stockOnHand []InventoryReportRow
	var totalStockQty float64
	var lowStockCount int

	for stockRows.Next() {
		var r InventoryReportRow
		if err := stockRows.Scan(&r.ItemID, &r.SKU, &r.Name, &r.Category,
			&r.TotalQty, &r.AvailableQty, &r.ReservedQty,
			&r.MinQty, &r.MaxQty, &r.BatchCount); err != nil {
			return nil, ErrReportQueryFailed
		}
		r.IsLowStock = r.MinQty > 0 && r.TotalQty < r.MinQty
		if r.IsLowStock {
			lowStockCount++
		}
		totalStockQty += r.TotalQty
		stockOnHand = append(stockOnHand, r)
	}

	if stockOnHand == nil {
		stockOnHand = []InventoryReportRow{}
	}

	// Movement by day
	since := time.Now().UTC().AddDate(0, 0, -days)
	mvRows, err := s.pool.Query(ctx, `
		SELECT
			TO_CHAR(created_at, 'YYYY-MM-DD') AS dt,
			direction::text,
			COALESCE(SUM(quantity), 0),
			COUNT(*)
		FROM inventory_transactions
		WHERE created_at >= $1
		GROUP BY dt, direction
		ORDER BY dt
	`, since)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer mvRows.Close()

	var movements []InventoryMovementRow
	for mvRows.Next() {
		var r InventoryMovementRow
		if err := mvRows.Scan(&r.Date, &r.Direction, &r.TotalQty, &r.TxCount); err != nil {
			return nil, ErrReportQueryFailed
		}
		movements = append(movements, r)
	}
	if movements == nil {
		movements = []InventoryMovementRow{}
	}

	return &InventoryReportResult{
		StockOnHand:   stockOnHand,
		MovementByDay: movements,
		TotalItems:    len(stockOnHand),
		LowStockCount: lowStockCount,
		TotalStockQty: totalStockQty,
	}, nil
}

// ── Purchase Report ──

type PurchaseReportRow struct {
	VendorName  string  `json:"vendor_name"`
	TotalOrders int     `json:"total_orders"`
	PendingPOs  int     `json:"pending_pos"`
	DeliveredPOs int    `json:"delivered_pos"`
	TotalValue  float64 `json:"total_value"`
	TotalQty    float64 `json:"total_qty"`
}

type PurchaseTimelineRow struct {
	Date       string  `json:"date"`
	OrderCount int     `json:"order_count"`
	TotalValue float64 `json:"total_value"`
}

type PurchaseReportResult struct {
	ByVendor     []PurchaseReportRow   `json:"by_vendor"`
	Timeline     []PurchaseTimelineRow `json:"timeline"`
	TotalOrders  int                   `json:"total_orders"`
	TotalPending int                   `json:"total_pending"`
	TotalValue   float64               `json:"total_value"`
}

func (s *ReportService) GetPurchaseReport(ctx context.Context, days int) (*PurchaseReportResult, error) {
	if s.pool == nil {
		return nil, ErrReportQueryFailed
	}

	if days <= 0 {
		days = 30
	}

	since := time.Now().UTC().AddDate(0, 0, -days)

	// By vendor
	vendorRows, err := s.pool.Query(ctx, `
		SELECT
			vendor_name,
			COUNT(*) AS total_orders,
			COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
			COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
			COALESCE(SUM(ordered_qty * unit_price), 0) AS total_value,
			COALESCE(SUM(ordered_qty), 0) AS total_qty
		FROM purchase_orders
		WHERE created_at >= $1
		GROUP BY vendor_name
		ORDER BY total_value DESC
	`, since)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer vendorRows.Close()

	var byVendor []PurchaseReportRow
	var totalOrders, totalPending int
	var totalValue float64

	for vendorRows.Next() {
		var r PurchaseReportRow
		if err := vendorRows.Scan(&r.VendorName, &r.TotalOrders, &r.PendingPOs,
			&r.DeliveredPOs, &r.TotalValue, &r.TotalQty); err != nil {
			return nil, ErrReportQueryFailed
		}
		totalOrders += r.TotalOrders
		totalPending += r.PendingPOs
		totalValue += r.TotalValue
		byVendor = append(byVendor, r)
	}
	if byVendor == nil {
		byVendor = []PurchaseReportRow{}
	}

	// Timeline
	tlRows, err := s.pool.Query(ctx, `
		SELECT
			TO_CHAR(created_at, 'YYYY-MM-DD') AS dt,
			COUNT(*),
			COALESCE(SUM(ordered_qty * unit_price), 0)
		FROM purchase_orders
		WHERE created_at >= $1
		GROUP BY dt
		ORDER BY dt
	`, since)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer tlRows.Close()

	var timeline []PurchaseTimelineRow
	for tlRows.Next() {
		var r PurchaseTimelineRow
		if err := tlRows.Scan(&r.Date, &r.OrderCount, &r.TotalValue); err != nil {
			return nil, ErrReportQueryFailed
		}
		timeline = append(timeline, r)
	}
	if timeline == nil {
		timeline = []PurchaseTimelineRow{}
	}

	return &PurchaseReportResult{
		ByVendor:     byVendor,
		Timeline:     timeline,
		TotalOrders:  totalOrders,
		TotalPending: totalPending,
		TotalValue:   totalValue,
	}, nil
}

// ── Users Report ──

type UserReportRow struct {
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
}

type UserReportResult struct {
	Users       []UserReportRow `json:"users"`
	TotalUsers  int             `json:"total_users"`
	ActiveUsers int             `json:"active_users"`
	AdminCount  int             `json:"admin_count"`
	WorkerCount int             `json:"worker_count"`
}

func (s *ReportService) GetUsersReport(ctx context.Context) (*UserReportResult, error) {
	if s.pool == nil {
		return nil, ErrReportQueryFailed
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			u.id::text, u.name, u.email, r.code, u.is_active, u.created_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer rows.Close()

	var users []UserReportRow
	var activeCount, adminCount, workerCount int

	for rows.Next() {
		var r UserReportRow
		var createdAt time.Time
		if err := rows.Scan(&r.UserID, &r.Name, &r.Email, &r.Role, &r.IsActive, &createdAt); err != nil {
			return nil, ErrReportQueryFailed
		}
		r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if r.IsActive {
			activeCount++
		}
		if r.Role == "SUPER_ADMIN" || r.Role == "ADMIN" {
			adminCount++
		}
		if r.Role == "WORKER" {
			workerCount++
		}
		users = append(users, r)
	}
	if users == nil {
		users = []UserReportRow{}
	}

	return &UserReportResult{
		Users:       users,
		TotalUsers:  len(users),
		ActiveUsers: activeCount,
		AdminCount:  adminCount,
		WorkerCount: workerCount,
	}, nil
}
