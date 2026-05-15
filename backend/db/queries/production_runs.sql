-- =============================================================================
-- SECTION 1 — FIFO BATCH ALLOCATION
-- =============================================================================

-- name: GetFIFOBatchesForUpdate :many
-- Returns all allocatable ACTIVE batches for a given item in strict FIFO order.
-- Caller MUST be inside a transaction. FOR UPDATE prevents phantom reads
-- and concurrent double-allocation during FIFO deduction.
SELECT
    b.id,
    b.item_id,
    b.batch_code,
    b.type,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.status,
    b.created_at
FROM inventory_batches b
WHERE b.item_id    = sqlc.arg(item_id)
  AND b.status     = 'ACTIVE'::batch_status
  AND b.remaining_qty > 0
ORDER BY b.created_at ASC, b.id ASC
FOR UPDATE;

-- name: DeductBatchForProduction :one
-- Deducts qty_to_deduct from remaining_qty in a single atomic operation.
-- PostgreSQL computes the new remaining — the caller never passes a pre-calculated value.
-- Auto-exhausts the batch when remaining_qty reaches zero after deduction.
--
-- WHY remaining_qty > 0 instead of remaining_qty >= qty_to_deduct:
-- The FIFO allocation loop intentionally does PARTIAL consumption. When a batch
-- has less than needed (e.g. 50kg available, 100kg needed), the loop already
-- computes actual_deduct = MIN(needed, remaining). Enforcing >= qty_to_deduct
-- would cause 0 rows returned mid-allocation, silently breaking the loop.
-- The FOR UPDATE lock on GetFIFOBatchesForUpdate already guarantees no concurrent
-- modification. remaining_qty > 0 is the correct guard here.
UPDATE inventory_batches
SET
    remaining_qty = remaining_qty - sqlc.arg(qty_to_deduct),
    status = CASE
                 WHEN remaining_qty - sqlc.arg(qty_to_deduct)::numeric(18,4) <= 0
                     THEN 'EXHAUSTED'::batch_status
                 ELSE status
             END,
    updated_at = NOW()
WHERE id            = sqlc.arg(id)
  AND status        = 'ACTIVE'::batch_status
  AND remaining_qty > 0
RETURNING
    id,
    batch_code,
    remaining_qty,
    status,
    updated_at;


-- =============================================================================
-- SECTION 2 — PRODUCTION RUNS
-- =============================================================================

-- name: CreateProductionRun :one
INSERT INTO production_runs (
    output_item_id,
    operator_id,
    workstation,
    input_qty,
    output_qty,
    scrap_qty,
    shortlength_qty,
    process_loss_qty,
    status,
    notes
) VALUES (
    sqlc.arg(output_item_id),
    sqlc.narg(operator_id),
    sqlc.narg(workstation),
    sqlc.arg(input_qty),
    sqlc.arg(output_qty),
    sqlc.arg(scrap_qty),
    sqlc.arg(shortlength_qty),
    sqlc.arg(process_loss_qty),
    sqlc.arg(status),
    sqlc.narg(notes)
)
RETURNING
    id,
    run_sequence,
    output_item_id,
    operator_id,
    workstation,
    input_qty,
    output_qty,
    scrap_qty,
    shortlength_qty,
    process_loss_qty,
    status,
    notes,
    created_at,
    updated_at;

-- name: GetProductionRunByID :one
SELECT
    pr.id,
    pr.run_sequence,
    pr.output_item_id,
    COALESCE(i.sku, '')     AS output_item_sku,
    i.name                  AS output_item_name,
    pr.operator_id,
    COALESCE(u.name, '')    AS operator_name,
    pr.workstation,
    pr.input_qty,
    pr.output_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    pr.status,
    pr.notes,
    pr.created_at,
    pr.updated_at,
    i.category              AS output_item_category
FROM production_runs pr
JOIN items i        ON i.id = pr.output_item_id
LEFT JOIN users u   ON u.id = pr.operator_id
WHERE pr.id = sqlc.arg(id)
LIMIT 1;

