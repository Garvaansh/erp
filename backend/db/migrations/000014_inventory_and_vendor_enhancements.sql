-- +goose Up
-- ============================================================
-- Migration 014: Inventory & Vendor Enhancements (Phase B)
-- ============================================================

-- 1. Vendor Master
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    gstin VARCHAR(20),
    payment_terms VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vendors_name_lower ON vendors (LOWER(name));

-- 2. Min/Max stock levels on items
ALTER TABLE items ADD COLUMN min_qty DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN max_qty DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 3. Expiry date on inventory batches
ALTER TABLE inventory_batches ADD COLUMN expiry_date DATE;

-- 4. Vendor FK on purchase orders (nullable for backward compat)
ALTER TABLE purchase_orders ADD COLUMN vendor_id UUID REFERENCES vendors(id);

-- 5. Apply updated_at trigger to vendors table
CREATE TRIGGER set_vendors_updated_at
BEFORE UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- +goose Down
-- 1. Drop trigger on vendors (if exists)
DROP TRIGGER IF EXISTS set_vendors_updated_at ON vendors;

-- 2. Remove vendor_id from purchase_orders
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS vendor_id;

-- 3. Remove expiry_date from inventory_batches
ALTER TABLE inventory_batches DROP COLUMN IF EXISTS expiry_date;

-- 4. Remove min/max qty from items
ALTER TABLE items DROP COLUMN IF EXISTS min_qty;
ALTER TABLE items DROP COLUMN IF EXISTS max_qty;

-- 5. Drop vendors table (this will also drop indexes automatically)
DROP TABLE IF EXISTS vendors;