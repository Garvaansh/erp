-- Rollback procurement module hardening migration

DROP INDEX IF EXISTS idx_purchase_order_logs_po_created_at;
DROP TABLE IF EXISTS purchase_order_logs;

-- Restore inventory transaction reference contract
UPDATE inventory_transactions
SET reference_type = 'PURCHASE_ORDER'
WHERE reference_type = 'PROCUREMENT';

ALTER TABLE inventory_transactions
    ALTER COLUMN reference_type TYPE tx_reference_type USING reference_type::tx_reference_type,
    ALTER COLUMN reference_id SET NOT NULL;

-- Remove batch procurement additions
DROP INDEX IF EXISTS idx_inventory_batches_parent_po_id;
ALTER TABLE inventory_batches
    DROP CONSTRAINT IF EXISTS inventory_batches_procurement_status_chk;

ALTER TABLE inventory_batches
    DROP COLUMN IF EXISTS parent_po_id,
    DROP COLUMN IF EXISTS unit_cost;

-- Revert purchase order status lifecycle
CREATE TYPE purchase_order_status_legacy AS ENUM ('PENDING', 'DELIVERED', 'CANCELLED');

ALTER TABLE purchase_orders
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE purchase_orders
    ALTER COLUMN status TYPE purchase_order_status_legacy
    USING (
        CASE status::text
            WHEN 'COMPLETED' THEN 'DELIVERED'
            WHEN 'CLOSED' THEN 'CANCELLED'
            ELSE 'PENDING'
        END::purchase_order_status_legacy
    );

ALTER TABLE purchase_orders
    ALTER COLUMN status SET DEFAULT 'PENDING';

DROP TYPE IF EXISTS purchase_order_status;
ALTER TYPE purchase_order_status_legacy RENAME TO purchase_order_status;

DROP INDEX IF EXISTS idx_purchase_orders_transaction_id;

ALTER TABLE purchase_orders
    DROP COLUMN IF EXISTS transaction_id,
    DROP COLUMN IF EXISTS received_qty,
    DROP COLUMN IF EXISTS vendor_invoice_ref,
    DROP COLUMN IF EXISTS notes;
