-- +goose Up
-- payment_status is now derived from purchase_order_payments table.
-- This column is no longer read or written by procurement logic.
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_payment_status_chk;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS payment_status;


-- +goose Down
ALTER TABLE purchase_orders
    ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_payment_status_chk
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'COMPLETED'));
