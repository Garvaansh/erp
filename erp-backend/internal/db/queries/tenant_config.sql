-- name: GetTenantSettings :one
SELECT tenant_id, display_name, fiscal_year_start_month, base_currency, locale, timezone, feature_flags, created_at, updated_at
FROM tenant_settings
WHERE tenant_id = $1 LIMIT 1;

-- name: UpsertTenantSettings :one
INSERT INTO tenant_settings (tenant_id, display_name, fiscal_year_start_month, base_currency, locale, timezone, feature_flags, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
ON CONFLICT (tenant_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  fiscal_year_start_month = EXCLUDED.fiscal_year_start_month,
  base_currency = EXCLUDED.base_currency,
  locale = EXCLUDED.locale,
  timezone = EXCLUDED.timezone,
  feature_flags = EXCLUDED.feature_flags,
  updated_at = CURRENT_TIMESTAMP
RETURNING tenant_id, display_name, fiscal_year_start_month, base_currency, locale, timezone, feature_flags, created_at, updated_at;

-- name: GetDocumentNumberSeries :one
SELECT tenant_id, document_type, year, last_number, prefix
FROM document_number_series
WHERE tenant_id = $1 AND document_type = $2 AND year = $3 LIMIT 1;

-- name: UpsertDocumentNumberSeries :one
INSERT INTO document_number_series (tenant_id, document_type, year, last_number, prefix)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (tenant_id, document_type, year) DO UPDATE SET
  last_number = GREATEST(document_number_series.last_number, EXCLUDED.last_number),
  prefix = EXCLUDED.prefix
RETURNING tenant_id, document_type, year, last_number, prefix;

-- name: GetNextDocumentNumber :one
INSERT INTO document_number_series (tenant_id, document_type, year, last_number, prefix)
VALUES ($1, $2, $3, 1, $4)
ON CONFLICT (tenant_id, document_type, year) DO UPDATE SET last_number = document_number_series.last_number + 1
RETURNING last_number, prefix;

-- name: ListTaxRules :many
SELECT id, tenant_id, name, rate, type, applicable_to, is_default, created_at
FROM tax_rules
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: CreateTaxRule :one
INSERT INTO tax_rules (tenant_id, name, rate, type, applicable_to, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, tenant_id, name, rate, type, applicable_to, is_default, created_at;

-- name: ListCustomFields :many
SELECT id, tenant_id, entity_type, field_name, field_type, sort_order, required, default_value, created_at
FROM custom_fields
WHERE tenant_id = $1 AND entity_type = $2
ORDER BY sort_order ASC, field_name ASC;

-- name: CreateCustomField :one
INSERT INTO custom_fields (tenant_id, entity_type, field_name, field_type, sort_order, required, default_value)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, tenant_id, entity_type, field_name, field_type, sort_order, required, default_value, created_at;
