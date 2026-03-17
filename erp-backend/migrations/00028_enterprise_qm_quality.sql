-- +goose Up
-- Quality Management (QM): inspection lots, characteristics, results, defect codes, quality info records

CREATE TABLE quality_info_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    inspection_type VARCHAR(20) NOT NULL DEFAULT '01',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, vendor_id, product_id, plant_id, inspection_type)
);
CREATE INDEX idx_quality_info_records_tenant ON quality_info_records(tenant_id);
CREATE INDEX idx_quality_info_records_product ON quality_info_records(product_id);

CREATE TABLE inspection_lot_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lot_number VARCHAR(30) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    inspection_type VARCHAR(20) NOT NULL DEFAULT '01',
    source_type VARCHAR(30),  -- GOODS_RECEIPT, PRODUCTION, etc.
    source_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, COMPLETED
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, lot_number)
);
CREATE INDEX idx_inspection_lot_headers_tenant ON inspection_lot_headers(tenant_id);
CREATE INDEX idx_inspection_lot_headers_product ON inspection_lot_headers(product_id);

CREATE TABLE inspection_lot_characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    inspection_lot_id UUID NOT NULL REFERENCES inspection_lot_headers(id) ON DELETE CASCADE,
    characteristic_code VARCHAR(30) NOT NULL,
    characteristic_name VARCHAR(255),
    unit_of_measure VARCHAR(10),
    target_value DECIMAL(18, 4),
    upper_limit DECIMAL(18, 4),
    lower_limit DECIMAL(18, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, inspection_lot_id, characteristic_code)
);
CREATE INDEX idx_inspection_lot_characteristics_lot ON inspection_lot_characteristics(inspection_lot_id);

CREATE TABLE inspection_lot_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    characteristic_id UUID NOT NULL REFERENCES inspection_lot_characteristics(id) ON DELETE CASCADE,
    measured_value DECIMAL(18, 4),
    result VARCHAR(10) NOT NULL,  -- PASS, FAIL
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, characteristic_id)
);
CREATE INDEX idx_inspection_lot_results_characteristic ON inspection_lot_results(characteristic_id);

CREATE TABLE defect_code_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_defect_code_groups_tenant ON defect_code_groups(tenant_id);

CREATE TABLE defect_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    defect_group_id UUID REFERENCES defect_code_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_defect_codes_tenant ON defect_codes(tenant_id);

CREATE TABLE quality_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    certificate_type VARCHAR(30),
    valid_from DATE,
    valid_to DATE,
    document_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, certificate_number)
);
CREATE INDEX idx_quality_certificates_tenant ON quality_certificates(tenant_id);
CREATE INDEX idx_quality_certificates_product ON quality_certificates(product_id);

CREATE TABLE quality_notification_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    notification_number VARCHAR(30) NOT NULL,
    notification_type VARCHAR(20) NOT NULL DEFAULT 'COMPLAINT',
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, notification_number)
);
CREATE INDEX idx_quality_notification_headers_tenant ON quality_notification_headers(tenant_id);

CREATE TABLE quality_notification_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    notification_header_id UUID NOT NULL REFERENCES quality_notification_headers(id) ON DELETE CASCADE,
    defect_code_id UUID REFERENCES defect_codes(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 4),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_quality_notification_items_notification ON quality_notification_items(notification_header_id);

-- +goose Down
DROP TABLE IF EXISTS quality_notification_items;
DROP TABLE IF EXISTS quality_notification_headers;
DROP TABLE IF EXISTS quality_certificates;
DROP TABLE IF EXISTS defect_codes;
DROP TABLE IF EXISTS defect_code_groups;
DROP TABLE IF EXISTS inspection_lot_results;
DROP TABLE IF EXISTS inspection_lot_characteristics;
DROP TABLE IF EXISTS inspection_lot_headers;
DROP TABLE IF EXISTS quality_info_records;