-- name: CreateBatch :one
INSERT INTO inventory_batches (
    item_id, batch_code, daily_sequence, initial_qty, remaining_qty, status
) VALUES (
    $1, $2, $3, $4, $5, 'ACTIVE'
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
SET reserved_qty = reserved_qty + sqlc.arg(qty),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND status = 'ACTIVE'::batch_status
    AND reserved_qty + sqlc.arg(qty) <= remaining_qty
RETURNING *;

-- name: ReleaseBatchReservation :one
UPDATE inventory_batches
SET reserved_qty = reserved_qty - sqlc.arg(qty),
    updated_at = NOW()
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND reserved_qty >= sqlc.arg(qty)
RETURNING *;

-- name: FinalizeBatchReservation :one
UPDATE inventory_batches
SET remaining_qty = remaining_qty - sqlc.arg(qty),
    reserved_qty = reserved_qty - sqlc.arg(qty),
    updated_at = NOW(),
    status = CASE
                WHEN remaining_qty - sqlc.arg(qty) <= 0 THEN 'EXHAUSTED'::batch_status
        ELSE status
    END
WHERE id = sqlc.arg(id)
    AND sqlc.arg(qty) > 0
    AND remaining_qty >= sqlc.arg(qty)
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

-- name: SetBatchStatus :one
UPDATE inventory_batches
SET status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetActiveBatchesByItem :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    GREATEST(b.remaining_qty - b.reserved_qty, 0)::numeric AS remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.item_id = $1
    AND b.remaining_qty > b.reserved_qty
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at ASC;

-- name: GetActiveBatchesByItemAndType :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    GREATEST(b.remaining_qty - b.reserved_qty, 0)::numeric AS remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.item_id = $1
    AND b.type = $2
    AND b.remaining_qty > b.reserved_qty
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at ASC;

-- name: GetActiveBatchesByType :many
SELECT
    b.id,
    b.batch_code,
    COALESCE(i.sku, '') AS sku,
    b.initial_qty,
    GREATEST(b.remaining_qty - b.reserved_qty, 0)::numeric AS remaining_qty,
    b.status,
    b.created_at
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.type = $1
    AND b.remaining_qty > b.reserved_qty
    AND b.status = 'ACTIVE'::batch_status
ORDER BY b.created_at ASC;

-- name: GetNextActiveBatch :one
SELECT
    b.id,
    b.item_id,
    b.batch_code,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.status,
    b.created_at
FROM inventory_batches b
WHERE b.item_id = $1
    AND b.status = 'ACTIVE'::batch_status
    AND b.remaining_qty > b.reserved_qty
ORDER BY b.created_at ASC, b.id ASC
LIMIT 1;

-- name: GetInventoryAggregated :many
SELECT i.category,
       i.id as item_id,
    i.sku,
       i.name,
       i.specs,
    SUM(b.remaining_qty) as total_qty,
    COALESCE(SUM(GREATEST(b.remaining_qty - b.reserved_qty, 0)) FILTER (WHERE b.status = 'ACTIVE'), 0) as available_qty,
    COALESCE(SUM(b.reserved_qty) FILTER (WHERE b.status = 'ACTIVE'), 0) as reserved_qty
FROM inventory_batches b
JOIN items i ON b.item_id = i.id
WHERE (b.remaining_qty > 0 OR b.reserved_qty > 0)
    AND (
        (i.category = 'RAW'::item_category AND b.type = 'RAW'::batch_type)
        OR (i.category = 'SEMI_FINISHED'::item_category AND b.type = 'MOLDED'::batch_type)
        OR (i.category = 'FINISHED'::item_category AND b.type = 'FINISHED'::batch_type)
        OR i.category = 'SCRAP'::item_category
    )
GROUP BY i.category, i.id, i.sku, i.name, i.specs
ORDER BY i.category, i.name;

-- name: GetRawMaterialMaster :many
SELECT
    i.id AS item_id,
    COALESCE(i.sku, '') AS sku,
    i.name,
    i.specs,
    i.low_stock_threshold,
    COALESCE(SUM(GREATEST(b.remaining_qty - b.reserved_qty, 0)) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS available_qty,
    COALESCE(SUM(b.reserved_qty) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS reserved_qty,
    COALESCE((
        SELECT SUM(GREATEST(po.ordered_qty - po.received_qty, 0))
        FROM purchase_orders po
        WHERE po.item_id = i.id
          AND po.status IN ('PENDING', 'PARTIAL')
    ), 0)::numeric AS pending_deliveries
FROM items i
LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.type = 'RAW'
WHERE i.category = 'RAW'::item_category AND i.is_active = true
GROUP BY i.id, i.sku, i.name, i.specs, i.low_stock_threshold
ORDER BY i.name;

-- name: GetRawMaterialSummary :one
SELECT
    i.id AS item_id,
    COALESCE(i.sku, '') AS sku,
    i.name,
    i.specs,
    i.low_stock_threshold,
    COALESCE(SUM(GREATEST(b.remaining_qty - b.reserved_qty, 0)) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS available_qty,
    COALESCE(SUM(b.reserved_qty) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS reserved_qty,
    COALESCE(SUM(b.remaining_qty) FILTER (WHERE b.status = 'HOLD'), 0)::numeric AS hold_qty,
    COALESCE((
        SELECT SUM(GREATEST(po.ordered_qty - po.received_qty, 0))
        FROM purchase_orders po
        WHERE po.item_id = i.id
          AND po.status IN ('PENDING', 'PARTIAL')
    ), 0)::numeric AS pending_deliveries
FROM items i
LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.type = 'RAW'
WHERE i.id = $1
    AND i.category = 'RAW'::item_category
    AND i.is_active = true
GROUP BY i.id, i.sku, i.name, i.specs, i.low_stock_threshold;

-- name: GetRawMaterialBatches :many
SELECT
    b.id,
    b.batch_code,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    GREATEST(b.remaining_qty - b.reserved_qty, 0)::numeric AS available_qty,
    b.status,
    b.created_at,
    b.parent_po_id,
    COALESCE(v.name, '') AS vendor_name,
    COALESCE(po.po_number, '') AS po_number
FROM inventory_batches b
LEFT JOIN purchase_orders po ON po.id = b.parent_po_id
LEFT JOIN vendors v ON v.id = po.vendor_id
WHERE b.item_id = $1
    AND b.type = 'RAW'
ORDER BY b.created_at ASC;

-- name: GetFinishedGoodsMaster :many
SELECT
    i.id AS item_id,
    COALESCE(i.sku, '') AS sku,
    i.name,
    i.diameter,
    i.low_stock_threshold,
    COALESCE(SUM(GREATEST(b.remaining_qty - b.reserved_qty, 0)) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS available_qty,
    COALESCE(SUM(b.reserved_qty) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS reserved_qty
FROM items i
LEFT JOIN inventory_batches b
    ON b.item_id = i.id
   AND b.type = 'FINISHED'
WHERE i.category = 'FINISHED'::item_category
  AND i.is_active = true
GROUP BY i.id, i.sku, i.name, i.diameter, i.low_stock_threshold
ORDER BY i.name;

-- name: GetFinishedGoodSummary :one
SELECT
    i.id AS item_id,
    COALESCE(i.sku, '') AS sku,
    i.name,
    i.diameter,
    i.low_stock_threshold,
    i.linked_raw_material_id,
    COALESCE(raw.sku, '') AS linked_raw_material_sku,
    COALESCE(raw.name, '') AS linked_raw_material_name,
    raw.specs AS linked_raw_material_specs,
    COALESCE(SUM(b.remaining_qty), 0)::numeric AS total_qty,
    COALESCE(SUM(GREATEST(b.remaining_qty - b.reserved_qty, 0)) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS available_qty,
    COALESCE(SUM(b.reserved_qty) FILTER (WHERE b.status = 'ACTIVE'), 0)::numeric AS reserved_qty,
    COALESCE(SUM(b.remaining_qty) FILTER (WHERE b.status = 'HOLD'), 0)::numeric AS hold_qty,
    COUNT(b.id) FILTER (WHERE b.status = 'ACTIVE'::batch_status)::int AS batch_count
FROM items i
LEFT JOIN items raw ON raw.id = i.linked_raw_material_id
LEFT JOIN inventory_batches b
    ON b.item_id = i.id
   AND b.type = 'FINISHED'
WHERE i.id = $1
  AND i.category = 'FINISHED'::item_category
  AND i.is_active = true
GROUP BY
    i.id,
    i.sku,
    i.name,
    i.diameter,
    i.low_stock_threshold,
    i.linked_raw_material_id,
    raw.sku,
    raw.name,
    raw.specs;

-- name: GetFinishedGoodBatches :many
SELECT
    b.id,
    b.batch_code,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    GREATEST(b.remaining_qty - b.reserved_qty, 0)::numeric AS available_qty,
    b.status,
    b.created_at,
    b.parent_batch_id,
    COALESCE(parent.batch_code, '') AS source_molded_batch_code
FROM inventory_batches b
LEFT JOIN inventory_batches parent ON parent.id = b.parent_batch_id
WHERE b.item_id = $1
  AND b.type = 'FINISHED'
ORDER BY b.created_at DESC, b.batch_code DESC;

-- name: GetFinishedGoodRecentPolishingOutput :many
SELECT
    pr.id AS journal_id,
    pr.created_at,
    MIN(fb.id::text)::uuid AS finished_batch_id,
    COALESCE(MIN(fb.batch_code), '')::text AS finished_batch_code,
    MIN(mb.id::text)::uuid AS source_molded_batch_id,
    COALESCE(STRING_AGG(DISTINCT mb.batch_code, ', ' ORDER BY mb.batch_code), '')::text AS source_molded_batch_code,
    pr.output_qty AS finished_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    COALESCE(u.name, '') AS operator_name
FROM production_runs pr
JOIN batch_consumptions bc ON bc.production_run_id = pr.id
JOIN inventory_batches fb ON fb.id = bc.target_batch_id
JOIN inventory_batches mb ON mb.id = bc.source_batch_id
LEFT JOIN users u ON u.id = pr.operator_id
WHERE pr.output_item_id = $1
  AND fb.type = 'FINISHED'
GROUP BY
        pr.id,
        pr.created_at,
        pr.output_qty,
        pr.scrap_qty,
        pr.shortlength_qty,
        pr.process_loss_qty,
        u.name
ORDER BY pr.created_at DESC
LIMIT sqlc.arg(page_limit);

-- name: GetFinishedGoodSourceMoldedBatches :many
SELECT
    mb.id,
    mb.batch_code,
    mb.created_at,
    mb.status,
    GREATEST(mb.remaining_qty - mb.reserved_qty, 0)::numeric AS available_qty,
    COALESCE(SUM(pr.output_qty), 0)::numeric AS produced_qty,
    MAX(pr.created_at)::timestamptz AS latest_polished_at
FROM inventory_batches fb
JOIN batch_consumptions bc ON bc.target_batch_id = fb.id
JOIN inventory_batches mb ON mb.id = bc.source_batch_id
JOIN production_runs pr ON pr.id = bc.production_run_id
WHERE fb.item_id = $1
  AND fb.type = 'FINISHED'
GROUP BY mb.id, mb.batch_code, mb.created_at, mb.status, mb.remaining_qty, mb.reserved_qty
ORDER BY latest_polished_at DESC, mb.batch_code DESC;

-- name: GetFinishedGoodSourceRawBatches :many
WITH source_molded AS (
    SELECT DISTINCT bc.source_batch_id AS molded_batch_id
    FROM inventory_batches fb
    JOIN batch_consumptions bc ON bc.target_batch_id = fb.id
    WHERE fb.item_id = $1
      AND fb.type = 'FINISHED'
)
SELECT
    rb.id,
    rb.batch_code,
    rb.created_at,
    rb.status,
    GREATEST(rb.remaining_qty - rb.reserved_qty, 0)::numeric AS available_qty,
    COALESCE(v.name, '') AS vendor_name,
    COALESCE(po.po_number, '') AS po_number,
    MAX(molding_pr.created_at)::timestamptz AS latest_used_at
FROM source_molded sm
JOIN batch_consumptions bc_molding ON bc_molding.target_batch_id = sm.molded_batch_id
JOIN inventory_batches rb ON rb.id = bc_molding.source_batch_id
JOIN production_runs molding_pr ON molding_pr.id = bc_molding.production_run_id
LEFT JOIN purchase_orders po ON po.id = rb.parent_po_id
LEFT JOIN vendors v ON v.id = po.vendor_id
GROUP BY rb.id, rb.batch_code, rb.created_at, rb.status, rb.remaining_qty, rb.reserved_qty, v.name, po.po_number
ORDER BY latest_used_at DESC, rb.batch_code DESC;


-- =============================================================================
-- BATCH TRACEABILITY QUERIES
-- =============================================================================

-- name: GetBatchByCode :one
SELECT
    b.id,
    b.batch_code,
    b.item_id,
    b.type,
    b.status,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.parent_batch_id,
    b.created_at,
    COALESCE(i.name, '') AS item_name,
    COALESCE(i.sku, '') AS item_sku,
    i.category AS item_category
FROM inventory_batches b
JOIN items i ON i.id = b.item_id
WHERE b.batch_code = $1
LIMIT 1;

-- name: GetBatchProductionRun :one
-- Gets the production run that CREATED this batch (target_batch_id = this batch).
SELECT
    pr.id AS production_run_id,
    pr.run_sequence,
    pr.input_qty,
    pr.output_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    pr.status,
    pr.workstation,
    pr.notes,
    pr.created_at,
    COALESCE(u.name, '') AS operator_name,
    i.category AS output_item_category
FROM batch_consumptions bc
JOIN production_runs pr ON pr.id = bc.production_run_id
JOIN items i ON i.id = pr.output_item_id
LEFT JOIN users u ON u.id = pr.operator_id
WHERE bc.target_batch_id = $1
LIMIT 1;

-- name: GetBatchUpstreamLineage :many
-- Returns the FULL upstream chain for a batch:
-- For a FINISHED batch: FINISHED -> MOLDED -> RAW
-- For a MOLDED batch: MOLDED -> RAW
-- Each row = one upstream batch with its consumption details.
WITH RECURSIVE lineage AS (
    -- Anchor: direct sources of the target batch
    SELECT
        bc.source_batch_id,
        bc.target_batch_id,
        bc.quantity_consumed,
        1 AS depth
    FROM batch_consumptions bc
    WHERE bc.target_batch_id = $1

    UNION ALL

    -- Recurse: sources of sources
    SELECT
        bc2.source_batch_id,
        bc2.target_batch_id,
        bc2.quantity_consumed,
        l.depth + 1
    FROM lineage l
    JOIN batch_consumptions bc2 ON bc2.target_batch_id = l.source_batch_id
    WHERE l.depth < 5
)
SELECT
    b.id,
    b.batch_code,
    b.type,
    b.status,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.created_at,
    l.quantity_consumed,
    l.depth,
    COALESCE(i.name, '') AS item_name,
    COALESCE(i.sku, '') AS item_sku,
    b.parent_po_id
FROM lineage l
JOIN inventory_batches b ON b.id = l.source_batch_id
JOIN items i ON i.id = b.item_id
ORDER BY l.depth ASC, b.created_at ASC;

-- name: GetBatchConsumptionEvents :many
-- Returns all consumption events where this batch was the SOURCE.
SELECT
    bc.id,
    bc.production_run_id,
    src.batch_code AS source_batch_code,
    src.type AS source_batch_type,
    COALESCE(tgt.batch_code, '') AS target_batch_code,
    COALESCE(tgt.type::text, '') AS target_batch_type,
    bc.quantity_consumed,
    bc.batch_remaining_before,
    bc.batch_remaining_after,
    bc.created_at
FROM batch_consumptions bc
JOIN inventory_batches src ON src.id = bc.source_batch_id
LEFT JOIN inventory_batches tgt ON tgt.id = bc.target_batch_id
WHERE bc.source_batch_id = $1
   OR bc.target_batch_id = $1
ORDER BY bc.created_at ASC;

-- name: GetBatchVendorInfo :one
-- Gets vendor traceability for a RAW batch via its parent_po_id.
SELECT
    COALESCE(v.name, '') AS vendor_name,
    COALESCE(po.po_number, '') AS po_number,
    po.created_at AS procurement_date,
    b.batch_code AS raw_batch_code
FROM inventory_batches b
LEFT JOIN purchase_orders po ON po.id = b.parent_po_id
LEFT JOIN vendors v ON v.id = po.vendor_id
WHERE b.id = $1;
