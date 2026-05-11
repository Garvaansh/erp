-- +goose Up
CREATE TYPE batch_type AS ENUM ('RAW', 'MOLDED', 'FINISHED');
CREATE TYPE production_journal_status AS ENUM ('FINAL', 'PENDING_APPROVAL', 'REJECTED');

ALTER TABLE users
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inventory_batches
ADD COLUMN type batch_type NOT NULL DEFAULT 'RAW',
ADD COLUMN diameter DECIMAL(18,4),
ADD COLUMN reserved_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN parent_batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL;

UPDATE inventory_batches b
SET type = CASE i.category
    WHEN 'FINISHED' THEN 'FINISHED'::batch_type
    WHEN 'SEMI_FINISHED' THEN 'MOLDED'::batch_type
    ELSE 'RAW'::batch_type
END
FROM items i
WHERE b.item_id = i.id;

ALTER TABLE inventory_batches
ADD CONSTRAINT inventory_batches_reserved_qty_nonnegative CHECK (reserved_qty >= 0);

ALTER TABLE production_journals
ALTER COLUMN production_order_id DROP NOT NULL;

ALTER TABLE production_journals
ADD COLUMN status production_journal_status NOT NULL DEFAULT 'FINAL',
ADD COLUMN diameter DECIMAL(18,4),
ADD COLUMN process_loss_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN shortlength_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN note TEXT,
ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN approved_at TIMESTAMPTZ;

CREATE INDEX idx_inventory_batches_parent_batch ON inventory_batches(parent_batch_id);
CREATE INDEX idx_production_journals_status_created_at ON production_journals(status, created_at DESC);


-- +goose Down
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

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM production_journals WHERE production_order_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot set production_order_id back to NOT NULL while NULL values exist';
    END IF;
END
$$;
-- +goose StatementEnd

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
