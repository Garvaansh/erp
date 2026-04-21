-- Add user-facing transaction_id to purchase_order_payments.
-- Format: TX-YYMMDD-NNN (e.g. TX-260422-045)

ALTER TABLE purchase_order_payments
    ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Backfill existing rows with deterministic IDs based on payment_date ordering.
WITH numbered AS (
    SELECT
        id,
        TO_CHAR(payment_date AT TIME ZONE 'UTC', 'YYMMDD') AS day_token,
        ROW_NUMBER() OVER (
            PARTITION BY TO_CHAR(payment_date AT TIME ZONE 'UTC', 'YYMMDD')
            ORDER BY payment_date, created_at, id
        ) AS seq
    FROM purchase_order_payments
    WHERE transaction_id IS NULL
)
UPDATE purchase_order_payments p
SET transaction_id = 'TX-' || numbered.day_token || '-' || LPAD(numbered.seq::text, 3, '0')
FROM numbered
WHERE p.id = numbered.id;

-- Now enforce NOT NULL and UNIQUE.
ALTER TABLE purchase_order_payments
    ALTER COLUMN transaction_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_order_payments_transaction_id
ON purchase_order_payments(transaction_id);
