ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_payment_status_chk;

ALTER TABLE purchase_orders
    DROP COLUMN IF EXISTS payment_status;
