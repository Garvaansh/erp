-- +goose Up
-- Inventory extensions: material documents, physical inventory, reservation items, serial numbers

CREATE TABLE material_document_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_number VARCHAR(30) NOT NULL,
    fiscal_year INT NOT NULL,
    document_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    document_type VARCHAR(10) NOT NULL DEFAULT 'WE',  -- WE=goods movement
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, document_number, fiscal_year)
);
CREATE INDEX idx_material_document_headers_tenant ON material_document_headers(tenant_id);
CREATE INDEX idx_material_document_headers_posting ON material_document_headers(tenant_id, posting_date DESC);

CREATE TABLE material_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_header_id UUID NOT NULL REFERENCES material_document_headers(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    movement_type VARCHAR(10) NOT NULL,  -- 101=GR, 201=GI, 301=transfer, etc.
    quantity DECIMAL(12, 4) NOT NULL,
    unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'EA',
    reference_id UUID,
    reference_type VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_header_id, line_number)
);
CREATE INDEX idx_material_document_items_doc ON material_document_items(document_header_id);
CREATE INDEX idx_material_document_items_product ON material_document_items(product_id);
CREATE INDEX idx_material_document_items_warehouse ON material_document_items(warehouse_id);

CREATE TABLE reservation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    requirement_date DATE NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    quantity_withdrawn DECIMAL(12, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, reservation_id, product_id, requirement_date)
);
CREATE INDEX idx_reservation_items_reservation ON reservation_items(reservation_id);
CREATE INDEX idx_reservation_items_tenant ON reservation_items(tenant_id);

CREATE TABLE physical_inventory_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_number VARCHAR(30) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    count_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN, COUNTED, POSTED
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, document_number)
);
CREATE INDEX idx_physical_inventory_headers_tenant ON physical_inventory_headers(tenant_id);
CREATE INDEX idx_physical_inventory_headers_warehouse ON physical_inventory_headers(warehouse_id);

CREATE TABLE physical_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    physical_inventory_header_id UUID NOT NULL REFERENCES physical_inventory_headers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    book_quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    counted_quantity DECIMAL(12, 4),
    difference DECIMAL(12, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, physical_inventory_header_id, product_id, batch_id)
);
CREATE INDEX idx_physical_inventory_items_header ON physical_inventory_items(physical_inventory_header_id);

CREATE TABLE inventory_cycle_count_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    cycle_count_indicator VARCHAR(20) NOT NULL DEFAULT 'ABC',  -- ABC classification
    count_frequency_days INT NOT NULL DEFAULT 30,
    last_count_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, warehouse_id)
);
CREATE INDEX idx_inventory_cycle_count_schedules_tenant ON inventory_cycle_count_schedules(tenant_id);

CREATE TABLE serial_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    serial_number VARCHAR(80) NOT NULL,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',  -- AVAILABLE, IN_USE, SCRAPPED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, serial_number)
);
CREATE INDEX idx_serial_numbers_tenant ON serial_numbers(tenant_id);
CREATE INDEX idx_serial_numbers_product ON serial_numbers(product_id);

CREATE TABLE serial_number_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    serial_number_id UUID NOT NULL REFERENCES serial_numbers(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL,
    from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    reference_id UUID,
    reference_type VARCHAR(30),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_serial_number_history_serial ON serial_number_history(serial_number_id);
CREATE INDEX idx_serial_number_history_tenant ON serial_number_history(tenant_id);

CREATE TABLE inventory_revaluation_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    revaluation_number VARCHAR(30) NOT NULL,
    revaluation_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, revaluation_number)
);
CREATE INDEX idx_inventory_revaluation_headers_tenant ON inventory_revaluation_headers(tenant_id);

CREATE TABLE inventory_revaluation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    revaluation_header_id UUID NOT NULL REFERENCES inventory_revaluation_headers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    old_price DECIMAL(18, 4) NOT NULL,
    new_price DECIMAL(18, 4) NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, revaluation_header_id, product_id, warehouse_id)
);
CREATE INDEX idx_inventory_revaluation_items_header ON inventory_revaluation_items(revaluation_header_id);

-- +goose Down
DROP TABLE IF EXISTS inventory_revaluation_items;
DROP TABLE IF EXISTS inventory_revaluation_headers;
DROP TABLE IF EXISTS serial_number_history;
DROP TABLE IF EXISTS serial_numbers;
DROP TABLE IF EXISTS inventory_cycle_count_schedules;
DROP TABLE IF EXISTS physical_inventory_items;
DROP TABLE IF EXISTS physical_inventory_headers;
DROP TABLE IF EXISTS reservation_items;
DROP TABLE IF EXISTS material_document_items;
DROP TABLE IF EXISTS material_document_headers;
