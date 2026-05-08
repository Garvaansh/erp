CREATE INDEX IF NOT EXISTS idx_inventory_fifo
ON inventory_batches (item_id, status, created_at);
