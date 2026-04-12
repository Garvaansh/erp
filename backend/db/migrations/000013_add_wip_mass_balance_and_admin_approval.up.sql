CREATE TYPE batch_type AS ENUM ('RAW', 'MOLDED', 'FINISHED');
CREATE TYPE production_journal_status AS ENUM ('FINAL', 'PENDING_APPROVAL', 'REJECTED');

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE inventory_batches
ADD COLUMN IF NOT EXISTS type batch_type NOT NULL DEFAULT 'RAW',
ADD COLUMN IF NOT EXISTS diameter DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS reserved_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL;

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
ADD COLUMN IF NOT EXISTS status production_journal_status NOT NULL DEFAULT 'FINAL',
ADD COLUMN IF NOT EXISTS diameter DECIMAL(18,4),
ADD COLUMN IF NOT EXISTS process_loss_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS shortlength_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inventory_batches_parent_batch ON inventory_batches(parent_batch_id);
CREATE INDEX IF NOT EXISTS idx_production_journals_status_created_at ON production_journals(status, created_at DESC);
