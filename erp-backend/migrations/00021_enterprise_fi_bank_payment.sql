-- +goose Up
-- FI: Bank masters, bank accounts, payment terms, currency rates

CREATE TABLE bank_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_key VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    swift_code VARCHAR(20),
    country_code VARCHAR(3) NOT NULL DEFAULT 'IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, bank_key)
);
CREATE INDEX idx_bank_masters_tenant ON bank_masters(tenant_id);

CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    bank_master_id UUID NOT NULL REFERENCES bank_masters(id) ON DELETE RESTRICT,
    account_id VARCHAR(40) NOT NULL,
    account_holder VARCHAR(255),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, company_code_id, account_id)
);
CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_company ON bank_accounts(company_code_id);

CREATE TABLE bank_statement_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    statement_number VARCHAR(50) NOT NULL,
    statement_date DATE NOT NULL,
    opening_balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(18, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, bank_account_id, statement_number)
);
CREATE INDEX idx_bank_statement_headers_tenant ON bank_statement_headers(tenant_id);
CREATE INDEX idx_bank_statement_headers_bank ON bank_statement_headers(bank_account_id);

CREATE TABLE bank_statement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    statement_header_id UUID NOT NULL REFERENCES bank_statement_headers(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    value_date DATE NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    debit_credit VARCHAR(1) NOT NULL,
    reference_text VARCHAR(255),
    counterparty_name VARCHAR(255),
    counterparty_account VARCHAR(60),
    UNIQUE(statement_header_id, line_number)
);
CREATE INDEX idx_bank_statement_items_statement ON bank_statement_items(statement_header_id);

CREATE TABLE payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(255),
    days_until_due INT NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5, 2),
    discount_days INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_payment_terms_tenant ON payment_terms(tenant_id);

CREATE TABLE payment_terms_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_terms_id UUID NOT NULL REFERENCES payment_terms(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    name VARCHAR(255),
    UNIQUE(payment_terms_id, language_code)
);

CREATE TABLE currency_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate_date DATE NOT NULL,
    rate DECIMAL(18, 6) NOT NULL,
    rate_type VARCHAR(20) DEFAULT 'M',  -- M=mid, B=buy, S=sell
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, from_currency, to_currency, rate_date, rate_type)
);
CREATE INDEX idx_currency_rates_tenant ON currency_rates(tenant_id);
CREATE INDEX idx_currency_rates_date ON currency_rates(rate_date DESC);

-- +goose Down
DROP TABLE IF EXISTS currency_rates;
DROP TABLE IF EXISTS payment_terms_texts;
DROP TABLE IF EXISTS payment_terms;
DROP TABLE IF EXISTS bank_statement_items;
DROP TABLE IF EXISTS bank_statement_headers;
DROP TABLE IF EXISTS bank_accounts;
DROP TABLE IF EXISTS bank_masters;
