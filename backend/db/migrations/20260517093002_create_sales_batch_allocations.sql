-- +goose Up
CREATE TABLE sales_batch_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_line_id UUID NOT NULL REFERENCES sales_order_lines(id) ON DELETE CASCADE,
    inventory_batch_id  UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    allocated_qty       NUMERIC(12,4) NOT NULL,
    dispatched_qty      NUMERIC(12,4) NOT NULL DEFAULT 0,
    status              VARCHAR(30) NOT NULL,
    reserved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at       TIMESTAMPTZ,
    released_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_batch_allocations_allocated_qty_positive_chk CHECK (allocated_qty > 0),
    CONSTRAINT sales_batch_allocations_dispatched_qty_nonnegative_chk CHECK (dispatched_qty >= 0),
    CONSTRAINT sales_batch_allocations_dispatched_qty_lte_allocated_qty_chk CHECK (dispatched_qty <= allocated_qty),
    CONSTRAINT sales_batch_allocations_status_chk CHECK (
        status IN ('RESERVED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'RELEASED')
    )
);

CREATE INDEX idx_sales_batch_allocations_sales_order_line_id
ON sales_batch_allocations (sales_order_line_id);

CREATE INDEX idx_sales_batch_allocations_inventory_batch_id
ON sales_batch_allocations (inventory_batch_id);

CREATE INDEX idx_sales_batch_allocations_status
ON sales_batch_allocations (status);

CREATE UNIQUE INDEX idx_sales_batch_allocations_line_batch_unique
ON sales_batch_allocations (sales_order_line_id, inventory_batch_id);

CREATE INDEX idx_inventory_batches_finished_reservable_fifo
ON inventory_batches (item_id, created_at ASC, id ASC)
WHERE type = 'FINISHED'::batch_type
  AND status = 'ACTIVE'::batch_status
  AND remaining_qty > reserved_qty;

-- +goose Down
DROP INDEX IF EXISTS idx_inventory_batches_finished_reservable_fifo;
DROP INDEX IF EXISTS idx_sales_batch_allocations_line_batch_unique;
DROP INDEX IF EXISTS idx_sales_batch_allocations_status;
DROP INDEX IF EXISTS idx_sales_batch_allocations_inventory_batch_id;
DROP INDEX IF EXISTS idx_sales_batch_allocations_sales_order_line_id;
DROP TABLE IF EXISTS sales_batch_allocations;
