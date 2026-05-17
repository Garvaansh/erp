-- name: CreateSalesOrder :one
INSERT INTO sales_orders (
    order_number,
    customer_id,
    status,
    notes,
    reserved_at,
    dispatched_at,
    cancelled_at,
    created_by
) VALUES (
    sqlc.arg(order_number),
    sqlc.arg(customer_id),
    sqlc.arg(status),
    sqlc.narg(notes),
    sqlc.narg(reserved_at),
    sqlc.narg(dispatched_at),
    sqlc.narg(cancelled_at),
    sqlc.narg(created_by)
)
RETURNING *;

-- name: CreateSalesOrderLine :one
INSERT INTO sales_order_lines (
    sales_order_id,
    finished_good_item_id,
    ordered_qty,
    dispatched_qty,
    unit_price,
    line_total
) VALUES (
    sqlc.arg(sales_order_id),
    sqlc.arg(finished_good_item_id),
    sqlc.arg(ordered_qty),
    0,
    sqlc.narg(unit_price),
    sqlc.narg(line_total)
)
RETURNING *;

-- name: GetSalesOrderByID :one
SELECT *
FROM sales_orders
WHERE id = sqlc.arg(id)
LIMIT 1;

-- name: GetSalesOrderByIDForUpdate :one
SELECT *
FROM sales_orders
WHERE id = sqlc.arg(id)
FOR UPDATE;

-- name: GetSalesOrderLineByIDForUpdate :one
SELECT *
FROM sales_order_lines
WHERE id = sqlc.arg(id)
FOR UPDATE;

-- name: ListSalesOrderLinesByOrder :many
SELECT *
FROM sales_order_lines
WHERE sales_order_id = sqlc.arg(sales_order_id)
ORDER BY created_at ASC, id ASC;

-- name: ListSalesOrderLinesByOrderForUpdate :many
SELECT *
FROM sales_order_lines
WHERE sales_order_id = sqlc.arg(sales_order_id)
ORDER BY created_at ASC, id ASC
FOR UPDATE;

-- name: ListSalesOrders :many
WITH line_totals AS (
    SELECT
        sol.sales_order_id,
        COALESCE(SUM(sol.ordered_qty), 0)::numeric AS total_qty,
        COALESCE(SUM(sol.dispatched_qty), 0)::numeric AS dispatched_qty
    FROM sales_order_lines sol
    GROUP BY sol.sales_order_id
),
allocation_totals AS (
    SELECT
        sol.sales_order_id,
        COALESCE(
            SUM(
                CASE
                    WHEN sba.status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
                    THEN GREATEST(sba.allocated_qty - sba.dispatched_qty, 0)
                    ELSE 0
                END
            ),
            0
        )::numeric AS reserved_qty
    FROM sales_order_lines sol
    LEFT JOIN sales_batch_allocations sba ON sba.sales_order_line_id = sol.id
    GROUP BY sol.sales_order_id
)
SELECT
    so.id,
    so.order_number,
    so.customer_id,
    so.status,
    so.notes,
    so.order_date,
    so.reserved_at,
    so.dispatched_at,
    so.cancelled_at,
    so.created_by,
    so.created_at,
    so.updated_at,
    c.display_name AS customer_display_name,
    COALESCE(c.company_name, '') AS customer_company_name,
    COALESCE(lt.total_qty, 0)::numeric AS total_qty,
    COALESCE(at.reserved_qty, 0)::numeric AS reserved_qty,
    COALESCE(lt.dispatched_qty, 0)::numeric AS dispatched_qty
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
LEFT JOIN line_totals lt ON lt.sales_order_id = so.id
LEFT JOIN allocation_totals at ON at.sales_order_id = so.id
WHERE (
    sqlc.narg(status_filter)::text IS NULL
    OR so.status = sqlc.narg(status_filter)::text
)
ORDER BY so.order_date DESC, so.created_at DESC, so.order_number DESC
LIMIT sqlc.arg(page_limit)
OFFSET sqlc.arg(page_offset);

