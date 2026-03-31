CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES products(id),
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('RAW', 'FINISHED', 'SCRAP')),
    specs JSONB,
    base_unit TEXT DEFAULT 'KG',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    batch_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'NEW',
    initial_qty DECIMAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES inventory_batches(id) ON DELETE CASCADE,
    quantity DECIMAL NOT NULL, 
    tx_type TEXT CHECK (tx_type IN ('PURCHASE', 'PRODUCTION', 'SALE', 'ADJUSTMENT')),
    reference_id UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);