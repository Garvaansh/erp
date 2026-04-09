CREATE TABLE bom_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT, 
    version_no INT NOT NULL,
    status bom_status NOT NULL DEFAULT 'DRAFT',
    
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
    input_item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT, 
    qty_per_unit DECIMAL(18,6) NOT NULL, 
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);