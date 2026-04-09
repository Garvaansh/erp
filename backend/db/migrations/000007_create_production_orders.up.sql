CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'PO-20260401-001'
    bom_version_id UUID NOT NULL REFERENCES bom_versions(id) ON DELETE RESTRICT,
    
    -- Planning & Progress Tracking Cache
    planned_qty DECIMAL(18,4) NOT NULL,
    produced_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
    consumed_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
    scrap_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    status production_order_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    
    planned_start_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to quickly find active orders for the worker's Daily Log UI
CREATE INDEX idx_po_status ON production_orders(status) WHERE status IN ('PLANNED', 'IN_PROGRESS');