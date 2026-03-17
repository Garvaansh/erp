#!/usr/bin/env bash
# Run the Reva domain migration (00009) using psql.
# Usage: from erp-backend folder run:  bash scripts/migrate-reva.sh
# Or:    cd erp-backend && bash scripts/migrate-reva.sh

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:-erp_user}"
DB_PASSWORD="${DB_PASSWORD:-Admin2590!}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-reva_erp}"

DSN="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

echo "Running Reva migration (coil_consumption_log, product_type, vendor status_notes)..."
psql "$DSN" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(100), ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50), ADD COLUMN IF NOT EXISTS tr_notes TEXT;
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
SQL
echo "Done."
