-- name: CreateCoilConsumptionLog :one
INSERT INTO coil_consumption_log (
  tenant_id, product_id, operation_date, starting_kg, scrap_kg, shortlength_kg, used_kg, remaining_kg, coil_ended, notes, created_by
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING id, tenant_id, product_id, operation_date, starting_kg, scrap_kg, shortlength_kg, used_kg, remaining_kg, coil_ended, notes, created_by, created_at;

-- name: ListCoilConsumptionLogs :many
SELECT c.id, c.tenant_id, c.product_id, c.operation_date, c.starting_kg, c.scrap_kg, c.shortlength_kg, c.used_kg, c.remaining_kg, c.coil_ended, c.notes, c.created_by, c.created_at,
  p.name AS product_name, p.sku AS product_sku, p.product_type, p.uom
FROM coil_consumption_log c
JOIN products p ON p.id = c.product_id AND p.tenant_id = c.tenant_id
WHERE c.tenant_id = $1
ORDER BY c.operation_date DESC, c.created_at DESC
LIMIT $2;

-- name: ListCoilConsumptionLogsByProduct :many
SELECT c.id, c.tenant_id, c.product_id, c.operation_date, c.starting_kg, c.scrap_kg, c.shortlength_kg, c.used_kg, c.remaining_kg, c.coil_ended, c.notes, c.created_by, c.created_at,
  p.name AS product_name, p.sku AS product_sku, p.product_type, p.uom
FROM coil_consumption_log c
JOIN products p ON p.id = c.product_id AND p.tenant_id = c.tenant_id
WHERE c.tenant_id = $1 AND c.product_id = $2
ORDER BY c.operation_date DESC, c.created_at DESC
LIMIT $3;

-- name: GetLastCoilRemainingByProduct :one
SELECT remaining_kg FROM coil_consumption_log
WHERE tenant_id = $1 AND product_id = $2
ORDER BY operation_date DESC, created_at DESC
LIMIT 1;

-- Stock levels with Reva fields (STOCK COIL tab: name, type, # stock, status, tr_notes). Optional category filter.
-- name: ListStockLevelsWithReva :many
SELECT p.id AS product_id, p.name AS product_name, p.sku AS product_sku,
  p.product_type, p.stock_status, p.tr_notes, p.uom, p.brand, p.category_id,
  COALESCE(SUM(
    CASE WHEN it.transaction_type = 'IN' THEN it.quantity
         WHEN it.transaction_type = 'OUT' THEN -it.quantity
         ELSE 0 END
  ), 0)::DECIMAL AS total_stock
FROM products p
LEFT JOIN inventory_transactions it ON it.product_id = p.id AND it.tenant_id = p.tenant_id
WHERE p.tenant_id = sqlc.arg('tenant_id') AND (sqlc.narg('category_id')::uuid IS NULL OR p.category_id = sqlc.narg('category_id'))
GROUP BY p.id, p.name, p.sku, p.product_type, p.stock_status, p.tr_notes, p.uom, p.brand, p.category_id
ORDER BY p.name;

-- Purchase history: PO items with date, vendor, product (for "Reva item purchase history" view)
-- name: ListPurchaseHistory :many
SELECT
  po.id AS po_id,
  po.po_number,
  po.created_at::date AS order_date,
  v.id AS vendor_id,
  v.name AS vendor_name,
  v.status_notes AS vendor_status_notes,
  p.id AS product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  p.product_type,
  p.uom,
  poi.quantity,
  poi.unit_price,
  poi.total_price
FROM purchase_order_items poi
JOIN purchase_orders po ON po.id = poi.po_id AND po.tenant_id = poi.tenant_id
JOIN vendors v ON v.id = po.vendor_id AND v.tenant_id = po.tenant_id
JOIN products p ON p.id = poi.product_id AND p.tenant_id = poi.tenant_id
WHERE poi.tenant_id = $1
ORDER BY po.created_at DESC
LIMIT $2;

-- Company profile (one row per tenant) — India: state_code, tan
-- name: GetCompanyProfile :one
SELECT tenant_id, company_name, address_line1, address_line2, city, state, state_code, pincode, country, gst_number, tan, contact_email, contact_phone, updated_at
FROM company_profiles
WHERE tenant_id = $1;

-- name: UpsertCompanyProfile :one
INSERT INTO company_profiles (tenant_id, company_name, address_line1, address_line2, city, state, state_code, pincode, country, gst_number, tan, contact_email, contact_phone, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  address_line1 = EXCLUDED.address_line1,
  address_line2 = EXCLUDED.address_line2,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  state_code = EXCLUDED.state_code,
  pincode = EXCLUDED.pincode,
  country = EXCLUDED.country,
  gst_number = EXCLUDED.gst_number,
  tan = EXCLUDED.tan,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  updated_at = CURRENT_TIMESTAMP
RETURNING tenant_id, company_name, address_line1, address_line2, city, state, state_code, pincode, country, gst_number, tan, contact_email, contact_phone, updated_at;
