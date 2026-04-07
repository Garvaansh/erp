-- ==========================================
-- 7. BILL OF MATERIALS (Recipes)
-- ==========================================
CREATE TYPE bom_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE bom_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT, -- The Finished Pipe
    version_no INT NOT NULL,
    status bom_status NOT NULL DEFAULT 'DRAFT',
    
    -- Yield Tolerances (e.g., Target: 96%, Min: 94%, Max: 98%)
    expected_yield_pct DECIMAL(5,2) NOT NULL, 
    allowed_min_yield_pct DECIMAL(5,2) NOT NULL,
    allowed_max_yield_pct DECIMAL(5,2) NOT NULL,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (item_id, version_no)
);

CREATE TABLE bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_version_id UUID NOT NULL REFERENCES bom_versions(id) ON DELETE CASCADE,
    input_item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT, -- The Raw Coil
    qty_per_unit DECIMAL(18,6) NOT NULL, -- e.g., 1.05 kg of coil needed per 1 kg of pipe
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);