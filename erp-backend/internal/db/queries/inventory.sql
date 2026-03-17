-- name: ListProductCategories :many
SELECT id, tenant_id, name, description, created_at
FROM product_categories
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: CreateProductCategory :one
INSERT INTO product_categories (tenant_id, name, description)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, name, description, created_at;

-- name: CreateProduct :one
INSERT INTO products (tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING id, tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate, created_at, updated_at;

-- name: GetProduct :one
SELECT id, tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate, created_at, updated_at
FROM products
WHERE id = $1 AND tenant_id = $2;

-- name: ListProducts :many
SELECT id, tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate, created_at, updated_at
FROM products
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: ListProductsByCategory :many
SELECT id, tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate, created_at, updated_at
FROM products
WHERE tenant_id = $1 AND category_id = $2
ORDER BY name ASC;

-- name: UpdateProduct :one
UPDATE products
SET category_id = $3, name = $4, sku = $5, price = $6, reorder_point = $7, safety_stock = $8, lead_time_days = $9, uom = $10, product_type = $11, stock_status = $12, tr_notes = $13, brand = $14, hsn_sac = $15, gst_rate = $16, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, category_id, name, sku, price, reorder_point, safety_stock, lead_time_days, uom, product_type, stock_status, tr_notes, brand, hsn_sac, gst_rate, created_at, updated_at;

-- name: DeleteProduct :exec
DELETE FROM products WHERE id = $1 AND tenant_id = $2;

-- name: CreateWarehouse :one
INSERT INTO warehouses (tenant_id, name, location)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, name, location, created_at;

-- name: ListWarehouses :many
SELECT id, tenant_id, name, location, created_at
FROM warehouses
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: CreateInventoryTransaction :one
INSERT INTO inventory_transactions (
    tenant_id, product_id, warehouse_id, batch_id,
    transaction_type, transaction_reason, quantity, reference_id, notes, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING id, tenant_id, product_id, warehouse_id, batch_id,
          transaction_type, transaction_reason, quantity, reference_id, notes, created_by, created_at;

-- name: GetProductStock :one
SELECT COALESCE(SUM(
    CASE WHEN transaction_type = 'IN' THEN quantity
         WHEN transaction_type = 'OUT' THEN -quantity
         ELSE 0 END
), 0)::DECIMAL AS total_stock
FROM inventory_transactions
WHERE product_id = $1 AND tenant_id = $2;

-- name: ListInventoryTransactions :many
SELECT id, tenant_id, product_id, warehouse_id, batch_id, transaction_type, transaction_reason, quantity, reference_id, notes, created_by, created_at
FROM inventory_transactions
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: ListInventoryTransactionsByProduct :many
SELECT id, tenant_id, product_id, warehouse_id, batch_id, transaction_type, transaction_reason, quantity, reference_id, notes, created_by, created_at
FROM inventory_transactions
WHERE tenant_id = $1 AND product_id = $2
ORDER BY created_at DESC
LIMIT $3;

-- name: ListInventoryTransactionsByProductWarehouse :many
SELECT id, tenant_id, product_id, warehouse_id, batch_id, transaction_type, transaction_reason, quantity, reference_id, notes, created_by, created_at
FROM inventory_transactions
WHERE tenant_id = $1 AND product_id = $2 AND warehouse_id = $3
ORDER BY created_at DESC
LIMIT $4;

-- name: ListProductStockLevels :many
SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
  COALESCE(SUM(
    CASE WHEN it.transaction_type = 'IN' THEN it.quantity
         WHEN it.transaction_type = 'OUT' THEN -it.quantity
         ELSE 0 END
  ), 0)::DECIMAL AS total_stock
FROM products p
LEFT JOIN inventory_transactions it ON it.product_id = p.id AND it.tenant_id = p.tenant_id
WHERE p.tenant_id = $1
GROUP BY p.id, p.name, p.sku
ORDER BY p.name;

-- Inventory valuation by product (current_stock * unit price per product)
-- name: ListInventoryValuationByProduct :many
SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
  COALESCE(SUM(
    CASE WHEN it.transaction_type = 'IN' THEN it.quantity
         WHEN it.transaction_type = 'OUT' THEN -it.quantity
         ELSE 0 END
  ), 0)::DECIMAL AS current_stock,
  p.price AS unit_price,
  (COALESCE(SUM(
    CASE WHEN it.transaction_type = 'IN' THEN it.quantity
         WHEN it.transaction_type = 'OUT' THEN -it.quantity
         ELSE 0 END
  ), 0) * p.price)::DECIMAL AS line_valuation
FROM products p
LEFT JOIN inventory_transactions it ON it.product_id = p.id AND it.tenant_id = p.tenant_id
WHERE p.tenant_id = $1
GROUP BY p.id, p.name, p.sku, p.price
ORDER BY line_valuation DESC NULLS LAST;

-- Production: stock per product per warehouse
-- name: ListStockByWarehouse :many
SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
  w.id AS warehouse_id, w.name AS warehouse_name,
  COALESCE(SUM(
    CASE WHEN it.transaction_type = 'IN' THEN it.quantity
         WHEN it.transaction_type = 'OUT' THEN -it.quantity
         ELSE 0 END
  ), 0)::DECIMAL AS quantity
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_transactions it ON it.product_id = p.id AND it.warehouse_id = w.id AND it.tenant_id = p.tenant_id
WHERE p.tenant_id = $1 AND w.tenant_id = $1
GROUP BY p.id, p.name, p.sku, w.id, w.name
ORDER BY p.name, w.name;

-- Production: products below reorder point (low-stock alerts)
-- name: ListProductsBelowReorderPoint :many
SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
  p.reorder_point, p.safety_stock, p.uom,
  COALESCE(stock.total_stock, 0)::DECIMAL AS current_stock
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(
    CASE WHEN transaction_type = 'IN' THEN quantity
         WHEN transaction_type = 'OUT' THEN -quantity
         ELSE 0 END
  ) AS total_stock
  FROM inventory_transactions it2
  WHERE it2.tenant_id = $1
  GROUP BY it2.product_id
) stock ON stock.product_id = p.id
WHERE p.tenant_id = $1
  AND COALESCE(stock.total_stock, 0) < p.reorder_point
  AND p.reorder_point > 0
ORDER BY COALESCE(stock.total_stock, 0) ASC;

-- Batches (product_batches table)
-- name: CreateProductBatch :one
INSERT INTO product_batches (tenant_id, product_id, batch_number, manufacture_date, expiry_date)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at;

-- name: ListBatchesByProduct :many
SELECT id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at
FROM product_batches
WHERE tenant_id = $1 AND product_id = $2
ORDER BY created_at DESC;

-- Reservations
-- name: CreateInventoryReservation :one
INSERT INTO inventory_reservations (tenant_id, product_id, warehouse_id, quantity, reference_type, reference_id, status, expires_at, created_by)
VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8)
RETURNING id, tenant_id, product_id, warehouse_id, quantity, reference_type, reference_id, status, reserved_at, expires_at, created_by, created_at;

