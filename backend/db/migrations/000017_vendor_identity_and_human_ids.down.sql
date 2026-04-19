DROP INDEX IF EXISTS idx_purchase_orders_vendor_id;

UPDATE purchase_orders po
SET vendor_name = COALESCE(NULLIF(BTRIM(po.vendor_name), ''), v.name)
FROM vendors v
WHERE po.vendor_id = v.id
  AND (po.vendor_name IS NULL OR BTRIM(po.vendor_name) = '');

ALTER TABLE purchase_orders
ALTER COLUMN vendor_name SET NOT NULL;

ALTER TABLE purchase_orders
ALTER COLUMN vendor_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_vendors_vendor_code;

ALTER TABLE vendors
DROP CONSTRAINT IF EXISTS vendors_vendor_code_format_chk;

DROP TRIGGER IF EXISTS set_vendor_code_on_insert ON vendors;
DROP FUNCTION IF EXISTS assign_vendor_code_on_insert();
DROP FUNCTION IF EXISTS generate_vendor_code(TEXT, UUID);

ALTER TABLE vendors
DROP COLUMN IF EXISTS vendor_code;
