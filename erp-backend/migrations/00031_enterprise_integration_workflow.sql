-- +goose Up
-- Integration (message log), report variants, export queue, workflow definitions

CREATE TABLE outbound_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL,
    payload JSONB,
    destination VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, FAILED
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_outbound_message_log_tenant ON outbound_message_log(tenant_id);
CREATE INDEX idx_outbound_message_log_created ON outbound_message_log(tenant_id, created_at DESC);

CREATE TABLE inbound_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL,
    payload JSONB,
    source VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_inbound_message_log_tenant ON inbound_message_log(tenant_id);
CREATE INDEX idx_inbound_message_log_created ON inbound_message_log(tenant_id, created_at DESC);

CREATE TABLE interface_mapping_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    source_system VARCHAR(50),
    target_system VARCHAR(50),
    source_field VARCHAR(100) NOT NULL,
    target_field VARCHAR(100) NOT NULL,
    transformation VARCHAR(50),  -- DIRECT, MAP, FORMULA
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, rule_name)
);
CREATE INDEX idx_interface_mapping_rules_tenant ON interface_mapping_rules(tenant_id);

CREATE TABLE report_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, report_type, variant_name)
);
CREATE INDEX idx_report_variants_tenant ON report_variants(tenant_id);
CREATE INDEX idx_report_variants_report_type ON report_variants(report_type);

CREATE TABLE export_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    export_type VARCHAR(50) NOT NULL,
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',  -- QUEUED, RUNNING, COMPLETED, FAILED
    file_path VARCHAR(500),
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
CREATE INDEX idx_export_queue_tenant ON export_queue(tenant_id);
CREATE INDEX idx_export_queue_status ON export_queue(tenant_id, status);
CREATE INDEX idx_export_queue_requested ON export_queue(tenant_id, requested_at DESC);

CREATE TABLE export_queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    export_queue_id UUID NOT NULL REFERENCES export_queue(id) ON DELETE CASCADE,
    record_count INT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_export_queue_items_export ON export_queue_items(export_queue_id);

CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    steps_config JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);

CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    current_step INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',  -- RUNNING, COMPLETED, CANCELLED
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, entity_type, entity_id)
);
CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id);
CREATE INDEX idx_workflow_instances_workflow ON workflow_instances(workflow_definition_id);
CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);

CREATE TABLE integration_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_id UUID,
    error_code VARCHAR(50),
    error_text TEXT NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_integration_errors_tenant ON integration_errors(tenant_id);
CREATE INDEX idx_integration_errors_created ON integration_errors(tenant_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS integration_errors;
DROP TABLE IF EXISTS workflow_instances;
DROP TABLE IF EXISTS workflow_definitions;
DROP TABLE IF EXISTS export_queue_items;
DROP TABLE IF EXISTS export_queue;
DROP TABLE IF EXISTS report_variants;
DROP TABLE IF EXISTS interface_mapping_rules;
DROP TABLE IF EXISTS inbound_message_log;
DROP TABLE IF EXISTS outbound_message_log;
