-- ============================================================
-- Migration 014: Inventory & Vendor Enhancements (Phase B)
-- ============================================================

-- 1. Vendor Master
CREATE TABLE IF NOT EXISTS vendors (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name_lower ON vendors (LOWER(name));

-- 2. Min/Max stock levels on items
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_qty DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS max_qty DECIMAL(18,4) NOT NULL DEFAULT 0;

-- 3. Expiry date on inventory batches
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 4. Vendor FK on purchase orders (nullable for backward compat)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- 5. Apply updated_at trigger to vendors table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_vendors_updated_at'
    ) THEN
        CREATE TRIGGER set_vendors_updated_at
        BEFORE UPDATE ON vendors
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;
