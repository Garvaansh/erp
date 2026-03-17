-- +goose Up
-- Reva domain: coil consumption log (REVA-26), product type/status/notes (STOCK COIL), vendor status notes (CURTAIN TRACK)

-- Vendor: status/notes for supplier engagement (e.g. "RATES given", "don't sell", "CALL NOT PICK")
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS status_notes TEXT;

-- Product: type/spec (e.g. 30 MM, 48 MM), stock status (In stock), tr_notes (OLD, NEW, 6 BUNDLE, PIPES)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tr_notes TEXT;

-- Coil consumption log – mirrors REVA-26 spreadsheet (date, coil type, total, scrap, shortlength, used, remaining, coil ended)
CREATE TABLE IF NOT EXISTS coil_consumption_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  operation_date DATE NOT NULL,
  starting_kg DECIMAL(12, 4) NOT NULL,
  scrap_kg DECIMAL(12, 4) NOT NULL DEFAULT 0,
  shortlength_kg DECIMAL(12, 4) NOT NULL DEFAULT 0,
  used_kg DECIMAL(12, 4) NOT NULL,
  remaining_kg DECIMAL(12, 4) NOT NULL,
  coil_ended BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coil_log_tenant_date ON coil_consumption_log(tenant_id, operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_coil_log_product ON coil_consumption_log(tenant_id, product_id, operation_date DESC);

-- +goose Down
DROP TABLE IF EXISTS coil_consumption_log;
ALTER TABLE products DROP COLUMN IF EXISTS product_type;
ALTER TABLE products DROP COLUMN IF EXISTS stock_status;
ALTER TABLE products DROP COLUMN IF EXISTS tr_notes;
ALTER TABLE vendors DROP COLUMN IF EXISTS status_notes;
