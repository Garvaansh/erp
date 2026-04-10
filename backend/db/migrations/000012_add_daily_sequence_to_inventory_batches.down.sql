DROP INDEX IF EXISTS idx_inventory_batches_item_created_at_sequence;

ALTER TABLE inventory_batches
DROP COLUMN IF EXISTS daily_sequence;