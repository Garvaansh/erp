-- ============================================================
-- Migration 023: Raw Material Inventory Backbone
-- ============================================================

-- 1. Add category_code to items for deterministic SKU generation
ALTER TABLE items ADD COLUMN IF NOT EXISTS category_code VARCHAR(4);

-- 2. Add low_stock_threshold to items for operational alerts
ALTER TABLE items ADD COLUMN IF NOT EXISTS low_stock_threshold DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 3. Seed low_stock_threshold from existing min_qty values
UPDATE items SET low_stock_threshold = min_qty WHERE min_qty > 0 AND low_stock_threshold = 0;

-- 4. Migrate all NEW batches to ACTIVE
UPDATE inventory_batches SET status = 'ACTIVE' WHERE status = 'NEW';

-- 5. Create SKU sequence table for deterministic generation
CREATE TABLE IF NOT EXISTS sku_sequences (
    category_code VARCHAR(4) NOT NULL,
    next_val INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (category_code)
);

-- 6. Replace legacy FIFO index with correct ASC order, ACTIVE-only filter
DROP INDEX IF EXISTS idx_batches_fifo;
CREATE INDEX IF NOT EXISTS idx_batches_fifo_asc
    ON inventory_batches(item_id, created_at ASC)
    WHERE status = 'ACTIVE' AND remaining_qty > 0;
