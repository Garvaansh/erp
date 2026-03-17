-- name: GetDailySales :many
SELECT DATE(created_at) AS sale_date, SUM(total_amount)::DECIMAL AS total_revenue
FROM sales_orders
WHERE tenant_id = $1 AND status != 'CANCELLED'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- name: GetDailySalesWithRange :many
SELECT DATE(created_at) AS sale_date, SUM(total_amount)::DECIMAL AS total_revenue
FROM sales_orders
WHERE tenant_id = $1 AND status != 'CANCELLED'
  AND created_at >= $2::date
  AND created_at < ($3::date + INTERVAL '1 day')
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- name: GetProductionOutput :many
SELECT DATE(produced_at) AS production_date, SUM(quantity)::DECIMAL AS total_produced
FROM production_logs
WHERE tenant_id = $1
  AND produced_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(produced_at)
ORDER BY production_date DESC;

-- name: GetProductionOutputWithRange :many
SELECT DATE(produced_at) AS production_date, SUM(quantity)::DECIMAL AS total_produced
FROM production_logs
WHERE tenant_id = $1
  AND produced_at >= $2::date
  AND produced_at < ($3::date + INTERVAL '1 day')
GROUP BY DATE(produced_at)
ORDER BY production_date DESC;

-- name: GetInventoryValuation :one
WITH stock_data AS (
    SELECT product_id, SUM(
        CASE WHEN transaction_type = 'IN' THEN quantity
             WHEN transaction_type = 'OUT' THEN -quantity
             ELSE 0 END
    ) AS current_stock
    FROM inventory_transactions
    WHERE tenant_id = $1
    GROUP BY product_id
)
SELECT COALESCE(SUM(s.current_stock * p.price), 0)::DECIMAL AS total_valuation
FROM stock_data s
JOIN products p ON p.id = s.product_id
WHERE p.tenant_id = $1;

-- name: GetInventoryKpis :one
WITH stock AS (
  SELECT
    it.product_id,
    MAX(it.created_at) AS last_movement_at,
    COALESCE(SUM(
      CASE WHEN it.transaction_type = 'IN' THEN it.quantity
           WHEN it.transaction_type = 'OUT' THEN -it.quantity
           ELSE 0 END
    ), 0)::DECIMAL AS on_hand_qty
  FROM inventory_transactions it
  WHERE it.tenant_id = $1
  GROUP BY it.product_id
),
product_stats AS (
  SELECT
    p.id AS product_id,
    p.price,
    p.reorder_point,
    COALESCE(s.on_hand_qty, 0)::DECIMAL AS on_hand_qty,
    s.last_movement_at
  FROM products p
  LEFT JOIN stock s ON s.product_id = p.id
  WHERE p.tenant_id = $1
)
SELECT
  (SELECT COUNT(*)::BIGINT FROM products p WHERE p.tenant_id = $1) AS total_skus,
  COALESCE(SUM(ps.on_hand_qty * ps.price), 0)::DECIMAL AS total_inventory_value,
  COALESCE(SUM(CASE WHEN ps.reorder_point > 0 AND ps.on_hand_qty < ps.reorder_point THEN 1 ELSE 0 END), 0)::BIGINT AS low_stock_items,
  COALESCE(SUM(CASE WHEN ps.on_hand_qty <= 0 THEN 1 ELSE 0 END), 0)::BIGINT AS out_of_stock_items,
  COALESCE((SELECT SUM(r.quantity)::DECIMAL FROM inventory_reservations r WHERE r.tenant_id = $1 AND r.status = 'ACTIVE'), 0)::DECIMAL AS reserved_qty,
  COALESCE((SELECT SUM(t.quantity)::DECIMAL FROM warehouse_transfers t WHERE t.tenant_id = $1 AND t.status = 'PENDING'), 0)::DECIMAL AS in_transit_qty,
  COALESCE(SUM(
    CASE
      WHEN ps.on_hand_qty > 0
       AND (ps.last_movement_at IS NULL OR ps.last_movement_at < (NOW() - ($2::int || ' days')::interval))
      THEN 1 ELSE 0
    END
  ), 0)::BIGINT AS dead_stock_items
FROM product_stats ps;

-- name: GetProcurementSpend30d :one
SELECT COALESCE(SUM(total_amount), 0)::DECIMAL AS total_spend
FROM vendor_invoices
WHERE tenant_id = $1
  AND invoice_date >= CURRENT_DATE - INTERVAL '30 days'
  AND status != 'CANCELLED';

-- name: GetVendorCount :one
SELECT COUNT(*)::BIGINT AS vendor_count FROM vendors WHERE tenant_id = $1;

-- name: GetPurchaseOrderCount30d :one
SELECT COUNT(*)::BIGINT AS po_count
FROM purchase_orders
WHERE tenant_id = $1
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND status != 'CANCELLED';

-- name: GetStockAgingOver90d :one
SELECT COALESCE(SUM(net_qty * p.price), 0)::DECIMAL AS aging_value
FROM (
    SELECT t.product_id, t.batch_id,
        SUM(CASE WHEN t.transaction_type = 'IN' THEN t.quantity WHEN t.transaction_type = 'OUT' THEN -t.quantity ELSE 0 END) AS net_qty
    FROM inventory_transactions t
    WHERE t.tenant_id = $1
    GROUP BY t.product_id, t.batch_id
    HAVING SUM(CASE WHEN t.transaction_type = 'IN' THEN t.quantity WHEN t.transaction_type = 'OUT' THEN -t.quantity ELSE 0 END) > 0
) it
JOIN products p ON p.id = it.product_id AND p.tenant_id = $1
LEFT JOIN product_batches pb ON pb.id = it.batch_id
WHERE pb.manufacture_date IS NOT NULL AND pb.manufacture_date < CURRENT_DATE - INTERVAL '90 days';
