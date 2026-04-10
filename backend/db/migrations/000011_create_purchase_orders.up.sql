CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    ordered_qty DECIMAL(18,4) NOT NULL CHECK (ordered_qty > 0),
    unit_price DECIMAL(18,4) NOT NULL CHECK (unit_price > 0),
    status purchase_order_status NOT NULL DEFAULT 'PENDING',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_status_created_at
ON purchase_orders(status, created_at);

CREATE INDEX idx_purchase_orders_item_id
ON purchase_orders(item_id);

ALTER TYPE tx_reference_type ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
