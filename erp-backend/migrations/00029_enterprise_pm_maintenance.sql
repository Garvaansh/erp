-- +goose Up
-- Plant Maintenance (PM): functional locations, equipment, maintenance plans, maintenance orders

CREATE TABLE functional_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES functional_locations(id) ON DELETE SET NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_functional_locations_tenant ON functional_locations(tenant_id);
CREATE INDEX idx_functional_locations_parent ON functional_locations(parent_id);
CREATE INDEX idx_functional_locations_plant ON functional_locations(plant_id);

CREATE TABLE equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipment_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    functional_location_id UUID REFERENCES functional_locations(id) ON DELETE SET NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    serial_number VARCHAR(80),
    warranty_expiry DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPERATIONAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, equipment_number)
);
CREATE INDEX idx_equipments_tenant ON equipments(tenant_id);
CREATE INDEX idx_equipments_functional_location ON equipments(functional_location_id);
CREATE INDEX idx_equipments_plant ON equipments(plant_id);

CREATE TABLE maintenance_plan_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    strategy VARCHAR(20) NOT NULL DEFAULT 'TIME_BASED',  -- TIME_BASED, PERFORMANCE_BASED
    cycle_length INT,
    cycle_unit VARCHAR(10),  -- DAY, WEEK, MONTH
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, plan_number)
);
CREATE INDEX idx_maintenance_plan_headers_tenant ON maintenance_plan_headers(tenant_id);

CREATE TABLE maintenance_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_header_id UUID NOT NULL REFERENCES maintenance_plan_headers(id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL,
    description VARCHAR(255),
    interval_value INT NOT NULL,
    interval_unit VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, plan_header_id, activity_type)
);
CREATE INDEX idx_maintenance_plan_items_plan ON maintenance_plan_items(plan_header_id);

CREATE TABLE maintenance_task_list_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_list_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, task_list_number)
);
CREATE INDEX idx_maintenance_task_list_headers_tenant ON maintenance_task_list_headers(tenant_id);

CREATE TABLE maintenance_task_list_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_list_header_id UUID NOT NULL REFERENCES maintenance_task_list_headers(id) ON DELETE CASCADE,
    operation_number INT NOT NULL,
    work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL,
    description VARCHAR(255),
    duration_minutes DECIMAL(12, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, task_list_header_id, operation_number)
);
CREATE INDEX idx_maintenance_task_list_operations_task_list ON maintenance_task_list_operations(task_list_header_id);

CREATE TABLE maintenance_order_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number VARCHAR(30) NOT NULL,
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    functional_location_id UUID REFERENCES functional_locations(id) ON DELETE SET NULL,
    plan_header_id UUID REFERENCES maintenance_plan_headers(id) ON DELETE SET NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'PM',  -- PM, CM (corrective)
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED',  -- CREATED, RELEASED, IN_PROGRESS, COMPLETED
    priority VARCHAR(10) NOT NULL DEFAULT '2',  -- 1=high, 2=medium, 3=low
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, order_number)
);
CREATE INDEX idx_maintenance_order_headers_tenant ON maintenance_order_headers(tenant_id);
CREATE INDEX idx_maintenance_order_headers_equipment ON maintenance_order_headers(equipment_id);

CREATE TABLE maintenance_order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_header_id UUID NOT NULL REFERENCES maintenance_order_headers(id) ON DELETE CASCADE,
    operation_number INT NOT NULL,
    task_list_operation_id UUID REFERENCES maintenance_task_list_operations(id) ON DELETE SET NULL,
    work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL,
    description VARCHAR(255),
    planned_duration_minutes DECIMAL(12, 4),
    actual_duration_minutes DECIMAL(12, 4),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, order_header_id, operation_number)
);
CREATE INDEX idx_maintenance_order_operations_order ON maintenance_order_operations(order_header_id);

CREATE TABLE maintenance_order_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_header_id UUID NOT NULL REFERENCES maintenance_order_headers(id) ON DELETE CASCADE,
    operation_id UUID REFERENCES maintenance_order_operations(id) ON DELETE SET NULL,
    actual_work_minutes DECIMAL(12, 4) NOT NULL,
    confirmation_text TEXT,
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_maintenance_order_confirmations_order ON maintenance_order_confirmations(order_header_id);

CREATE TABLE meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    counter_type VARCHAR(30) NOT NULL,  -- HOURS, KILOMETERS, etc.
    reading_value DECIMAL(18, 4) NOT NULL,
    reading_date DATE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, equipment_id, counter_type, reading_date)
);
CREATE INDEX idx_meter_readings_equipment ON meter_readings(equipment_id);
CREATE INDEX idx_meter_readings_tenant ON meter_readings(tenant_id);

-- +goose Down
DROP TABLE IF EXISTS meter_readings;
DROP TABLE IF EXISTS maintenance_order_confirmations;
DROP TABLE IF EXISTS maintenance_order_operations;
DROP TABLE IF EXISTS maintenance_order_headers;
DROP TABLE IF EXISTS maintenance_task_list_operations;
DROP TABLE IF EXISTS maintenance_task_list_headers;
DROP TABLE IF EXISTS maintenance_plan_items;
DROP TABLE IF EXISTS maintenance_plan_headers;
DROP TABLE IF EXISTS equipments;
DROP TABLE IF EXISTS functional_locations;