-- name: ListProductionRuns :many
-- Newest first. Offset-based pagination (limit + offset). Switch to cursor
-- pagination when production history volumes grow large.
-- Optionally filter by output_item_id (pass NULL to list all).
SELECT
    pr.id,
    pr.run_sequence,
    pr.output_item_id,
    COALESCE(i.sku, '')     AS output_item_sku,
    i.name                  AS output_item_name,
    pr.operator_id,
    COALESCE(u.name, '')    AS operator_name,
    pr.workstation,
    pr.input_qty,
    pr.output_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    pr.status,
    pr.created_at,
    i.category              AS output_item_category
FROM production_runs pr
JOIN items i        ON i.id = pr.output_item_id
LEFT JOIN users u   ON u.id = pr.operator_id
WHERE (sqlc.narg(output_item_id)::uuid IS NULL OR pr.output_item_id = sqlc.narg(output_item_id)::uuid)
ORDER BY pr.created_at DESC, pr.run_sequence DESC
LIMIT  sqlc.arg(page_limit)
OFFSET sqlc.arg(page_offset);


-- =============================================================================
-- SECTION 3 — BATCH LINEAGE
-- =============================================================================

-- name: CreateBatchConsumption :one
INSERT INTO batch_consumptions (
    production_run_id,
    source_batch_id,
    target_batch_id,
    quantity_consumed,
    batch_remaining_before,
    batch_remaining_after
) VALUES (
    sqlc.arg(production_run_id),
    sqlc.arg(source_batch_id),
    sqlc.narg(target_batch_id),
    sqlc.arg(quantity_consumed),
    sqlc.arg(batch_remaining_before),
    sqlc.arg(batch_remaining_after)
)
RETURNING
    id,
    production_run_id,
    source_batch_id,
    target_batch_id,
    quantity_consumed,
    batch_remaining_before,
    batch_remaining_after,
    created_at;

-- name: GetBatchLineageByTargetBatch :many
-- Reverse traceability: finished/molded batch → all source raw batches consumed.
-- Hits idx_batch_consumptions_lineage (target_batch_id, source_batch_id).
SELECT
    bc.id,
    bc.production_run_id,
    bc.source_batch_id,
    src.batch_code              AS source_batch_code,
    src.type                    AS source_batch_type,
    src.status                  AS source_batch_status,
    bc.target_batch_id,
    bc.quantity_consumed,
    bc.batch_remaining_before,
    bc.batch_remaining_after,
    bc.created_at
FROM batch_consumptions bc
JOIN inventory_batches src ON src.id = bc.source_batch_id
WHERE bc.target_batch_id = sqlc.arg(target_batch_id)
ORDER BY bc.created_at ASC;

-- name: GetBatchConsumersBySourceBatch :many
-- Forward traceability: raw batch → all downstream production runs and output batches.
-- Hits idx_batch_consumptions_source_batch_id.
SELECT
    bc.id,
    bc.production_run_id,
    pr.run_sequence,
    pr.workstation,
    pr.status                   AS production_run_status,
    bc.source_batch_id,
    bc.target_batch_id,
    tgt.batch_code              AS target_batch_code,
    tgt.type                    AS target_batch_type,
    bc.quantity_consumed,
    bc.batch_remaining_before,
    bc.batch_remaining_after,
    bc.created_at
FROM batch_consumptions bc
JOIN production_runs pr             ON pr.id  = bc.production_run_id
LEFT JOIN inventory_batches tgt     ON tgt.id = bc.target_batch_id
WHERE bc.source_batch_id = sqlc.arg(source_batch_id)
ORDER BY bc.created_at ASC;

