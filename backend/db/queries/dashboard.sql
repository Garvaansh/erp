-- name: GetTotalRawMaterialWeight :one
SELECT COALESCE(SUM(b.remaining_qty), 0)::numeric AS total_weight
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE i.category = 'RAW'::item_category;

-- name: GetTotalFinishedPipesWeight :one
SELECT COALESCE(SUM(b.remaining_qty), 0)::numeric AS total_weight
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE i.category = 'FINISHED'::item_category;

-- name: GetRecentActivity :many
SELECT
    j.id,
    j.created_at,
    u.name AS worker_name,
    b.batch_code,
    j.input_qty,
    j.finished_qty,
    j.scrap_qty
FROM production_journals j
JOIN users u ON u.id = j.created_by
JOIN inventory_batches b ON b.id = j.source_batch_id
ORDER BY j.created_at DESC
LIMIT 5;
