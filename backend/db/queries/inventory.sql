-- name: CreateBatch :one
INSERT INTO inventory_batches (
    item_id, batch_code, initial_qty, remaining_qty, unit_cost, status
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
        ELSE status 
    END
WHERE id = $1
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

-- name: GetActiveBatchesByItem :many
SELECT id, batch_code, remaining_qty
FROM inventory_batches
WHERE item_id = $1 AND remaining_qty > 0
ORDER BY created_at ASC;

-- name: GetInventoryAggregated :many
SELECT i.category,
       i.id as item_id,
       i.name,
       i.specs,
       SUM(b.remaining_qty) as total_qty
FROM inventory_batches b
JOIN items i ON b.item_id = i.id
WHERE b.remaining_qty > 0
GROUP BY i.category, i.id, i.name, i.specs
ORDER BY i.category, i.name;