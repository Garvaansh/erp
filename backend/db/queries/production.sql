-- name: CreateJournal :one
INSERT INTO production_journals (
    movement_group_id,
    source_batch_id,
    input_qty,
    finished_qty,
    scrap_qty,
    loss_reason,
    created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING id;

-- name: GetJournalByMovementGroup :one
SELECT * FROM production_journals
WHERE movement_group_id = $1
LIMIT 1;

-- name: CreateWIPJournal :one
INSERT INTO production_journals (
    movement_group_id,
    source_batch_id,
    input_qty,
    finished_qty,
    scrap_qty,
    shortlength_qty,
    process_loss_qty,
    loss_reason,
    status,
    diameter,
    note,
    created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
RETURNING *;

-- name: GetJournalByIDForUpdate :one
SELECT * FROM production_journals
WHERE id = $1
FOR UPDATE;

-- name: ApproveJournal :one
UPDATE production_journals
SET status = 'FINAL',
        approved_by = sqlc.arg(approved_by),
    approved_at = NOW(),
        note = COALESCE(NULLIF(sqlc.arg(approval_note), ''), note)
WHERE id = sqlc.arg(id)
  AND status = 'PENDING_APPROVAL'
RETURNING *;

-- name: RejectJournal :one
UPDATE production_journals
SET status = 'REJECTED',
        approved_by = sqlc.arg(rejected_by),
        approved_at = NOW(),
        note = COALESCE(NULLIF(sqlc.arg(rejection_note), ''), note)
WHERE id = sqlc.arg(id)
    AND status = 'PENDING_APPROVAL'
RETURNING *;

-- name: ListPendingApprovals :many
SELECT
    j.*, 
    b.batch_code,
    b.type AS source_batch_type
FROM production_journals j
JOIN inventory_batches b ON b.id = j.source_batch_id
WHERE j.status = 'PENDING_APPROVAL'
ORDER BY j.created_at DESC
LIMIT sqlc.arg(page_limit)
OFFSET sqlc.arg(page_offset);

-- name: ListWIPActivityEntries :many
SELECT
    j.id,
    j.created_at,
    b.batch_code,
    COALESCE(i.sku, '') AS item_sku,
    i.name AS item_name,
    b.type AS source_batch_type,
    j.input_qty,
    j.finished_qty,
    j.scrap_qty,
    j.shortlength_qty,
    j.process_loss_qty,
    j.status,
    COALESCE(u.name, '') AS operator_name
FROM production_journals j
JOIN inventory_batches b ON b.id = j.source_batch_id
JOIN items i ON i.id = b.item_id
LEFT JOIN users u ON u.id = j.created_by
WHERE j.created_at >= sqlc.arg(from_ts)
    AND j.created_at < sqlc.arg(to_ts)
ORDER BY j.created_at DESC
LIMIT sqlc.arg(page_limit)
OFFSET sqlc.arg(page_offset);
