-- +goose Up
CREATE TABLE report_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    report_type VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    export_format VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_access_log_tenant_created ON report_access_log(tenant_id, created_at DESC);

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    export_format VARCHAR(20) NOT NULL DEFAULT 'csv',
    recipient_email VARCHAR(255) NOT NULL,
    parameters JSONB DEFAULT '{}',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE next_run_at IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS report_access_log;
DROP TABLE IF EXISTS scheduled_reports;
