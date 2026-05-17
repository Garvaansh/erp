-- +goose Up
CREATE TABLE customer_aliases (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    alias             VARCHAR(255) NOT NULL,
    normalized_alias  VARCHAR(255) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_aliases_alias_not_blank_chk CHECK (BTRIM(alias) <> ''),
    CONSTRAINT customer_aliases_normalized_alias_not_blank_chk CHECK (BTRIM(normalized_alias) <> '')
);

CREATE INDEX idx_customer_aliases_customer_id
ON customer_aliases (customer_id);

CREATE INDEX idx_customer_aliases_normalized_alias
ON customer_aliases (normalized_alias);

CREATE UNIQUE INDEX idx_customer_aliases_customer_normalized_alias_unique
ON customer_aliases (customer_id, normalized_alias);

-- +goose Down
DROP INDEX IF EXISTS idx_customer_aliases_customer_normalized_alias_unique;
DROP INDEX IF EXISTS idx_customer_aliases_normalized_alias;
DROP INDEX IF EXISTS idx_customer_aliases_customer_id;
DROP TABLE IF EXISTS customer_aliases;
