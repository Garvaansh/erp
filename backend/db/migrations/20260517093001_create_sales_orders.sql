-- +goose Up
CREATE TABLE sales_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number  VARCHAR(50) NOT NULL UNIQUE,
    customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status        VARCHAR(30) NOT NULL,
    notes         TEXT,
    order_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reserved_at   TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_orders_status_chk CHECK (
        status IN ('DRAFT', 'RESERVED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED', 'CLOSED')
    ),
    CONSTRAINT sales_orders_order_number_not_blank_chk CHECK (BTRIM(order_number) <> '')
);

CREATE INDEX idx_sales_orders_customer_id
ON sales_orders (customer_id);

CREATE INDEX idx_sales_orders_status
ON sales_orders (status);

CREATE INDEX idx_sales_orders_order_date
ON sales_orders (order_date DESC, id DESC);

CREATE TABLE sales_order_lines (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id         UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    finished_good_item_id  UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    ordered_qty            NUMERIC(12,4) NOT NULL,
    dispatched_qty         NUMERIC(12,4) NOT NULL DEFAULT 0,
    unit_price             NUMERIC(12,4),
    line_total             NUMERIC(12,4),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_order_lines_ordered_qty_positive_chk CHECK (ordered_qty > 0),
    CONSTRAINT sales_order_lines_dispatched_qty_nonnegative_chk CHECK (dispatched_qty >= 0),
    CONSTRAINT sales_order_lines_dispatched_qty_lte_ordered_qty_chk CHECK (dispatched_qty <= ordered_qty),
    CONSTRAINT sales_order_lines_unit_price_nonnegative_chk CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT sales_order_lines_line_total_nonnegative_chk CHECK (line_total IS NULL OR line_total >= 0)
);

CREATE INDEX idx_sales_order_lines_sales_order_id
ON sales_order_lines (sales_order_id);

CREATE INDEX idx_sales_order_lines_finished_good_item_id
ON sales_order_lines (finished_good_item_id);

-- +goose Down
DROP INDEX IF EXISTS idx_sales_order_lines_finished_good_item_id;
DROP INDEX IF EXISTS idx_sales_order_lines_sales_order_id;
DROP TABLE IF EXISTS sales_order_lines;

DROP INDEX IF EXISTS idx_sales_orders_order_date;
DROP INDEX IF EXISTS idx_sales_orders_status;
DROP INDEX IF EXISTS idx_sales_orders_customer_id;
DROP TABLE IF EXISTS sales_orders;
