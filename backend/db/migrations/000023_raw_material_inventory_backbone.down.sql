-- ============================================================
-- Reverse Migration 023: Raw Material Inventory Backbone
-- ============================================================

DROP INDEX IF EXISTS idx_batches_fifo_asc;

-- Restore original FIFO index (unfiltered, default order)
CREATE INDEX IF NOT EXISTS idx_batches_fifo
    ON inventory_batches(item_id, created_at)
    WHERE remaining_qty > 0;

DROP TABLE IF EXISTS sku_sequences;

ALTER TABLE items DROP COLUMN IF EXISTS low_stock_threshold;
ALTER TABLE items DROP COLUMN IF EXISTS category_code;

-- Note: NEW→ACTIVE data migration cannot be reliably reversed.
