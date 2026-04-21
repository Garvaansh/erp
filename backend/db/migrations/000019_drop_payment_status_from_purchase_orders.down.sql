ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_payment_status_chk
    CHECK (payment_status IN ('PENDING', 'PARTIAL', 'COMPLETED'));
