DROP INDEX IF EXISTS idx_production_journals_status_created_at;
DROP INDEX IF EXISTS idx_inventory_batches_parent_batch;

ALTER TABLE production_journals
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS approved_by,
DROP COLUMN IF EXISTS note,
DROP COLUMN IF EXISTS shortlength_qty,
DROP COLUMN IF EXISTS process_loss_qty,
DROP COLUMN IF EXISTS diameter,
DROP COLUMN IF EXISTS status;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM production_journals WHERE production_order_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot set production_order_id back to NOT NULL while NULL values exist';
    END IF;
END
$$;

ALTER TABLE production_journals
ALTER COLUMN production_order_id SET NOT NULL;

ALTER TABLE inventory_batches
DROP CONSTRAINT IF EXISTS inventory_batches_reserved_qty_nonnegative;

ALTER TABLE inventory_batches
DROP COLUMN IF EXISTS parent_batch_id,
DROP COLUMN IF EXISTS reserved_qty,
DROP COLUMN IF EXISTS diameter,
DROP COLUMN IF EXISTS type;

ALTER TABLE users
DROP COLUMN IF EXISTS is_admin;

DROP TYPE IF EXISTS production_journal_status;
DROP TYPE IF EXISTS batch_type;
