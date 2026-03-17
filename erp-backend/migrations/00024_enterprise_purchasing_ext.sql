-- +goose Up
-- Purchasing extensions: purchasing groups, info records, source list, quota arrangements, contracts

CREATE TABLE purchasing_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    purchasing_organization_id UUID REFERENCES purchasing_organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_purchasing_groups_tenant ON purchasing_groups(tenant_id);

CREATE TABLE purchasing_info_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    net_price DECIMAL(18, 4),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    delivery_days INT,
    min_order_quantity DECIMAL(12, 4),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, vendor_id, product_id, purchasing_organization_id)
);
CREATE INDEX idx_purchasing_info_records_tenant ON purchasing_info_records(tenant_id);
CREATE INDEX idx_purchasing_info_records_vendor ON purchasing_info_records(vendor_id);
CREATE INDEX idx_purchasing_info_records_product ON purchasing_info_records(product_id);

CREATE TABLE purchasing_info_record_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    info_record_id UUID NOT NULL REFERENCES purchasing_info_records(id) ON DELETE CASCADE,
    condition_type VARCHAR(10) NOT NULL,
    amount DECIMAL(18, 4),
    percent DECIMAL(8, 4),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_purchasing_info_record_conditions_info ON purchasing_info_record_conditions(info_record_id);

CREATE TABLE source_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    preferred_indicator BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id, vendor_id)
);
CREATE INDEX idx_source_list_tenant ON source_list(tenant_id);
CREATE INDEX idx_source_list_product ON source_list(product_id);
CREATE INDEX idx_source_list_plant ON source_list(plant_id);

CREATE TABLE source_list_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_list_id UUID NOT NULL REFERENCES source_list(id) ON DELETE CASCADE,
    condition_type VARCHAR(10) NOT NULL,
    amount DECIMAL(18, 4),
    percent DECIMAL(8, 4),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_source_list_conditions_source ON source_list_conditions(source_list_id);

CREATE TABLE quota_arrangements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id)
);
CREATE INDEX idx_quota_arrangements_tenant ON quota_arrangements(tenant_id);
CREATE INDEX idx_quota_arrangements_product ON quota_arrangements(product_id);

CREATE TABLE quota_arrangement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quota_arrangement_id UUID NOT NULL REFERENCES quota_arrangements(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    percentage DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, quota_arrangement_id, vendor_id)
);
CREATE INDEX idx_quota_arrangement_items_quota ON quota_arrangement_items(quota_arrangement_id);

CREATE TABLE scheduling_agreement_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agreement_number VARCHAR(30) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, agreement_number)
);
CREATE INDEX idx_scheduling_agreement_headers_tenant ON scheduling_agreement_headers(tenant_id);
CREATE INDEX idx_scheduling_agreement_headers_vendor ON scheduling_agreement_headers(vendor_id);

CREATE TABLE scheduling_agreement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agreement_header_id UUID NOT NULL REFERENCES scheduling_agreement_headers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    schedule_line_date DATE NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    unit_price DECIMAL(18, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, agreement_header_id, product_id, schedule_line_date)
);
CREATE INDEX idx_scheduling_agreement_items_agreement ON scheduling_agreement_items(agreement_header_id);

CREATE TABLE purchase_order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    purchase_order_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    history_type VARCHAR(20) NOT NULL,  -- GOODS_RECEIPT, INVOICE, etc.
    quantity DECIMAL(12, 4),
    amount DECIMAL(18, 2),
    reference_document_id UUID,
    reference_document_type VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_purchase_order_history_po ON purchase_order_history(purchase_order_id);
CREATE INDEX idx_purchase_order_history_tenant ON purchase_order_history(tenant_id);

CREATE TABLE contract_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_number VARCHAR(30) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, contract_number)
);
CREATE INDEX idx_contract_headers_tenant ON contract_headers(tenant_id);
CREATE INDEX idx_contract_headers_vendor ON contract_headers(vendor_id);

CREATE TABLE contract_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_header_id UUID NOT NULL REFERENCES contract_headers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 4) NOT NULL,
    unit_price DECIMAL(18, 4),
    net_value DECIMAL(18, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, contract_header_id, product_id)
);
CREATE INDEX idx_contract_items_contract ON contract_items(contract_header_id);

-- +goose Down
DROP TABLE IF EXISTS contract_items;
DROP TABLE IF EXISTS contract_headers;
DROP TABLE IF EXISTS purchase_order_history;
DROP TABLE IF EXISTS scheduling_agreement_items;
DROP TABLE IF EXISTS scheduling_agreement_headers;
DROP TABLE IF EXISTS quota_arrangement_items;
DROP TABLE IF EXISTS quota_arrangements;
DROP TABLE IF EXISTS source_list_conditions;
DROP TABLE IF EXISTS source_list;
DROP TABLE IF EXISTS purchasing_info_record_conditions;
DROP TABLE IF EXISTS purchasing_info_records;
DROP TABLE IF EXISTS purchasing_groups;
