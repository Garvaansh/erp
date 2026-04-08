CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES items(id) ON DELETE SET NULL,
    sku VARCHAR(100) UNIQUE, 
    name VARCHAR(255) NOT NULL,
    category item_category NOT NULL,
    base_unit base_unit_type NOT NULL DEFAULT 'WEIGHT', 
    specs JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_items_specs ON items USING GIN (specs);
CREATE INDEX idx_items_parent_id ON items(parent_id);

CREATE UNIQUE INDEX idx_items_unique_name_specs ON items (name, CAST(specs AS TEXT));