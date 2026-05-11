-- +goose Up
-- ============================================================
-- Migration 023: Raw Material Inventory Backbone
-- ============================================================

-- 1. Add category_code to items for deterministic SKU generation
ALTER TABLE items ADD COLUMN category_code VARCHAR(4);

-- 2. Add low_stock_threshold to items for operational alerts
ALTER TABLE items ADD COLUMN low_stock_threshold DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 3. Seed low_stock_threshold from existing min_qty values
UPDATE items SET low_stock_threshold = min_qty WHERE min_qty > 0 AND low_stock_threshold = 0;

-- 4. Migrate all NEW batches to ACTIVE
UPDATE inventory_batches SET status = 'ACTIVE' WHERE status = 'NEW';

-- 5. Create SKU sequence table for deterministic generation
CREATE TABLE sku_sequences (
    category_code VARCHAR(4) NOT NULL,
    next_val INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (category_code)
);

-- 6. Replace legacy FIFO index with correct ASC order, ACTIVE-only filter
DROP INDEX idx_batches_fifo;
CREATE INDEX idx_batches_fifo_asc
    ON inventory_batches(item_id, created_at ASC)
    WHERE status = 'ACTIVE' AND remaining_qty > 0;


-- +goose Down
-- ============================================================
-- Reverse Migration 023: Raw Material Inventory Backbone
-- ============================================================

DROP INDEX IF EXISTS idx_batches_fifo_asc;

-- Restore original FIFO index (unfiltered, default order)
CREATE INDEX idx_batches_fifo
    ON inventory_batches(item_id, created_at)
    WHERE remaining_qty > 0;

DROP TABLE IF EXISTS sku_sequences;

ALTER TABLE items DROP COLUMN IF EXISTS low_stock_threshold;
ALTER TABLE items DROP COLUMN IF EXISTS category_code;

-- Note: NEW→ACTIVE data migration cannot be reliably reversed.
