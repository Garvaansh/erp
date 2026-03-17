-- +goose Up
-- Generic tenant configuration for multi-tenant ERP (non-Reva-specific)

-- Tenant settings: display name, fiscal year, currency, locale, feature flags
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    fiscal_year_start_month INT NOT NULL DEFAULT 4,
    base_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    locale VARCHAR(10) NOT NULL DEFAULT 'en-IN',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    feature_flags JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- Document number series: per tenant, per document type, per year (PO, SO, INV, GRN, WO, VINV)
CREATE TABLE IF NOT EXISTS document_number_series (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    prefix VARCHAR(20) NOT NULL DEFAULT '',
    PRIMARY KEY (tenant_id, document_type, year)
);

CREATE INDEX IF NOT EXISTS idx_document_number_series_tenant ON document_number_series(tenant_id);

-- Tax rules: per tenant (e.g. GST 18%, CGST 9%)
CREATE TABLE IF NOT EXISTS tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(10, 4) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    applicable_to VARCHAR(20) NOT NULL DEFAULT 'both',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_tenant ON tax_rules(tenant_id);

-- Custom field definitions: extra per-tenant fields attachable to entities (values stored elsewhere or in JSON later)
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) NOT NULL DEFAULT 'text',
    sort_order INT NOT NULL DEFAULT 0,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    default_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant_entity ON custom_fields(tenant_id, entity_type);

-- +goose Down
DROP TABLE IF EXISTS custom_fields;
DROP TABLE IF EXISTS tax_rules;
DROP TABLE IF EXISTS document_number_series;
DROP TABLE IF EXISTS tenant_settings;
