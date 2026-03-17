-- +goose Up
-- Production-ready inventory: reorder/safety stock, UOM, reservations, transfers, audit reason

-- Product planning fields (reorder point, safety stock, UOM)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reorder_point DECIMAL(12, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_stock DECIMAL(12, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uom VARCHAR(20) NOT NULL DEFAULT 'EA';

-- Transaction reason for audit trail (RECEIPT, SHIPMENT, ADJUSTMENT, TRANSFER, RETURN, etc.)
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS transaction_reason VARCHAR(100);

-- Reservations: reserve quantity for sales orders / demand
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 4) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_reservation_status CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_product ON inventory_reservations(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON inventory_reservations(tenant_id, status);

-- Inter-warehouse transfers (creates OUT + IN on complete)
CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12, 4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT chk_transfer_warehouses CHECK (from_warehouse_id != to_warehouse_id),
  CONSTRAINT chk_transfer_status CHECK (status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON warehouse_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON warehouse_transfers(tenant_id, status);

-- +goose Down
ALTER TABLE products DROP COLUMN IF EXISTS reorder_point;
ALTER TABLE products DROP COLUMN IF EXISTS safety_stock;
ALTER TABLE products DROP COLUMN IF EXISTS lead_time_days;
ALTER TABLE products DROP COLUMN IF EXISTS uom;
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS transaction_reason;
DROP TABLE IF EXISTS warehouse_transfers;
DROP TABLE IF EXISTS inventory_reservations;
