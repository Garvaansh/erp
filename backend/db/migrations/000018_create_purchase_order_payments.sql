-- +goose Up
CREATE TABLE purchase_order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    amount DECIMAL(18,4) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_payments_po_id
ON purchase_order_payments(po_id);

CREATE INDEX idx_purchase_order_payments_po_date
ON purchase_order_payments(po_id, payment_date DESC);


-- +goose Down
DROP INDEX IF EXISTS idx_purchase_order_payments_po_date;
DROP INDEX IF EXISTS idx_purchase_order_payments_po_id;
DROP TABLE IF EXISTS purchase_order_payments;
