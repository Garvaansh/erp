-- +goose Up
-- Enterprise organizational structure (SAP-style: company codes, plants, storage locations, purchasing/sales orgs)

-- Company code (legal entity for FI)
CREATE TABLE company_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    country_code VARCHAR(3) NOT NULL DEFAULT 'IN',
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_company_codes_tenant ON company_codes(tenant_id);

CREATE TABLE company_code_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(company_code_id, language_code)
);

-- Plant (manufacturing/site)
CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_code_id UUID REFERENCES company_codes(id) ON DELETE SET NULL,
    time_zone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_plants_tenant ON plants(tenant_id);
CREATE INDEX idx_plants_company_code ON plants(company_code_id);

CREATE TABLE plant_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(plant_id, language_code)
);

-- Storage location (within plant; can map to warehouse)
CREATE TABLE storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, plant_id, code)
);
CREATE INDEX idx_storage_locations_tenant ON storage_locations(tenant_id);
CREATE INDEX idx_storage_locations_plant ON storage_locations(plant_id);

CREATE TABLE storage_location_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_location_id UUID NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(storage_location_id, language_code)
);

-- Purchasing organization
CREATE TABLE purchasing_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_code_id UUID REFERENCES company_codes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_purchasing_organizations_tenant ON purchasing_organizations(tenant_id);

CREATE TABLE purchasing_org_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(purchasing_organization_id, language_code)
);

-- Sales organization
CREATE TABLE sales_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_code_id UUID REFERENCES company_codes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_sales_organizations_tenant ON sales_organizations(tenant_id);

CREATE TABLE sales_org_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_organization_id UUID NOT NULL REFERENCES sales_organizations(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(sales_organization_id, language_code)
);

-- Distribution channel
CREATE TABLE distribution_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_distribution_channels_tenant ON distribution_channels(tenant_id);

-- Division (product division)
CREATE TABLE divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_divisions_tenant ON divisions(tenant_id);

-- Assignment: plant ↔ purchasing org
CREATE TABLE plant_purchasing_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, plant_id, purchasing_organization_id)
);
CREATE INDEX idx_plant_purchasing_org_tenant ON plant_purchasing_org(tenant_id);

-- Assignment: plant ↔ sales org
CREATE TABLE plant_sales_org (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    sales_organization_id UUID NOT NULL REFERENCES sales_organizations(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, plant_id, sales_organization_id)
);
CREATE INDEX idx_plant_sales_org_tenant ON plant_sales_org(tenant_id);

-- Assignment: company code ↔ plant
CREATE TABLE company_code_plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, company_code_id, plant_id)
);
CREATE INDEX idx_company_code_plants_tenant ON company_code_plants(tenant_id);

-- +goose Down
DROP TABLE IF EXISTS company_code_plants;
DROP TABLE IF EXISTS plant_sales_org;
DROP TABLE IF EXISTS plant_purchasing_org;
DROP TABLE IF EXISTS divisions;
DROP TABLE IF EXISTS distribution_channels;
DROP TABLE IF EXISTS sales_org_texts;
DROP TABLE IF EXISTS sales_organizations;
DROP TABLE IF EXISTS purchasing_org_texts;
DROP TABLE IF EXISTS purchasing_organizations;
DROP TABLE IF EXISTS storage_location_texts;
DROP TABLE IF EXISTS storage_locations;
DROP TABLE IF EXISTS plant_texts;
DROP TABLE IF EXISTS plants;
DROP TABLE IF EXISTS company_code_texts;
DROP TABLE IF EXISTS company_codes;
