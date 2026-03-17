-- +goose Up
CREATE TABLE purchase_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    req_number VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    expected_delivery_date DATE,
    budget DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, req_number)
);

CREATE TABLE purchase_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchase_requisitions_tenant ON purchase_requisitions(tenant_id);
CREATE INDEX idx_purchase_requisitions_tenant_created ON purchase_requisitions(tenant_id, created_at DESC);
CREATE INDEX idx_requisition_items_requisition ON purchase_requisition_items(requisition_id);

-- +goose Down
DROP INDEX IF EXISTS idx_requisition_items_requisition;
DROP INDEX IF EXISTS idx_purchase_requisitions_tenant_created;
DROP INDEX IF EXISTS idx_purchase_requisitions_tenant;
DROP TABLE IF EXISTS purchase_requisition_items;
DROP TABLE IF EXISTS purchase_requisitions;
