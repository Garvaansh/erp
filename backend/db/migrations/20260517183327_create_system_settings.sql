-- +goose Up
-- +goose StatementBegin
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT system_settings_category_key_key UNIQUE (category, key)
);

CREATE INDEX idx_system_settings_category_key ON system_settings (category, key);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE system_settings;
-- +goose StatementEnd
