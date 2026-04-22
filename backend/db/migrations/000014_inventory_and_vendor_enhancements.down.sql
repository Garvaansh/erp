-- 1. Drop trigger on vendors (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_vendors_updated_at'
    ) THEN
        DROP TRIGGER set_vendors_updated_at ON vendors;
    END IF;
END
$$;

-- 2. Remove vendor_id from purchase_orders
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS vendor_id;

-- 3. Remove expiry_date from inventory_batches
ALTER TABLE inventory_batches DROP COLUMN IF EXISTS expiry_date;

-- 4. Remove min/max qty from items
ALTER TABLE items DROP COLUMN IF EXISTS min_qty;
ALTER TABLE items DROP COLUMN IF EXISTS max_qty;

-- 5. Drop vendors table (this will also drop indexes automatically)
DROP TABLE IF EXISTS vendors;