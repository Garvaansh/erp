-- name: CreateVendor :one
INSERT INTO vendors (
    name,
    vendor_code,
    contact_person,
    phone,
    email,
    gstin,
    notes,
    is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, TRUE
)
RETURNING *;

-- name: UpdateVendorMutableFields :one
UPDATE vendors
SET
    name = COALESCE(sqlc.narg('name')::text, name),
    contact_person = COALESCE(sqlc.narg('contact_person')::text, contact_person),
    phone = COALESCE(sqlc.narg('phone')::text, phone),
    email = COALESCE(sqlc.narg('email')::text, email),
    gstin = COALESCE(sqlc.narg('gstin')::text, gstin),
    notes = COALESCE(sqlc.narg('notes')::text, notes),
    is_active = COALESCE(sqlc.narg('is_active')::boolean, is_active),
    updated_at = NOW()
WHERE id = sqlc.arg('id')::uuid
RETURNING *;

-- name: GetVendorByID :one
SELECT *
FROM vendors
WHERE id = $1;

-- name: ListVendors :many
SELECT *
FROM vendors
WHERE
  (
    sqlc.arg('filter')::text = 'all'
    OR (sqlc.arg('filter')::text = 'active' AND is_active = true)
    OR (sqlc.arg('filter')::text = 'archived' AND is_active = false)
  )
  AND (
    sqlc.narg('search')::text IS NULL
    OR name ILIKE '%' || sqlc.narg('search')::text || '%'
    OR vendor_code ILIKE '%' || sqlc.narg('search')::text || '%'
  )
ORDER BY is_active DESC, LOWER(name) ASC;

-- name: GetVendorFinancialSummary :one
WITH payment_totals AS (
    SELECT
        p.po_id,
        COALESCE(SUM(p.amount), 0)::numeric AS total_paid
    FROM purchase_order_payments p
    GROUP BY p.po_id
),
batch_totals AS (
    SELECT
        b.parent_po_id AS po_id,
        COALESCE(
            SUM(
                CASE
                    WHEN b.status <> 'REVERSED'
                    THEN b.initial_qty * COALESCE(b.unit_cost, po.unit_price)
                    ELSE 0
                END
            ),
            0
        )::numeric AS received_value,
        COUNT(*) FILTER (WHERE b.status <> 'REVERSED')::int AS batch_count
    FROM inventory_batches b
    JOIN purchase_orders po ON po.id = b.parent_po_id
    WHERE b.parent_po_id IS NOT NULL
    GROUP BY b.parent_po_id
),
po_financials AS (
    SELECT
        po.id,
        po.vendor_id,
        CASE
            WHEN COALESCE(bt.batch_count, 0) > 0
            THEN COALESCE(bt.received_value, 0)
            ELSE (COALESCE(po.received_qty, 0) * COALESCE(po.unit_price, 0))
        END::numeric AS total_value,
        COALESCE(pt.total_paid, 0)::numeric AS total_paid
    FROM purchase_orders po
    LEFT JOIN batch_totals bt ON bt.po_id = po.id
    LEFT JOIN payment_totals pt ON pt.po_id = po.id
)
SELECT
    COALESCE(SUM(pof.total_value), 0)::numeric AS total_purchased,
    COALESCE(SUM(pof.total_paid), 0)::numeric AS total_paid,
    COALESCE(SUM(GREATEST(pof.total_value - pof.total_paid, 0)), 0)::numeric AS total_due
FROM po_financials pof
WHERE pof.vendor_id = $1::uuid;

-- name: GetVendorRecentPOs :many
SELECT
    id,
    po_number,
    created_at
FROM purchase_orders
WHERE vendor_id = $1
ORDER BY created_at DESC
LIMIT 10;

-- name: GetVendorRecentPayments :many
SELECT
    p.transaction_id,
    p.amount,
    p.payment_date,
    po.po_number
FROM purchase_order_payments p
JOIN purchase_orders po ON po.id = p.po_id
WHERE po.vendor_id = $1
ORDER BY p.payment_date DESC
LIMIT 10;