-- name: GetSalesOrderDetail :one
WITH line_totals AS (
    SELECT
        sol.sales_order_id,
        COALESCE(SUM(sol.ordered_qty), 0)::numeric AS total_qty,
        COALESCE(SUM(sol.dispatched_qty), 0)::numeric AS dispatched_qty
    FROM sales_order_lines sol
    WHERE sol.sales_order_id = sqlc.arg(id)
    GROUP BY sol.sales_order_id
),
allocation_totals AS (
    SELECT
        sol.sales_order_id,
        COALESCE(
            SUM(
                CASE
                    WHEN sba.status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
                    THEN GREATEST(sba.allocated_qty - sba.dispatched_qty, 0)
                    ELSE 0
                END
            ),
            0
        )::numeric AS reserved_qty
    FROM sales_order_lines sol
    LEFT JOIN sales_batch_allocations sba ON sba.sales_order_line_id = sol.id
    WHERE sol.sales_order_id = sqlc.arg(id)
    GROUP BY sol.sales_order_id
)
SELECT
    so.id,
    so.order_number,
    so.customer_id,
    so.status,
    so.notes,
    so.order_date,
    so.reserved_at,
    so.dispatched_at,
    so.cancelled_at,
    so.created_by,
    so.created_at,
    so.updated_at,
    c.display_name AS customer_display_name,
    COALESCE(c.company_name, '') AS customer_company_name,
    COALESCE(c.phone_number, '') AS customer_phone_number,
    COALESCE(lt.total_qty, 0)::numeric AS total_qty,
    COALESCE(at.reserved_qty, 0)::numeric AS reserved_qty,
    COALESCE(lt.dispatched_qty, 0)::numeric AS dispatched_qty
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
LEFT JOIN line_totals lt ON lt.sales_order_id = so.id
LEFT JOIN allocation_totals at ON at.sales_order_id = so.id
WHERE so.id = sqlc.arg(id)
LIMIT 1;

-- name: GetSalesOrderLineDetails :many
SELECT
    sol.id,
    sol.sales_order_id,
    sol.finished_good_item_id,
    sol.ordered_qty,
    sol.dispatched_qty,
    sol.unit_price,
    sol.line_total,
    sol.created_at,
    COALESCE(i.sku, '') AS item_sku,
    i.name AS item_name,
    COALESCE(
        SUM(
            CASE
                WHEN sba.status IN ('RESERVED', 'PARTIALLY_DISPATCHED')
                THEN GREATEST(sba.allocated_qty - sba.dispatched_qty, 0)
                ELSE 0
            END
        ),
        0
    )::numeric AS reserved_qty
FROM sales_order_lines sol
JOIN items i ON i.id = sol.finished_good_item_id
LEFT JOIN sales_batch_allocations sba ON sba.sales_order_line_id = sol.id
WHERE sol.sales_order_id = sqlc.arg(sales_order_id)
GROUP BY sol.id, sol.sales_order_id, sol.finished_good_item_id, sol.ordered_qty, sol.dispatched_qty, sol.unit_price, sol.line_total, sol.created_at, i.sku, i.name
ORDER BY sol.created_at ASC, sol.id ASC;

-- name: UpdateSalesOrderStatus :one
UPDATE sales_orders
SET
    status = sqlc.arg(status),
    notes = COALESCE(sqlc.narg(notes)::text, notes),
    reserved_at = COALESCE(sqlc.narg(reserved_at)::timestamptz, reserved_at),
    dispatched_at = sqlc.narg(dispatched_at)::timestamptz,
    cancelled_at = sqlc.narg(cancelled_at)::timestamptz,
    updated_at = NOW()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: UpdateOrderDispatchProgress :one
UPDATE sales_order_lines
SET
    dispatched_qty = sqlc.arg(dispatched_qty),
    line_total = COALESCE(sqlc.narg(line_total)::numeric(12,4), line_total)
WHERE id = sqlc.arg(id)
RETURNING *;
