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
