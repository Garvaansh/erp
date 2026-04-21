DROP INDEX IF EXISTS idx_purchase_order_payments_transaction_id;

ALTER TABLE purchase_order_payments
    DROP COLUMN IF EXISTS transaction_id;
