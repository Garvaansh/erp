-- Procurement module hardening migration

-- 1) Upgrade purchase order status lifecycle
CREATE TYPE purchase_order_status_v2 AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CLOSED');

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS received_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vendor_invoice_ref TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

WITH po_seq AS (
    SELECT
        id,
        TO_CHAR(COALESCE(created_at, NOW()) AT TIME ZONE 'UTC', 'YYYYMMDD') AS txn_day,
        ROW_NUMBER() OVER (
            PARTITION BY TO_CHAR(COALESCE(created_at, NOW()) AT TIME ZONE 'UTC', 'YYYYMMDD')
            ORDER BY created_at, id
        ) AS seq
    FROM purchase_orders
)
UPDATE purchase_orders po
SET transaction_id = FORMAT(
    'TRXN-PROC-%s-%s',
    po_seq.txn_day,
    LPAD(po_seq.seq::text, 6, '0')
)
FROM po_seq
WHERE po.id = po_seq.id
  AND (po.transaction_id IS NULL OR BTRIM(po.transaction_id) = '');

ALTER TABLE purchase_orders
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE purchase_orders
    ALTER COLUMN status TYPE purchase_order_status_v2
    USING (
        CASE status::text
            WHEN 'DELIVERED' THEN 'COMPLETED'
            WHEN 'CANCELLED' THEN 'CLOSED'
            ELSE 'PENDING'
        END::purchase_order_status_v2
    );

ALTER TABLE purchase_orders
    ALTER COLUMN status SET DEFAULT 'PENDING';

DROP TYPE IF EXISTS purchase_order_status;
ALTER TYPE purchase_order_status_v2 RENAME TO purchase_order_status;

ALTER TABLE purchase_orders
    ALTER COLUMN transaction_id SET NOT NULL;

CREATE UNIQUE INDEX idx_purchase_orders_transaction_id
ON purchase_orders(transaction_id);

-- 2) Batch integrity fields needed by procurement
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'REVERSED';

ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS parent_po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,4),
    ALTER COLUMN reserved_qty SET DEFAULT 0;

UPDATE inventory_batches
SET unit_cost = 0
WHERE unit_cost IS NULL;

ALTER TABLE inventory_batches
    ALTER COLUMN unit_cost SET NOT NULL;

ALTER TABLE inventory_batches
    ADD CONSTRAINT inventory_batches_procurement_status_chk
    CHECK (
        parent_po_id IS NULL
        OR status::text IN ('ACTIVE', 'REVERSED')
    );

CREATE INDEX idx_inventory_batches_parent_po_id
ON inventory_batches(parent_po_id);

-- 3) Inventory transaction reference columns made generic for procurement links
ALTER TABLE inventory_transactions
    ALTER COLUMN reference_type TYPE TEXT USING reference_type::text,
    ALTER COLUMN reference_id DROP NOT NULL;

-- 4) Procurement audit log
CREATE TABLE purchase_order_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_logs_po_created_at
ON purchase_order_logs(po_id, created_at DESC);