-- name: CreateProducedBatch :one
-- Creates the output inventory batch from a production run (molded or finished).
-- Use this instead of CreateDerivedBatch for WIP flows: named args (not positional
-- $n), explicit RETURNING columns, and parent_batch_id for optional quick-reference
-- to the immediate upstream batch. Full many-to-many lineage is stored separately
-- in batch_consumptions — parent_batch_id here is convenience only.
-- NOTE: diameter is intentionally excluded — specification belongs to item, not batch.
INSERT INTO inventory_batches (
    item_id,
    batch_code,
    daily_sequence,
    initial_qty,
    remaining_qty,
    reserved_qty,
    status,
    type,
    parent_batch_id,
    unit_cost
) VALUES (
    sqlc.arg(item_id),
    sqlc.arg(batch_code),
    sqlc.arg(daily_sequence),
    sqlc.arg(initial_qty),
    sqlc.arg(initial_qty),
    0,
    'ACTIVE'::batch_status,
    sqlc.arg(batch_type)::batch_type,
    sqlc.narg(parent_batch_id),
    0
)
RETURNING
    id,
    item_id,
    batch_code,
    daily_sequence,
    initial_qty,
    remaining_qty,
    reserved_qty,
    status,
    type,
    parent_batch_id,
    created_at,
    updated_at;


-- =============================================================================
-- SECTION 4 — FINISHED GOODS TRACEABILITY
-- =============================================================================

-- name: GetFinishedGoodProductionHistory :many
-- Returns the full production audit trail for a finished-good item.
-- One row per production run. Source batch aggregation avoids N+1:
-- source_batch_codes is a comma-joined aggregate for display.
-- Hits idx_production_runs_output_item_id + idx_batch_consumptions_production_run_id.
SELECT
    pr.id                                                   AS production_run_id,
    pr.run_sequence,
    pr.workstation,
    pr.input_qty,
    pr.output_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    pr.status,
    pr.notes,
    pr.operator_id,
    COALESCE(u.name, '')                                    AS operator_name,
    pr.created_at,
    pr.updated_at,
    COALESCE(
        STRING_AGG(DISTINCT src.batch_code, ', ' ORDER BY src.batch_code),
        ''
    )                                                       AS source_batch_codes,
    COUNT(DISTINCT bc.source_batch_id)::int                 AS source_batch_count
FROM production_runs pr
LEFT JOIN users u                   ON u.id  = pr.operator_id
LEFT JOIN batch_consumptions bc     ON bc.production_run_id = pr.id
LEFT JOIN inventory_batches src     ON src.id = bc.source_batch_id
WHERE pr.output_item_id = sqlc.arg(output_item_id)
GROUP BY
    pr.id,
    pr.run_sequence,
    pr.workstation,
    pr.input_qty,
    pr.output_qty,
    pr.scrap_qty,
    pr.shortlength_qty,
    pr.process_loss_qty,
    pr.status,
    pr.notes,
    pr.operator_id,
    u.name,
    pr.created_at,
    pr.updated_at
ORDER BY pr.created_at DESC, pr.run_sequence DESC
LIMIT  sqlc.arg(page_limit)
OFFSET sqlc.arg(page_offset);


-- =============================================================================
-- SECTION 5 — AGGREGATED INVENTORY SUPPORT
-- =============================================================================

-- name: GetTotalAllocatableQtyForItem :one
-- Returns total allocatable quantity across all ACTIVE batches for an item.
-- HOLD and EXHAUSTED batches are excluded by the status filter.
-- Returns 0 if no allocatable stock exists (COALESCE guards NULL from empty set).
SELECT
    COALESCE(SUM(b.remaining_qty), 0)::numeric(18,4) AS total_allocatable_qty
FROM inventory_batches b
WHERE b.item_id  = sqlc.arg(item_id)
  AND b.status   = 'ACTIVE'::batch_status
  AND b.remaining_qty > 0;

-- name: GetAllocatableBatchCountForItem :one
-- Returns the number of ACTIVE batches available for FIFO allocation.
-- Use for UI fragmentation visibility (e.g. "3 batches available") and
-- pre-flight checks before starting an allocation transaction.
SELECT
    COUNT(*)::int AS batch_count
FROM inventory_batches b
WHERE b.item_id  = sqlc.arg(item_id)
  AND b.status   = 'ACTIVE'::batch_status
  AND b.remaining_qty > 0;
