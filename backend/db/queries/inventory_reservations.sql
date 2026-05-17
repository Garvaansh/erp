-- name: GetReservableFinishedBatchesForUpdate :many
SELECT
    b.id,
    b.item_id,
    b.batch_code,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.status,
    b.created_at,
    b.updated_at
FROM inventory_batches b
WHERE b.item_id = sqlc.arg(item_id)
  AND b.type = 'FINISHED'::batch_type
  AND b.status = 'ACTIVE'::batch_status
  AND b.remaining_qty > b.reserved_qty
ORDER BY b.created_at ASC, b.id ASC
FOR UPDATE;

-- name: IncrementBatchReservedQty :one
UPDATE inventory_batches
SET
    reserved_qty = reserved_qty + sqlc.arg(qty),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND type = 'FINISHED'::batch_type
  AND status = 'ACTIVE'::batch_status
  AND sqlc.arg(qty) > 0
  AND reserved_qty + sqlc.arg(qty) <= remaining_qty
RETURNING *;

-- name: DecrementBatchReservedQty :one
UPDATE inventory_batches
SET
    reserved_qty = reserved_qty - sqlc.arg(qty),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND type = 'FINISHED'::batch_type
  AND sqlc.arg(qty) > 0
  AND reserved_qty >= sqlc.arg(qty)
RETURNING *;

-- name: DeductBatchRemainingQty :one
UPDATE inventory_batches
SET
    remaining_qty = remaining_qty - sqlc.arg(qty),
    status = CASE
        WHEN remaining_qty - sqlc.arg(qty) <= 0 THEN 'EXHAUSTED'::batch_status
        ELSE status
    END,
    updated_at = NOW()
WHERE id = sqlc.arg(id)
  AND type = 'FINISHED'::batch_type
  AND status = 'ACTIVE'::batch_status
  AND sqlc.arg(qty) > 0
  AND remaining_qty >= sqlc.arg(qty)
RETURNING *;
