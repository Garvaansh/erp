-- inventory_batches
CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    batch_code VARCHAR(100) UNIQUE NOT NULL, 
    
    initial_qty DECIMAL(18,4) NOT NULL,
    remaining_qty DECIMAL(18,4) NOT NULL,
    
    unit_cost DECIMAL(18,2), 
    status batch_status NOT NULL DEFAULT 'NEW',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the FIFO dropdowns (Find oldest available batches)
CREATE INDEX idx_batches_fifo ON inventory_batches(item_id, created_at) WHERE remaining_qty > 0;