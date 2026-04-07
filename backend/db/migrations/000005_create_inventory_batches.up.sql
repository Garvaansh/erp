-- ==========================================
-- 5. INVENTORY BATCHES (Physical Lots)
-- ==========================================
CREATE TYPE batch_status AS ENUM ('NEW', 'ACTIVE', 'EXHAUSTED', 'HOLD');

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    batch_code VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'COIL-20260331-001'
    
    -- Cache fields for fast UI rendering (updated via Go transactions)
    current_location_id UUID REFERENCES inventory_locations(id), 
    initial_qty DECIMAL(18,4) NOT NULL,
    remaining_qty DECIMAL(18,4) NOT NULL,
    
    unit_cost DECIMAL(18,2), -- For valuation purposes later
    status batch_status NOT NULL DEFAULT 'NEW',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the FIFO dropdowns (Find oldest available batches at a specific location)
CREATE INDEX idx_batches_fifo ON inventory_batches(item_id, current_location_id, created_at) WHERE remaining_qty > 0;