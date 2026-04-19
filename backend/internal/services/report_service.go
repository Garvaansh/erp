package services

import (
	"context"
	"errors"
	"sort"
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
	StockOnHand   []InventoryReportRow   `json:"stock_on_hand"`
	MovementByDay []InventoryMovementRow `json:"movement_by_day"`
	TotalItems    int                    `json:"total_items"`
	LowStockCount int                    `json:"low_stock_count"`
	TotalStockQty float64                `json:"total_stock_qty"`
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
	VendorID     string  `json:"vendor_id"`
	VendorCode   string  `json:"vendor_code"`
	VendorName   string  `json:"vendor_name"`
	TotalOrders  int     `json:"total_orders"`
	PendingPOs   int     `json:"pending_pos"`
	DeliveredPOs int     `json:"delivered_pos"`
	TotalValue   float64 `json:"total_value"`
	TotalQty     float64 `json:"total_qty"`
}

type PurchaseFlatRow struct {
	Date             string  `json:"date"`
	PurchaseOrderID  string  `json:"purchase_order_id"`
	PONumber         string  `json:"po_number"`
	VendorID         string  `json:"vendor_id"`
	VendorCode       string  `json:"vendor_code"`
	VendorName       string  `json:"vendor_name"`
	ItemName         string  `json:"item_name"`
	QuantityReceived float64 `json:"quantity_received"`
	UnitCost         float64 `json:"unit_cost"`
	TotalValue       float64 `json:"total_value"`
	PaymentStatus    string  `json:"payment_status"`
	Status           string  `json:"status"`
}

type PurchaseTimelineRow struct {
	Date       string  `json:"date"`
	OrderCount int     `json:"order_count"`
	TotalValue float64 `json:"total_value"`
}

