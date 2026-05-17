-- name: CreateSalesBatchAllocation :one
INSERT INTO sales_batch_allocations (
    sales_order_line_id,
    inventory_batch_id,
    allocated_qty,
    dispatched_qty,
    status,
    reserved_at,
    dispatched_at,
    released_at
) VALUES (
    sqlc.arg(sales_order_line_id),
    sqlc.arg(inventory_batch_id),
    sqlc.arg(allocated_qty),
    0,
    sqlc.arg(status),
    COALESCE(sqlc.narg(reserved_at)::timestamptz, NOW()),
    sqlc.narg(dispatched_at),
    sqlc.narg(released_at)
)
RETURNING *;

-- name: ListAllocationsForOrder :many
SELECT
    sba.id,
    sba.sales_order_line_id,
    sba.inventory_batch_id,
    sba.allocated_qty,
    sba.dispatched_qty,
    sba.status,
    sba.reserved_at,
    sba.dispatched_at,
    sba.released_at,
    sba.created_at,
    sol.sales_order_id,
    sol.finished_good_item_id,
    b.batch_code,
    b.created_at AS batch_created_at,
    c.id AS customer_id,
    c.display_name AS customer_display_name,
    COALESCE(c.company_name, '') AS customer_company_name,
    so.order_number
FROM sales_batch_allocations sba
JOIN sales_order_lines sol ON sol.id = sba.sales_order_line_id
JOIN sales_orders so ON so.id = sol.sales_order_id
JOIN customers c ON c.id = so.customer_id
JOIN inventory_batches b ON b.id = sba.inventory_batch_id
WHERE sol.sales_order_id = sqlc.arg(sales_order_id)
ORDER BY b.created_at ASC, b.id ASC, sba.created_at ASC, sba.id ASC;

-- name: ListAllocationsForOrderForUpdate :many
SELECT
    sba.id,
    sba.sales_order_line_id,
    sba.inventory_batch_id,
    sba.allocated_qty,
    sba.dispatched_qty,
    sba.status,
    sba.reserved_at,
    sba.dispatched_at,
    sba.released_at,
    sba.created_at,
    sol.sales_order_id,
    sol.finished_good_item_id,
    b.batch_code,
    b.created_at AS batch_created_at,
    b.item_id,
    b.remaining_qty,
    b.reserved_qty,
    b.status AS batch_status
FROM sales_batch_allocations sba
JOIN sales_order_lines sol ON sol.id = sba.sales_order_line_id
JOIN inventory_batches b ON b.id = sba.inventory_batch_id
WHERE sol.sales_order_id = sqlc.arg(sales_order_id)
ORDER BY b.created_at ASC, b.id ASC, sba.created_at ASC, sba.id ASC
FOR UPDATE OF sba, b;

-- name: ListAllocationsForLineForUpdate :many
SELECT
    sba.id,
    sba.sales_order_line_id,
    sba.inventory_batch_id,
    sba.allocated_qty,
    sba.dispatched_qty,
    sba.status,
    sba.reserved_at,
    sba.dispatched_at,
    sba.released_at,
    sba.created_at,
    b.batch_code,
    b.created_at AS batch_created_at,
    b.item_id,
    b.remaining_qty,
    b.reserved_qty,
    b.status AS batch_status
FROM sales_batch_allocations sba
JOIN inventory_batches b ON b.id = sba.inventory_batch_id
WHERE sba.sales_order_line_id = sqlc.arg(sales_order_line_id)
ORDER BY b.created_at ASC, b.id ASC, sba.created_at ASC, sba.id ASC
FOR UPDATE OF sba, b;

-- name: ListAllocationsForBatch :many
SELECT
    sba.id,
    sba.sales_order_line_id,
    sba.inventory_batch_id,
    sba.allocated_qty,
    sba.dispatched_qty,
    sba.status,
    sba.reserved_at,
    sba.dispatched_at,
    sba.released_at,
    sba.created_at,
    sol.sales_order_id,
    so.order_number,
    so.status AS order_status,
    c.id AS customer_id,
    c.display_name AS customer_display_name,
    COALESCE(c.company_name, '') AS customer_company_name
FROM sales_batch_allocations sba
JOIN sales_order_lines sol ON sol.id = sba.sales_order_line_id
JOIN sales_orders so ON so.id = sol.sales_order_id
JOIN customers c ON c.id = so.customer_id
WHERE sba.inventory_batch_id = sqlc.arg(inventory_batch_id)
ORDER BY sba.reserved_at ASC, sba.id ASC;

-- name: UpdateAllocationDispatch :one
UPDATE sales_batch_allocations
SET
    dispatched_qty = sqlc.arg(dispatched_qty),
    status = sqlc.arg(status),
    dispatched_at = sqlc.narg(dispatched_at)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: ReleaseAllocations :many
UPDATE sales_batch_allocations
SET
    status = 'RELEASED',
    released_at = COALESCE(sqlc.narg(released_at)::timestamptz, NOW())
WHERE sales_order_line_id IN (
    SELECT id
    FROM sales_order_lines
    WHERE sales_order_id = sqlc.arg(sales_order_id)
)
  AND status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
  AND allocated_qty > dispatched_qty
RETURNING *;

-- name: GetFinishedGoodReservationSummary :one
SELECT
    i.id AS item_id,
    COALESCE(
        SUM(
            CASE
                WHEN sba.status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
                THEN GREATEST(sba.allocated_qty - sba.dispatched_qty, 0)
                ELSE 0
            END
        ),
        0
    )::numeric AS total_reserved,
    COUNT(DISTINCT sba.inventory_batch_id)::int AS batches_involved,
    COUNT(DISTINCT sol.sales_order_id)::int AS reserving_orders
FROM items i
LEFT JOIN sales_order_lines sol ON sol.finished_good_item_id = i.id
LEFT JOIN sales_batch_allocations sba ON sba.sales_order_line_id = sol.id
WHERE i.id = sqlc.arg(item_id)
GROUP BY i.id;

-- name: ListFinishedGoodReservations :many
SELECT
    so.id AS sales_order_id,
    so.order_number,
    so.status AS order_status,
    c.id AS customer_id,
    c.display_name AS customer_display_name,
    COALESCE(c.company_name, '') AS customer_company_name,
    COALESCE(
        SUM(
            CASE
                WHEN sba.status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
                THEN GREATEST(sba.allocated_qty - sba.dispatched_qty, 0)
                ELSE 0
            END
        ),
        0
    )::numeric AS reserved_qty,
    COALESCE(SUM(sba.dispatched_qty), 0)::numeric AS dispatched_qty,
    ARRAY_AGG(DISTINCT sba.status ORDER BY sba.status)::text[] AS allocation_statuses
FROM sales_order_lines sol
JOIN sales_orders so ON so.id = sol.sales_order_id
JOIN customers c ON c.id = so.customer_id
JOIN sales_batch_allocations sba ON sba.sales_order_line_id = sol.id
WHERE sol.finished_good_item_id = sqlc.arg(item_id)
GROUP BY so.id, so.order_number, so.status, c.id, c.display_name, c.company_name
ORDER BY so.order_date DESC, so.order_number DESC;
