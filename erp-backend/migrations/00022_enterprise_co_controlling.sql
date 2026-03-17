-- +goose Up
-- Controlling (CO): cost elements, activity types, internal orders, rates, profitability segments

CREATE TABLE cost_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chart_of_accounts_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    cost_element_number VARCHAR(20) NOT NULL,
    cost_element_type VARCHAR(1) NOT NULL DEFAULT '1',  -- 1=primary, 2=secondary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, chart_of_accounts_id, cost_element_number)
);
CREATE INDEX idx_cost_elements_tenant ON cost_elements(tenant_id);

CREATE TABLE cost_element_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_element_id UUID NOT NULL REFERENCES cost_elements(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    name VARCHAR(255) NOT NULL,
    UNIQUE(cost_element_id, language_code)
);

CREATE TABLE activity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'HR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, cost_center_id, code)
);
CREATE INDEX idx_activity_types_tenant ON activity_types(tenant_id);
CREATE INDEX idx_activity_types_cost_center ON activity_types(cost_center_id);

CREATE TABLE activity_type_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(activity_type_id, language_code)
);

CREATE TABLE cost_center_activity_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_number INT NOT NULL,
    price_per_unit DECIMAL(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    UNIQUE(tenant_id, activity_type_id, fiscal_year, period_number)
);
CREATE INDEX idx_cost_center_activity_rates_tenant ON cost_center_activity_rates(tenant_id);

CREATE TABLE internal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    order_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    order_type VARCHAR(10) NOT NULL DEFAULT 'IO',  -- IO=internal order, CO=cost collector
    cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
    profit_center_id UUID REFERENCES profit_centers(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, company_code_id, order_number)
);
CREATE INDEX idx_internal_orders_tenant ON internal_orders(tenant_id);
CREATE INDEX idx_internal_orders_company ON internal_orders(company_code_id);

CREATE TABLE internal_order_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_order_id UUID NOT NULL REFERENCES internal_orders(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(internal_order_id, language_code)
);

CREATE TABLE internal_order_settlement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    internal_order_id UUID NOT NULL REFERENCES internal_orders(id) ON DELETE CASCADE,
    receiver_type VARCHAR(20) NOT NULL,  -- COST_CENTER, PROFIT_CENTER, etc.
    receiver_id UUID NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL DEFAULT 100,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_internal_order_settlement_tenant ON internal_order_settlement_rules(tenant_id);
CREATE INDEX idx_internal_order_settlement_order ON internal_order_settlement_rules(internal_order_id);

CREATE TABLE profitability_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    segment_1 VARCHAR(50),
    segment_2 VARCHAR(50),
    segment_3 VARCHAR(50),
    profit_center_id UUID REFERENCES profit_centers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_profitability_segments_tenant ON profitability_segments(tenant_id);

CREATE TABLE profitability_segment_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profitability_segment_id UUID NOT NULL REFERENCES profitability_segments(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(profitability_segment_id, language_code)
);

CREATE TABLE assessment_cycle_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_cost_element_id UUID REFERENCES cost_elements(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_assessment_cycle_headers_tenant ON assessment_cycle_headers(tenant_id);

CREATE TABLE assessment_cycle_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cycle_header_id UUID NOT NULL REFERENCES assessment_cycle_headers(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    cost_element_id UUID REFERENCES cost_elements(id) ON DELETE SET NULL,
    sender_percentage DECIMAL(5, 2) NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_assessment_cycle_sources_cycle ON assessment_cycle_sources(cycle_header_id);

CREATE TABLE assessment_cycle_receivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cycle_header_id UUID NOT NULL REFERENCES assessment_cycle_headers(id) ON DELETE CASCADE,
    receiver_type VARCHAR(20) NOT NULL,
    receiver_id UUID NOT NULL,
    receiver_percentage DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_assessment_cycle_receivers_cycle ON assessment_cycle_receivers(cycle_header_id);

-- +goose Down
DROP TABLE IF EXISTS assessment_cycle_receivers;
DROP TABLE IF EXISTS assessment_cycle_sources;
DROP TABLE IF EXISTS assessment_cycle_headers;
DROP TABLE IF EXISTS profitability_segment_texts;
DROP TABLE IF EXISTS profitability_segments;
DROP TABLE IF EXISTS internal_order_settlement_rules;
DROP TABLE IF EXISTS internal_order_texts;
DROP TABLE IF EXISTS internal_orders;
DROP TABLE IF EXISTS cost_center_activity_rates;
DROP TABLE IF EXISTS activity_type_texts;
DROP TABLE IF EXISTS activity_types;
DROP TABLE IF EXISTS cost_element_texts;
DROP TABLE IF EXISTS cost_elements;
