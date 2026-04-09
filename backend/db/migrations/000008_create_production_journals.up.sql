CREATE TABLE production_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE RESTRICT,
    
    -- The critical link to the inventory_transactions table
    movement_group_id UUID UNIQUE NOT NULL, 
    
    -- What was used and where it happened
    source_batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    -- INPUT AND OUTPUT LOCATIONS COMPLETELY REMOVED
    
    -- The actual numbers logged by the worker
    input_qty DECIMAL(18,4) NOT NULL CHECK (input_qty > 0),
    finished_qty DECIMAL(18,4) NOT NULL,
    scrap_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
    
    -- Guardrail check: if yield is outside BOM tolerances
    loss_reason TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to quickly pull up the history of a specific production order
CREATE INDEX idx_journals_order ON production_journals(production_order_id, created_at);