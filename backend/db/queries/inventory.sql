-- name: CreateBatch :one
INSERT INTO inventory_batches (
    item_id, batch_code, daily_sequence, initial_qty, remaining_qty, status
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetBatch :one
SELECT * FROM inventory_batches
WHERE id = $1 LIMIT 1;

-- name: GetBatchForUpdate :one
SELECT * FROM inventory_batches
WHERE id = $1
FOR UPDATE;

-- name: UpdateBatchQuantity :one
UPDATE inventory_batches
SET remaining_qty = remaining_qty + $2, 
    updated_at = NOW(),
    status = CASE 
        WHEN remaining_qty + $2 <= 0 THEN 'EXHAUSTED'::batch_status 
        WHEN remaining_qty + $2 < initial_qty THEN 'ACTIVE'::batch_status
        ELSE status
    END
WHERE id = $1
RETURNING *;

-- name: ReserveBatchStock :one
UPDATE inventory_batches
SET remaining_qty = remaining_qty - sqlc.arg(qty),
        reserved_qty = reserved_qty + sqlc.arg(qty),
    updated_at = NOW(),
    status = CASE
                WHEN remaining_qty - sqlc.arg(qty) <= 0 AND reserved_qty + sqlc.arg(qty) > 0 THEN 'HOLD'::batch_status
                WHEN remaining_qty - sqlc.arg(qty) <= 0 THEN 'EXHAUSTED'::batch_status
                WHEN remaining_qty - sqlc.arg(qty) < initial_qty THEN 'ACTIVE'::batch_status
        ELSE status
    END
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND remaining_qty >= sqlc.arg(qty)
RETURNING *;

-- name: ReleaseBatchReservation :one
UPDATE inventory_batches
SET remaining_qty = remaining_qty + sqlc.arg(qty),
        reserved_qty = reserved_qty - sqlc.arg(qty),
    updated_at = NOW(),
    status = CASE
                WHEN remaining_qty + sqlc.arg(qty) <= 0 AND reserved_qty - sqlc.arg(qty) > 0 THEN 'HOLD'::batch_status
                WHEN remaining_qty + sqlc.arg(qty) <= 0 THEN 'EXHAUSTED'::batch_status
                WHEN remaining_qty + sqlc.arg(qty) < initial_qty THEN 'ACTIVE'::batch_status
        ELSE status
    END
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND reserved_qty >= sqlc.arg(qty)
RETURNING *;

-- name: FinalizeBatchReservation :one
UPDATE inventory_batches
SET reserved_qty = reserved_qty - sqlc.arg(qty),
    updated_at = NOW(),
    status = CASE
                WHEN remaining_qty <= 0 AND reserved_qty - sqlc.arg(qty) <= 0 THEN 'EXHAUSTED'::batch_status
                WHEN reserved_qty - sqlc.arg(qty) > 0 THEN 'HOLD'::batch_status
        WHEN remaining_qty < initial_qty THEN 'ACTIVE'::batch_status
        ELSE status
    END
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND reserved_qty >= sqlc.arg(qty)
RETURNING *;

-- name: CreateDerivedBatch :one
INSERT INTO inventory_batches (
    item_id,
    batch_code,
    daily_sequence,
    initial_qty,
    remaining_qty,
    reserved_qty,
    status,
    type,
    diameter,
    parent_batch_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: RecordTransaction :one
INSERT INTO inventory_transactions (
    movement_group_id, item_id, batch_id, direction, 
    quantity, reference_type, reference_id, performed_by, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: ListTransactionsByBatch :many
SELECT * FROM inventory_transactions
WHERE batch_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetTransactionByMovementGroup :one
SELECT * FROM inventory_transactions
WHERE movement_group_id = $1
ORDER BY created_at ASC
LIMIT 1;

-- name: GetProcurementReceiptTransactionForUpdate :one
SELECT * FROM inventory_transactions
WHERE id = $1
    AND reference_type = 'PURCHASE_ORDER'
    AND direction = 'IN'
FOR UPDATE;

-- name: ExhaustBatchByID :one
UPDATE inventory_batches
SET remaining_qty = 0,
        status = 'EXHAUSTED',
        updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetActiveBatchesByItem :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    b.remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.item_id = $1
    AND b.remaining_qty > 0
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at DESC;

-- name: GetActiveBatchesByItemAndType :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    b.remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.item_id = $1
    AND b.type = $2
    AND b.remaining_qty > 0
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at DESC;

-- name: GetActiveBatchesByType :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    b.remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.type = $1
    AND b.remaining_qty > 0
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at DESC;

-- name: GetInventoryAggregated :many
SELECT i.category,
       i.id as item_id,
    i.sku,
       i.name,
       i.specs,
    SUM(b.remaining_qty + b.reserved_qty) as total_qty,
    SUM(b.remaining_qty) as available_qty,
    SUM(b.reserved_qty) as reserved_qty
FROM inventory_batches b
JOIN items i ON b.item_id = i.id
WHERE b.remaining_qty > 0 OR b.reserved_qty > 0
GROUP BY i.category, i.id, i.sku, i.name, i.specs
ORDER BY i.category, i.name;