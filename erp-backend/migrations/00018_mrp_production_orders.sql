-- +goose Up
-- Production lines / work centers (e.g. Line A, Assembly 1)
CREATE TABLE production_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Production orders (parent): Product, Quantity, Start/End, Production Line
CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_number VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL,
    start_date DATE,
    end_date DATE,
    production_line_id UUID REFERENCES production_lines(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PLANNED', -- PLANNED, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, po_number)
);

-- Machines (for scheduling); optional link to production line
CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    production_line_id UUID REFERENCES production_lines(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Work orders: add link to production order and operation step (Cutting, Welding, etc.)
ALTER TABLE work_orders
    ADD COLUMN IF NOT EXISTS production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS operation_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS sequence INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE;

-- Quality inspections (per work order, e.g. final Inspection step)
CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    result VARCHAR(20) NOT NULL, -- PASS, FAIL
    inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quality_result CHECK (result IN ('PASS', 'FAIL'))
);

CREATE INDEX IF NOT EXISTS idx_work_orders_production_order ON work_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_work_order ON quality_inspections(work_order_id);

-- +goose Down
DROP TABLE IF EXISTS quality_inspections;
ALTER TABLE work_orders
    DROP COLUMN IF EXISTS production_order_id,
    DROP COLUMN IF EXISTS operation_type,
    DROP COLUMN IF EXISTS sequence,
    DROP COLUMN IF EXISTS machine_id,
    DROP COLUMN IF EXISTS scheduled_start,
    DROP COLUMN IF EXISTS scheduled_end;
DROP TABLE IF EXISTS machines;
DROP TABLE IF EXISTS production_orders;
DROP TABLE IF EXISTS production_lines;
