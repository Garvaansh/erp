-- +goose Up
CREATE TABLE customers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name         VARCHAR(255) NOT NULL,
    normalized_name      VARCHAR(255) NOT NULL,
    phone_number         VARCHAR(30),
    normalized_phone     VARCHAR(30),
    whatsapp_number      VARCHAR(30),
    normalized_whatsapp  VARCHAR(30),
    email                VARCHAR(255),
    gst_number           VARCHAR(30),
    normalized_gst       VARCHAR(30),
    company_name         VARCHAR(255),
    notes                TEXT,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_display_name_not_blank_chk CHECK (BTRIM(display_name) <> ''),
    CONSTRAINT customers_normalized_name_not_blank_chk CHECK (BTRIM(normalized_name) <> ''),
    CONSTRAINT customers_phone_number_not_blank_chk CHECK (phone_number IS NULL OR BTRIM(phone_number) <> ''),
    CONSTRAINT customers_normalized_phone_format_chk CHECK (
        normalized_phone IS NULL OR normalized_phone ~ '^\+91[0-9]{10}$'
    ),
    CONSTRAINT customers_whatsapp_number_not_blank_chk CHECK (whatsapp_number IS NULL OR BTRIM(whatsapp_number) <> ''),
    CONSTRAINT customers_normalized_whatsapp_format_chk CHECK (
        normalized_whatsapp IS NULL OR normalized_whatsapp ~ '^\+91[0-9]{10}$'
    ),
    CONSTRAINT customers_email_not_blank_chk CHECK (email IS NULL OR BTRIM(email) <> ''),
    CONSTRAINT customers_gst_number_not_blank_chk CHECK (gst_number IS NULL OR BTRIM(gst_number) <> ''),
    CONSTRAINT customers_normalized_gst_format_chk CHECK (
        normalized_gst IS NULL OR normalized_gst ~ '^[0-9A-Z]{15}$'
    ),
    CONSTRAINT customers_company_name_not_blank_chk CHECK (company_name IS NULL OR BTRIM(company_name) <> '')
);

CREATE INDEX idx_customers_normalized_name
ON customers (normalized_name);

CREATE INDEX idx_customers_company_name_lower
ON customers (LOWER(company_name));

CREATE INDEX idx_customers_normalized_phone
ON customers (normalized_phone);

CREATE INDEX idx_customers_normalized_whatsapp
ON customers (normalized_whatsapp);

CREATE INDEX idx_customers_normalized_gst
ON customers (normalized_gst);

CREATE INDEX idx_customers_active_created
ON customers (is_active, created_at DESC, id DESC);

CREATE UNIQUE INDEX idx_customers_normalized_phone_unique
ON customers (normalized_phone)
WHERE normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX idx_customers_normalized_whatsapp_unique
ON customers (normalized_whatsapp)
WHERE normalized_whatsapp IS NOT NULL;

CREATE UNIQUE INDEX idx_customers_normalized_gst_unique
ON customers (normalized_gst)
WHERE normalized_gst IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_customers_normalized_gst_unique;
DROP INDEX IF EXISTS idx_customers_normalized_whatsapp_unique;
DROP INDEX IF EXISTS idx_customers_normalized_phone_unique;
DROP INDEX IF EXISTS idx_customers_active_created;
DROP INDEX IF EXISTS idx_customers_normalized_gst;
DROP INDEX IF EXISTS idx_customers_normalized_whatsapp;
DROP INDEX IF EXISTS idx_customers_normalized_phone;
DROP INDEX IF EXISTS idx_customers_company_name_lower;
DROP INDEX IF EXISTS idx_customers_normalized_name;
DROP TABLE IF EXISTS customers;
