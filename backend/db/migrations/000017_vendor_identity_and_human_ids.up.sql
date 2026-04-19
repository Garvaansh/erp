-- Phase 1: Vendor identity hardening
-- 1) Add stable, human-readable vendor code
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS vendor_code TEXT;

CREATE OR REPLACE FUNCTION generate_vendor_code(raw_name TEXT, preferred_vendor_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base_token TEXT;
    candidate TEXT;
    suffix INT := 1;
BEGIN
    base_token := REGEXP_REPLACE(UPPER(COALESCE(raw_name, '')), '[^A-Z0-9]', '', 'g');

    IF base_token = '' THEN
        base_token := 'VND';
    END IF;

    IF LENGTH(base_token) < 3 THEN
        base_token := RPAD(base_token, 3, 'X');
    END IF;

    IF LENGTH(base_token) > 5 THEN
        base_token := SUBSTRING(base_token FROM 1 FOR 5);
    END IF;

    candidate := base_token;

    WHILE EXISTS (
        SELECT 1
        FROM vendors v
        WHERE v.vendor_code = candidate
          AND (preferred_vendor_id IS NULL OR v.id <> preferred_vendor_id)
    ) LOOP
        candidate := base_token || LPAD(suffix::TEXT, 2, '0');
        suffix := suffix + 1;
    END LOOP;

    RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION assign_vendor_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.vendor_code IS NULL OR BTRIM(NEW.vendor_code) = '' THEN
        NEW.vendor_code := generate_vendor_code(NEW.name, NEW.id);
    ELSE
        NEW.vendor_code := REGEXP_REPLACE(UPPER(NEW.vendor_code), '[^A-Z0-9]', '', 'g');
        IF LENGTH(NEW.vendor_code) < 3 THEN
            NEW.vendor_code := RPAD(NEW.vendor_code, 3, 'X');
        END IF;
        IF LENGTH(NEW.vendor_code) > 8 THEN
            NEW.vendor_code := SUBSTRING(NEW.vendor_code FROM 1 FOR 8);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_vendor_code_on_insert ON vendors;
CREATE TRIGGER set_vendor_code_on_insert
BEFORE INSERT ON vendors
FOR EACH ROW
EXECUTE FUNCTION assign_vendor_code_on_insert();

UPDATE vendors v
SET vendor_code = generate_vendor_code(v.name, v.id)
WHERE v.vendor_code IS NULL OR BTRIM(v.vendor_code) = '';

ALTER TABLE vendors
ALTER COLUMN vendor_code SET NOT NULL;

ALTER TABLE vendors
DROP CONSTRAINT IF EXISTS vendors_vendor_code_format_chk;

ALTER TABLE vendors
ADD CONSTRAINT vendors_vendor_code_format_chk
CHECK (vendor_code ~ '^[A-Z0-9]{3,8}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_vendor_code
ON vendors(vendor_code);

-- 2) Backfill and enforce purchase_orders.vendor_id as source of truth
DO $$
DECLARE
    po_row RECORD;
    resolved_vendor_id UUID;
    normalized_vendor_name TEXT;
    synthetic_vendor_name TEXT;
BEGIN
    FOR po_row IN
        SELECT id, vendor_name
        FROM purchase_orders
        WHERE vendor_id IS NULL
    LOOP
        resolved_vendor_id := NULL;
        normalized_vendor_name := NULLIF(BTRIM(po_row.vendor_name), '');

        IF normalized_vendor_name IS NOT NULL THEN
            SELECT v.id
            INTO resolved_vendor_id
            FROM vendors v
            WHERE LOWER(v.name) = LOWER(normalized_vendor_name)
            ORDER BY v.created_at, v.id
            LIMIT 1;
        END IF;

        IF resolved_vendor_id IS NULL THEN
            synthetic_vendor_name := COALESCE(
                normalized_vendor_name,
                'Vendor ' || UPPER(SUBSTRING(REPLACE(po_row.id::TEXT, '-', '') FROM 1 FOR 8))
            );

            INSERT INTO vendors (name, is_active)
            VALUES (synthetic_vendor_name, TRUE)
            RETURNING id INTO resolved_vendor_id;
        END IF;

        UPDATE purchase_orders
        SET
            vendor_id = resolved_vendor_id,
            vendor_name = COALESCE(NULLIF(BTRIM(vendor_name), ''), normalized_vendor_name)
        WHERE id = po_row.id;
    END LOOP;
END;
$$;

ALTER TABLE purchase_orders
ALTER COLUMN vendor_id SET NOT NULL;

-- Keep vendor_name as optional immutable snapshot for display/history only.
ALTER TABLE purchase_orders
ALTER COLUMN vendor_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id
ON purchase_orders(vendor_id);
