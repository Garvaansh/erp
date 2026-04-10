-- name: DraftPurchaseOrder :one
INSERT INTO purchase_orders (
    po_number,
    vendor_name,
    item_id,
    ordered_qty,
    unit_price,
    status,
    created_by
) VALUES (
    $1, $2, $3, $4, $5, 'PENDING', $6
)
RETURNING *;

-- name: GetPurchaseOrderForUpdate :one
SELECT
    po.id,
    po.po_number,
    po.vendor_name,
    po.item_id,
    po.ordered_qty,
    po.unit_price,
    po.status,
    po.created_by,
    po.created_at,
    po.updated_at
FROM purchase_orders po
WHERE po.id = $1
FOR UPDATE;

-- name: MarkPurchaseOrderDelivered :one
UPDATE purchase_orders
SET status = 'DELIVERED',
    updated_at = NOW()
WHERE id = $1
  AND status = 'PENDING'
RETURNING *;

-- name: MarkPurchaseOrderPending :one
UPDATE purchase_orders
SET status = 'PENDING',
        updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListPendingProcurementOrders :many
SELECT
    po.id,
    po.po_number,
    po.vendor_name,
    po.ordered_qty,
    i.name AS item_name,
    i.sku
FROM purchase_orders po
JOIN items i ON i.id = po.item_id
WHERE po.status = 'PENDING'
ORDER BY po.created_at ASC;

-- name: ListProcurementOrders :many
SELECT
    po.id,
    po.po_number,
    po.vendor_name,
    po.item_id,
    i.name AS item_name,
    i.sku,
    po.ordered_qty,
    po.unit_price,
    po.status,
    po.created_at,
    COALESCE(SUM(
        CASE
            WHEN t.direction = 'IN' THEN t.quantity::numeric
            WHEN t.direction = 'OUT' THEN (t.quantity * -1)::numeric
            ELSE 0::numeric
        END
    ), 0::numeric)::numeric AS received_qty
FROM purchase_orders po
JOIN items i ON i.id = po.item_id
LEFT JOIN inventory_transactions t
    ON t.reference_type = 'PURCHASE_ORDER'
   AND t.reference_id = po.id
GROUP BY po.id, i.name, i.sku
ORDER BY po.created_at DESC;

-- name: GetProcurementOrderDetails :one
SELECT
    po.id,
    po.po_number,
    po.vendor_name,
    po.item_id,
    i.name AS item_name,
    i.sku,
    po.ordered_qty,
    po.unit_price,
    po.status,
    po.created_at,
    COALESCE(SUM(
        CASE
            WHEN t.direction = 'IN' THEN t.quantity::numeric
            WHEN t.direction = 'OUT' THEN (t.quantity * -1)::numeric
            ELSE 0::numeric
        END
    ), 0::numeric)::numeric AS received_qty
FROM purchase_orders po
JOIN items i ON i.id = po.item_id
LEFT JOIN inventory_transactions t
    ON t.reference_type = 'PURCHASE_ORDER'
   AND t.reference_id = po.id
WHERE po.id = $1
GROUP BY po.id, i.name, i.sku;

-- name: ListProcurementBatchesByOrder :many
SELECT
    b.id AS batch_id,
    b.batch_code,
    b.initial_qty,
    b.remaining_qty,
    t.id AS transaction_id,
    t.created_at AS received_at
FROM inventory_transactions t
JOIN inventory_batches b ON b.id = t.batch_id
WHERE t.reference_type = 'PURCHASE_ORDER'
  AND t.reference_id = $1
  AND t.direction = 'IN'
ORDER BY t.created_at DESC;