-- name: ListReservations :many
SELECT id, tenant_id, product_id, warehouse_id, quantity, reference_type, reference_id, status, reserved_at, expires_at, created_by, created_at
FROM inventory_reservations
WHERE tenant_id = $1 AND status = 'ACTIVE'
ORDER BY reserved_at DESC
LIMIT $2;

-- name: UpdateReservationStatus :exec
UPDATE inventory_reservations SET status = $3 WHERE id = $1 AND tenant_id = $2;

-- Warehouse transfers
-- name: CreateWarehouseTransfer :one
INSERT INTO warehouse_transfers (tenant_id, from_warehouse_id, to_warehouse_id, product_id, quantity, status, notes, created_by)
VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
RETURNING id, tenant_id, from_warehouse_id, to_warehouse_id, product_id, quantity, status, notes, created_by, created_at, completed_at;

-- name: ListWarehouseTransfers :many
SELECT id, tenant_id, from_warehouse_id, to_warehouse_id, product_id, quantity, status, notes, created_by, created_at, completed_at
FROM warehouse_transfers
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetWarehouseTransfer :one
SELECT id, tenant_id, from_warehouse_id, to_warehouse_id, product_id, quantity, status, notes, created_by, created_at, completed_at
FROM warehouse_transfers
WHERE id = $1 AND tenant_id = $2;

-- name: CompleteWarehouseTransfer :exec
UPDATE warehouse_transfers SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2;
