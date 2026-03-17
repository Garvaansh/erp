-- +goose Up
-- PP extensions: work centers (additional), capacities, routings, production versions

CREATE TABLE work_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    capacity_unit VARCHAR(10) NOT NULL DEFAULT 'HR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_work_centers_tenant ON work_centers(tenant_id);
CREATE INDEX idx_work_centers_cost_center ON work_centers(cost_center_id);

CREATE TABLE work_center_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    capacity_type VARCHAR(20) NOT NULL DEFAULT 'LABOR',
    available_capacity DECIMAL(12, 4) NOT NULL,
    capacity_unit VARCHAR(10) NOT NULL DEFAULT 'HR',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, work_center_id, capacity_type, valid_from)
);
CREATE INDEX idx_work_center_capacities_work_center ON work_center_capacities(work_center_id);

CREATE TABLE routings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    routing_number VARCHAR(30) NOT NULL,
    version VARCHAR(10) NOT NULL DEFAULT '01',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id, routing_number, version)
);
CREATE INDEX idx_routings_tenant ON routings(tenant_id);
CREATE INDEX idx_routings_product ON routings(product_id);
CREATE INDEX idx_routings_plant ON routings(plant_id);

CREATE TABLE routing_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    routing_id UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    operation_number INT NOT NULL,
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE RESTRICT,
    description VARCHAR(255),
    standard_duration_minutes DECIMAL(12, 4) NOT NULL,
    setup_time_minutes DECIMAL(12, 4) NOT NULL DEFAULT 0,
    machine_time_minutes DECIMAL(12, 4) NOT NULL DEFAULT 0,
    labor_time_minutes DECIMAL(12, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, routing_id, operation_number)
);
CREATE INDEX idx_routing_operations_routing ON routing_operations(routing_id);
CREATE INDEX idx_routing_operations_work_center ON routing_operations(work_center_id);

CREATE TABLE routing_operation_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    routing_operation_id UUID NOT NULL REFERENCES routing_operations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 4) NOT NULL,
    component_scrap_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, routing_operation_id, product_id)
);
CREATE INDEX idx_routing_operation_materials_operation ON routing_operation_materials(routing_operation_id);

CREATE TABLE production_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    bom_id UUID REFERENCES bom(id) ON DELETE SET NULL,
    routing_id UUID REFERENCES routings(id) ON DELETE SET NULL,
    version VARCHAR(10) NOT NULL DEFAULT '01',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, plant_id, version)
);
CREATE INDEX idx_production_versions_tenant ON production_versions(tenant_id);
CREATE INDEX idx_production_versions_product ON production_versions(product_id);

CREATE TABLE capacity_planning_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_number VARCHAR(30) NOT NULL,
    plan_date DATE NOT NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, plan_number)
);
CREATE INDEX idx_capacity_planning_headers_tenant ON capacity_planning_headers(tenant_id);

CREATE TABLE capacity_planning_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_header_id UUID NOT NULL REFERENCES capacity_planning_headers(id) ON DELETE CASCADE,
    work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
    planning_date DATE NOT NULL,
    planned_load DECIMAL(12, 4) NOT NULL,
    available_capacity DECIMAL(12, 4) NOT NULL,
    capacity_unit VARCHAR(10) NOT NULL DEFAULT 'HR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, plan_header_id, work_center_id, planning_date)
);
CREATE INDEX idx_capacity_planning_items_plan ON capacity_planning_items(plan_header_id);

CREATE TABLE operation_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    routing_operation_id UUID REFERENCES routing_operations(id) ON DELETE SET NULL,
    confirmed_quantity DECIMAL(12, 4) NOT NULL,
    yield_quantity DECIMAL(12, 4),
    scrap_quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    labor_time_minutes DECIMAL(12, 4),
    machine_time_minutes DECIMAL(12, 4),
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_operation_confirmations_work_order ON operation_confirmations(work_order_id);

-- +goose Down
DROP TABLE IF EXISTS operation_confirmations;
DROP TABLE IF EXISTS capacity_planning_items;
DROP TABLE IF EXISTS capacity_planning_headers;
DROP TABLE IF EXISTS production_versions;
DROP TABLE IF EXISTS routing_operation_materials;
DROP TABLE IF EXISTS routing_operations;
DROP TABLE IF EXISTS routings;
DROP TABLE IF EXISTS work_center_capacities;
DROP TABLE IF EXISTS work_centers;
