-- +goose Up
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_number VARCHAR(100) NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    carrier_name VARCHAR(255),
    tracking_number VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, shipment_number),
    CONSTRAINT chk_shipment_status CHECK (status IN ('PENDING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED'))
);

CREATE TABLE shipment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipments_tenant_created ON shipments(tenant_id, created_at DESC);
CREATE INDEX idx_shipments_sales_order ON shipments(sales_order_id);
CREATE INDEX idx_shipment_lines_shipment ON shipment_lines(shipment_id);

-- +goose Down
DROP INDEX IF EXISTS idx_shipment_lines_shipment;
DROP INDEX IF EXISTS idx_shipments_sales_order;
DROP INDEX IF EXISTS idx_shipments_tenant_created;
DROP TABLE IF EXISTS shipment_lines;
DROP TABLE IF EXISTS shipments;
