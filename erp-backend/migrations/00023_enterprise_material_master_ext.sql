-- +goose Up
-- Material master extensions: material groups, types, product descriptions, plant/sloc data, valuations, UOM conversions

CREATE TABLE material_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_group_id UUID REFERENCES material_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_material_groups_tenant ON material_groups(tenant_id);

CREATE TABLE material_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_material_types_tenant ON material_types(tenant_id);

CREATE TABLE valuation_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_code_id UUID REFERENCES company_codes(id) ON DELETE SET NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_valuation_areas_tenant ON valuation_areas(tenant_id);

CREATE TABLE product_descriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    short_text VARCHAR(40),
    long_text TEXT,
    UNIQUE(tenant_id, product_id, language_code)
);
CREATE INDEX idx_product_descriptions_tenant ON product_descriptions(tenant_id);
CREATE INDEX idx_product_descriptions_product ON product_descriptions(product_id);

CREATE TABLE product_plant_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    mrp_type VARCHAR(10),
    lot_size VARCHAR(10),
    planning_delivery_time_days INT,
    gr_processing_time_days INT,
    safety_stock DECIMAL(12, 4),
    reorder_point DECIMAL(12, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id)
);
CREATE INDEX idx_product_plant_data_tenant ON product_plant_data(tenant_id);
CREATE INDEX idx_product_plant_data_product ON product_plant_data(product_id);
CREATE INDEX idx_product_plant_data_plant ON product_plant_data(plant_id);

CREATE TABLE product_storage_location_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    storage_location_id UUID NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
    reorder_point DECIMAL(12, 4),
    max_stock DECIMAL(12, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id, storage_location_id)
);
CREATE INDEX idx_product_storage_location_data_tenant ON product_storage_location_data(tenant_id);
CREATE INDEX idx_product_storage_location_data_product ON product_storage_location_data(product_id);

CREATE TABLE product_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    valuation_area_id UUID NOT NULL REFERENCES valuation_areas(id) ON DELETE CASCADE,
    valuation_type VARCHAR(10) NOT NULL DEFAULT 'S',  -- S=standard, V=moving average
    standard_price DECIMAL(18, 4),
    moving_average_price DECIMAL(18, 4),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    price_control VARCHAR(1) NOT NULL DEFAULT 'S',  -- S=standard, V=moving
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, valuation_area_id)
);
CREATE INDEX idx_product_valuations_tenant ON product_valuations(tenant_id);
CREATE INDEX idx_product_valuations_product ON product_valuations(product_id);
CREATE INDEX idx_product_valuations_valuation_area ON product_valuations(valuation_area_id);

CREATE TABLE product_uom_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alternate_uom VARCHAR(10) NOT NULL,
    numerator DECIMAL(18, 6) NOT NULL,
    denominator DECIMAL(18, 6) NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, alternate_uom)
);
CREATE INDEX idx_product_uom_conversions_tenant ON product_uom_conversions(tenant_id);
CREATE INDEX idx_product_uom_conversions_product ON product_uom_conversions(product_id);

CREATE TABLE product_sales_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sales_organization_id UUID NOT NULL REFERENCES sales_organizations(id) ON DELETE CASCADE,
    distribution_channel_id UUID NOT NULL REFERENCES distribution_channels(id) ON DELETE CASCADE,
    min_order_quantity DECIMAL(12, 4),
    delivery_group VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, sales_organization_id, distribution_channel_id)
);
CREATE INDEX idx_product_sales_data_tenant ON product_sales_data(tenant_id);
CREATE INDEX idx_product_sales_data_product ON product_sales_data(product_id);

CREATE TABLE product_purchasing_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchasing_organization_id UUID NOT NULL REFERENCES purchasing_organizations(id) ON DELETE CASCADE,
    planning_delivery_time_days INT,
    gr_processing_time_days INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, purchasing_organization_id)
);
CREATE INDEX idx_product_purchasing_data_tenant ON product_purchasing_data(tenant_id);
CREATE INDEX idx_product_purchasing_data_product ON product_purchasing_data(product_id);

CREATE TABLE product_supply_source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    supply_type VARCHAR(10) NOT NULL DEFAULT 'E',  -- E=external (buy), M=make
    default_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id)
);
CREATE INDEX idx_product_supply_source_tenant ON product_supply_source(tenant_id);
CREATE INDEX idx_product_supply_source_product ON product_supply_source(product_id);

-- +goose Down
DROP TABLE IF EXISTS product_supply_source;
DROP TABLE IF EXISTS product_purchasing_data;
DROP TABLE IF EXISTS product_sales_data;
DROP TABLE IF EXISTS product_uom_conversions;
DROP TABLE IF EXISTS product_valuations;
DROP TABLE IF EXISTS product_storage_location_data;
DROP TABLE IF EXISTS product_plant_data;
DROP TABLE IF EXISTS product_descriptions;
DROP TABLE IF EXISTS valuation_areas;
DROP TABLE IF EXISTS material_types;
DROP TABLE IF EXISTS material_groups;
