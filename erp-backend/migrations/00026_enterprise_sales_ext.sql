-- +goose Up
-- Sales (SD) extensions: sales areas, schedule lines, partners, conditions, delivery/billing docs

CREATE TABLE sales_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sales_organization_id UUID NOT NULL REFERENCES sales_organizations(id) ON DELETE CASCADE,
    distribution_channel_id UUID NOT NULL REFERENCES distribution_channels(id) ON DELETE CASCADE,
    division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, sales_organization_id, distribution_channel_id, division_id)
);
CREATE INDEX idx_sales_areas_tenant ON sales_areas(tenant_id);

CREATE TABLE sales_order_schedule_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL,
    schedule_line_number INT NOT NULL,
    requested_delivery_date DATE NOT NULL,
    confirmed_quantity DECIMAL(12, 4) NOT NULL,
    confirmed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, sales_order_id, schedule_line_number)
);
CREATE INDEX idx_sales_order_schedule_lines_so ON sales_order_schedule_lines(sales_order_id);
CREATE INDEX idx_sales_order_schedule_lines_tenant ON sales_order_schedule_lines(tenant_id);

CREATE TABLE sales_order_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    partner_function VARCHAR(10) NOT NULL,  -- SOLD_TO, SHIP_TO, BILL_TO, PAYER
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, sales_order_id, partner_function)
);
CREATE INDEX idx_sales_order_partners_so ON sales_order_partners(sales_order_id);
CREATE INDEX idx_sales_order_partners_tenant ON sales_order_partners(tenant_id);

CREATE TABLE pricing_condition_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    calculation_type VARCHAR(5) NOT NULL DEFAULT 'A',  -- A=amount, B=percent
    plus_minus VARCHAR(1) NOT NULL DEFAULT '+',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_pricing_condition_types_tenant ON pricing_condition_types(tenant_id);

CREATE TABLE condition_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    condition_type_id UUID NOT NULL REFERENCES pricing_condition_types(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    sales_organization_id UUID REFERENCES sales_organizations(id) ON DELETE SET NULL,
    distribution_channel_id UUID REFERENCES distribution_channels(id) ON DELETE SET NULL,
    amount DECIMAL(18, 4),
    percent DECIMAL(8, 4),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, condition_type_id, product_id, customer_id, sales_organization_id, distribution_channel_id, valid_from)
);
CREATE INDEX idx_condition_records_tenant ON condition_records(tenant_id);
CREATE INDEX idx_condition_records_product ON condition_records(product_id);
CREATE INDEX idx_condition_records_customer ON condition_records(customer_id);

CREATE TABLE customer_material_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_material_number VARCHAR(40),
    customer_material_description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, customer_id, product_id)
);
CREATE INDEX idx_customer_material_info_tenant ON customer_material_info(tenant_id);
CREATE INDEX idx_customer_material_info_customer ON customer_material_info(customer_id);

CREATE TABLE delivery_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_delivery_blocks_tenant ON delivery_blocks(tenant_id);

CREATE TABLE billing_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_billing_blocks_tenant ON billing_blocks(tenant_id);

CREATE TABLE delivery_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    delivery_number VARCHAR(30) NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    delivery_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, delivery_number)
);
CREATE INDEX idx_delivery_headers_tenant ON delivery_headers(tenant_id);
CREATE INDEX idx_delivery_headers_so ON delivery_headers(sales_order_id);

CREATE TABLE delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    delivery_header_id UUID NOT NULL REFERENCES delivery_headers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 4) NOT NULL,
    sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, delivery_header_id, product_id, sales_order_item_id)
);
CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_header_id);

CREATE TABLE billing_document_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    billing_number VARCHAR(30) NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    billing_date DATE NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, billing_number)
);
CREATE INDEX idx_billing_document_headers_tenant ON billing_document_headers(tenant_id);
CREATE INDEX idx_billing_document_headers_customer ON billing_document_headers(customer_id);

CREATE TABLE billing_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    billing_header_id UUID NOT NULL REFERENCES billing_document_headers(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    description VARCHAR(255),
    quantity DECIMAL(12, 4) NOT NULL,
    unit_price DECIMAL(18, 4) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, billing_header_id, line_number)
);
CREATE INDEX idx_billing_document_items_billing ON billing_document_items(billing_header_id);

-- +goose Down
DROP TABLE IF EXISTS billing_document_items;
DROP TABLE IF EXISTS billing_document_headers;
DROP TABLE IF EXISTS delivery_items;
DROP TABLE IF EXISTS delivery_headers;
DROP TABLE IF EXISTS billing_blocks;
DROP TABLE IF EXISTS delivery_blocks;
DROP TABLE IF EXISTS customer_material_info;
DROP TABLE IF EXISTS condition_records;
DROP TABLE IF EXISTS pricing_condition_types;
DROP TABLE IF EXISTS sales_order_partners;
DROP TABLE IF EXISTS sales_order_schedule_lines;
DROP TABLE IF EXISTS sales_areas;