type PurchaseReportResult struct {
	Rows         []PurchaseFlatRow     `json:"rows"`
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

	reportRows, err := s.pool.Query(ctx, `
		WITH payment_totals AS (
			SELECT po_id, COALESCE(SUM(amount), 0) AS paid_amount
			FROM purchase_order_payments
			GROUP BY po_id
		),
		received_rows AS (
			SELECT
				b.created_at AS receipt_ts,
				po.id AS po_id,
				po.po_number,
				po.vendor_id,
				COALESCE(v.vendor_code, '') AS vendor_code,
				COALESCE(v.name, '') AS vendor_name,
				COALESCE(i.name, '') AS item_name,
				COALESCE(b.initial_qty, 0)::numeric AS quantity_received,
				COALESCE(b.unit_cost, po.unit_price, 0)::numeric AS unit_cost,
				(COALESCE(b.initial_qty, 0) * COALESCE(b.unit_cost, po.unit_price, 0))::numeric AS total_value,
				po.status::text AS po_status
			FROM inventory_batches b
			JOIN purchase_orders po ON po.id = b.parent_po_id
			JOIN vendors v ON v.id = po.vendor_id
			LEFT JOIN items i ON i.id = po.item_id
			WHERE b.created_at >= $1
			  AND b.status <> 'REVERSED'

			UNION ALL

			SELECT
				po.updated_at AS receipt_ts,
				po.id AS po_id,
				po.po_number,
				po.vendor_id,
				COALESCE(v.vendor_code, '') AS vendor_code,
				COALESCE(v.name, '') AS vendor_name,
				COALESCE(i.name, '') AS item_name,
				COALESCE(po.received_qty, 0)::numeric AS quantity_received,
				COALESCE(po.unit_price, 0)::numeric AS unit_cost,
				(COALESCE(po.received_qty, 0) * COALESCE(po.unit_price, 0))::numeric AS total_value,
				po.status::text AS po_status
			FROM purchase_orders po
			JOIN vendors v ON v.id = po.vendor_id
			LEFT JOIN items i ON i.id = po.item_id
			WHERE po.updated_at >= $1
			  AND po.received_qty > 0
			  AND NOT EXISTS (
				SELECT 1
				FROM inventory_batches b
				WHERE b.parent_po_id = po.id
			  )
		),
		po_value_totals AS (
			SELECT po_id, COALESCE(SUM(total_value), 0) AS po_total_value
			FROM received_rows
			GROUP BY po_id
		)
		SELECT
			TO_CHAR(received_rows.receipt_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS receipt_date,
			received_rows.po_id::text,
			received_rows.po_number,
			received_rows.vendor_id::text,
			received_rows.vendor_code,
			received_rows.vendor_name,
			received_rows.item_name,
			received_rows.quantity_received::float8,
			received_rows.unit_cost::float8,
			received_rows.total_value::float8,
			CASE
				WHEN COALESCE(payment_totals.paid_amount, 0) <= 0 THEN 'UNPAID'
				WHEN COALESCE(payment_totals.paid_amount, 0) >= COALESCE(po_value_totals.po_total_value, 0) THEN 'PAID'
				ELSE 'PARTIAL'
			END AS payment_status,
			received_rows.po_status
		FROM received_rows
		LEFT JOIN payment_totals ON payment_totals.po_id = received_rows.po_id
		LEFT JOIN po_value_totals ON po_value_totals.po_id = received_rows.po_id
		ORDER BY received_rows.receipt_ts, received_rows.po_number
	`, since)
	if err != nil {
		return nil, ErrReportQueryFailed
	}
	defer reportRows.Close()

	type vendorAggregate struct {
		row          PurchaseReportRow
		orderIDs     map[string]struct{}
		pendingIDs   map[string]struct{}
		deliveredIDs map[string]struct{}
	}

	rows := make([]PurchaseFlatRow, 0)
	vendorAgg := make(map[string]*vendorAggregate)
	vendorKeys := make([]string, 0)
	timelineValue := make(map[string]float64)
	timelineOrders := make(map[string]map[string]struct{})
	poStatus := make(map[string]string)

	totalValue := 0.0

	for reportRows.Next() {
		var row PurchaseFlatRow
		if err := reportRows.Scan(
			&row.Date,
			&row.PurchaseOrderID,
			&row.PONumber,
			&row.VendorID,
			&row.VendorCode,
			&row.VendorName,
			&row.ItemName,
			&row.QuantityReceived,
			&row.UnitCost,
			&row.TotalValue,
			&row.PaymentStatus,
			&row.Status,
		); err != nil {
			return nil, ErrReportQueryFailed
		}

		rows = append(rows, row)
		totalValue += row.TotalValue

		if _, exists := poStatus[row.PurchaseOrderID]; !exists {
			poStatus[row.PurchaseOrderID] = row.Status
		}

		if _, exists := timelineOrders[row.Date]; !exists {
			timelineOrders[row.Date] = make(map[string]struct{})
		}
		timelineOrders[row.Date][row.PurchaseOrderID] = struct{}{}
		timelineValue[row.Date] += row.TotalValue

		vendorKey := row.VendorID

		agg, exists := vendorAgg[vendorKey]
		if !exists {
			agg = &vendorAggregate{
				row: PurchaseReportRow{
					VendorID:   row.VendorID,
					VendorCode: row.VendorCode,
					VendorName: row.VendorName,
				},
				orderIDs:     make(map[string]struct{}),
				pendingIDs:   make(map[string]struct{}),
				deliveredIDs: make(map[string]struct{}),
			}
			vendorAgg[vendorKey] = agg
			vendorKeys = append(vendorKeys, vendorKey)
		}

		agg.row.TotalQty += row.QuantityReceived
		agg.row.TotalValue += row.TotalValue
		agg.orderIDs[row.PurchaseOrderID] = struct{}{}

		if row.Status == "COMPLETED" || row.Status == "CLOSED" {
			agg.deliveredIDs[row.PurchaseOrderID] = struct{}{}
		} else {
			agg.pendingIDs[row.PurchaseOrderID] = struct{}{}
		}
	}

	if err := reportRows.Err(); err != nil {
		return nil, ErrReportQueryFailed
	}

	if rows == nil {
		rows = []PurchaseFlatRow{}
	}

	byVendor := make([]PurchaseReportRow, 0, len(vendorKeys))
	for _, key := range vendorKeys {
		agg := vendorAgg[key]
		agg.row.TotalOrders = len(agg.orderIDs)
		agg.row.PendingPOs = len(agg.pendingIDs)
		agg.row.DeliveredPOs = len(agg.deliveredIDs)
		byVendor = append(byVendor, agg.row)
	}

	sort.Slice(byVendor, func(i, j int) bool {
		if byVendor[i].TotalValue == byVendor[j].TotalValue {
			return byVendor[i].VendorName < byVendor[j].VendorName
		}
		return byVendor[i].TotalValue > byVendor[j].TotalValue
	})

	if byVendor == nil {
		byVendor = []PurchaseReportRow{}
	}

	dateKeys := make([]string, 0, len(timelineValue))
	for dt := range timelineValue {
		dateKeys = append(dateKeys, dt)
	}
	sort.Strings(dateKeys)

	timeline := make([]PurchaseTimelineRow, 0, len(dateKeys))
	for _, dt := range dateKeys {
		timeline = append(timeline, PurchaseTimelineRow{
			Date:       dt,
			OrderCount: len(timelineOrders[dt]),
			TotalValue: timelineValue[dt],
		})
	}

	if timeline == nil {
		timeline = []PurchaseTimelineRow{}
	}

	totalOrders := len(poStatus)
	totalPending := 0
	for _, status := range poStatus {
		if status != "COMPLETED" && status != "CLOSED" {
			totalPending++
		}
	}

	return &PurchaseReportResult{
		Rows:         rows,
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
