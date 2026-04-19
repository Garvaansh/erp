ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_payment_status_chk;

ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_payment_status_chk
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'COMPLETED'));

UPDATE purchase_orders
SET payment_status = 'PENDING'
WHERE payment_status IS NULL OR BTRIM(payment_status) = '';
