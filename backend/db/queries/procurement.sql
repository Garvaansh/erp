-- name: CreatePurchaseOrder :one
INSERT INTO purchase_orders (
    po_number,
    transaction_id,
    vendor_id,
    vendor_name,
    item_id,
    ordered_qty,
    unit_price,
    received_qty,
    vendor_invoice_ref,
    notes,
    status,
    created_by
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12
)
RETURNING *;

-- name: GetPurchaseOrderByID :one
SELECT *
FROM purchase_orders
WHERE id = $1
LIMIT 1;

-- name: GetPurchaseOrderByIDForUpdate :one
SELECT *
FROM purchase_orders
WHERE id = $1
FOR UPDATE;

-- name: UpdatePurchaseOrder :one
UPDATE purchase_orders
SET
    item_id = $2,
    ordered_qty = $3,
    unit_price = $4,
    received_qty = $5,
    vendor_invoice_ref = $6,
    notes = $7,
    status = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: InsertPurchaseOrderLog :one
INSERT INTO purchase_order_logs (
    po_id,
    user_id,
    action,
    note
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING *;

-- name: CreateInventoryBatch :one
INSERT INTO inventory_batches (
    item_id,
    batch_code,
    daily_sequence,
    initial_qty,
    remaining_qty,
    reserved_qty,
    unit_cost,
    parent_po_id,
    status,
    type
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    'RAW'
)
RETURNING *;

-- name: UpdateInventoryBatchStatus :one
UPDATE inventory_batches
SET
    status = $2,
    remaining_qty = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetBatchByID :one
SELECT *
FROM inventory_batches
WHERE id = $1
LIMIT 1;

-- name: CreateInventoryTransaction :one
INSERT INTO inventory_transactions (
    movement_group_id,
    item_id,
    batch_id,
    direction,
    quantity,
    reference_type,
    reference_id,
    performed_by,
    notes
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
)
RETURNING *;

-- name: GetProcurementList :many
SELECT
    po.id,
    po.po_number,
    po.transaction_id,
    po.vendor_id,
    v.vendor_code,
    COALESCE(v.name, '') AS vendor_name,
    po.item_id,
    i.name AS item_name,
    i.sku,
    po.ordered_qty,
    po.received_qty,
    po.unit_price,
    po.vendor_invoice_ref,
    po.status,
    po.created_at,
    po.updated_at,
    COALESCE(l.action, '') AS last_action,
    l.created_at AS last_action_at
FROM purchase_orders po
JOIN items i ON i.id = po.item_id
JOIN vendors v ON v.id = po.vendor_id
LEFT JOIN LATERAL (
    SELECT action, created_at
    FROM purchase_order_logs
    WHERE po_id = po.id
    ORDER BY created_at DESC
    LIMIT 1
) l ON TRUE
WHERE po.status = 'PENDING'
   OR po.status = 'PARTIAL'
   OR (
        po.status IN ('COMPLETED', 'CLOSED')
        AND po.updated_at >= NOW() - INTERVAL '7 days'
   )
ORDER BY
    CASE WHEN po.status IN ('PENDING', 'PARTIAL') THEN 0 ELSE 1 END,
    po.updated_at DESC,
    po.po_number DESC
LIMIT $1 OFFSET $2;

-- name: GetProcurementDetail :one
SELECT
    po.id,
    po.po_number,
    po.transaction_id,
    po.vendor_id,
    v.vendor_code,
    COALESCE(v.name, '') AS vendor_name,
    COALESCE(v.contact_person, '') AS vendor_contact_person,
    COALESCE(v.phone, '') AS vendor_phone,
    po.item_id,
    i.name AS item_name,
    i.sku,
    po.ordered_qty,
    po.received_qty,
    po.unit_price,
    po.vendor_invoice_ref,
    po.notes,
    po.status,
    po.created_by,
    po.created_at,
    po.updated_at,
    COALESCE(batch_stats.total_batches, 0)::int AS total_batches,
    COALESCE(batch_stats.active_batches, 0)::int AS active_batches,
    COALESCE(batch_stats.reversed_batches, 0)::int AS reversed_batches,
    COALESCE(last_log.action, '') AS last_action,
    last_log.note AS last_log_note,
    last_log.created_at AS last_action_at
FROM purchase_orders po
JOIN items i ON i.id = po.item_id
JOIN vendors v ON v.id = po.vendor_id
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_batches,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_batches,
        COUNT(*) FILTER (WHERE status = 'REVERSED') AS reversed_batches
    FROM inventory_batches
    WHERE parent_po_id = po.id
) batch_stats ON TRUE
LEFT JOIN LATERAL (
    SELECT action, note, created_at
    FROM purchase_order_logs
    WHERE po_id = po.id
    ORDER BY created_at DESC
    LIMIT 1
) last_log ON TRUE
WHERE po.id = $1;
