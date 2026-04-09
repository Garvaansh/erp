CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_group_id UUID NOT NULL, -- Ties multi-step atomic operations together
    
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    -- LOCATION ID COMPLETELY REMOVED HERE
    
    direction tx_direction NOT NULL,
    quantity DECIMAL(18,4) NOT NULL CHECK (quantity > 0), -- Always positive, direction handles the math
    
    reference_type tx_reference_type NOT NULL,
    reference_id UUID NOT NULL, -- Links to the specific Purchase Order or Daily Log
    
    performed_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crucial indexes for tracing history and debugging
CREATE INDEX idx_transactions_group ON inventory_transactions(movement_group_id);
CREATE INDEX idx_transactions_batch ON inventory_transactions(batch_id, created_at);
CREATE INDEX idx_transactions_reference ON inventory_transactions(reference_type, reference_id);