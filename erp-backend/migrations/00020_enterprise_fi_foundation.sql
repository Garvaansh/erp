-- +goose Up
-- Finance (FI) foundation: chart of accounts, G/L accounts, fiscal periods, accounting documents, cost/profit centers

-- Chart of accounts
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_chart_of_accounts_tenant ON chart_of_accounts(tenant_id);

CREATE TABLE chart_of_accounts_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_of_accounts_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(chart_of_accounts_id, language_code)
);

-- G/L account master
CREATE TABLE gl_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chart_of_accounts_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
    account_number VARCHAR(20) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'P',  -- P=Profit/Loss, B=Balance sheet
    group_code VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, chart_of_accounts_id, account_number)
);
CREATE INDEX idx_gl_accounts_tenant ON gl_accounts(tenant_id);
CREATE INDEX idx_gl_accounts_chart ON gl_accounts(chart_of_accounts_id);

CREATE TABLE gl_account_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gl_account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    name VARCHAR(255) NOT NULL,
    UNIQUE(gl_account_id, language_code)
);

-- Company-code-specific G/L account config
CREATE TABLE gl_account_company_code (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gl_account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    tax_category VARCHAR(20),
    UNIQUE(tenant_id, gl_account_id, company_code_id)
);
CREATE INDEX idx_gl_account_company_code_tenant ON gl_account_company_code(tenant_id);

-- Fiscal year variant
CREATE TABLE fiscal_year_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    start_month INT NOT NULL DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_fiscal_year_variants_tenant ON fiscal_year_variants(tenant_id);

-- Fiscal periods (posting periods)
CREATE TABLE fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    fiscal_year_variant_id UUID NOT NULL REFERENCES fiscal_year_variants(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_number INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_posting_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(tenant_id, company_code_id, fiscal_year, period_number)
);
CREATE INDEX idx_fiscal_periods_tenant ON fiscal_periods(tenant_id);
CREATE INDEX idx_fiscal_periods_company ON fiscal_periods(company_code_id);

-- Posting period lock
CREATE TABLE posting_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_number INT NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, company_code_id, fiscal_year, period_number)
);
CREATE INDEX idx_posting_period_locks_tenant ON posting_period_locks(tenant_id);

-- Cost center master (before accounting docs so items can reference them)
CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, company_code_id, code)
);
CREATE INDEX idx_cost_centers_tenant ON cost_centers(tenant_id);
CREATE INDEX idx_cost_centers_company ON cost_centers(company_code_id);
CREATE INDEX idx_cost_centers_parent ON cost_centers(parent_cost_center_id);

CREATE TABLE cost_center_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(cost_center_id, language_code)
);

-- Profit center master
CREATE TABLE profit_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_profit_center_id UUID REFERENCES profit_centers(id) ON DELETE SET NULL,
    company_code_id UUID REFERENCES company_codes(id) ON DELETE SET NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);
CREATE INDEX idx_profit_centers_tenant ON profit_centers(tenant_id);
CREATE INDEX idx_profit_centers_parent ON profit_centers(parent_profit_center_id);

CREATE TABLE profit_center_texts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profit_center_id UUID NOT NULL REFERENCES profit_centers(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL DEFAULT 'en',
    description VARCHAR(500),
    UNIQUE(profit_center_id, language_code)
);

-- Cost center → profit center assignment
CREATE TABLE cost_center_profit_center (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    profit_center_id UUID NOT NULL REFERENCES profit_centers(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    UNIQUE(tenant_id, cost_center_id, profit_center_id)
);
CREATE INDEX idx_cost_center_profit_center_tenant ON cost_center_profit_center(tenant_id);

-- Accounting document header (BKPF-style)
CREATE TABLE accounting_document_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_code_id UUID NOT NULL REFERENCES company_codes(id) ON DELETE RESTRICT,
    document_number VARCHAR(30) NOT NULL,
    fiscal_year INT NOT NULL,
    posting_date DATE NOT NULL,
    document_date DATE,
    document_type VARCHAR(10) NOT NULL DEFAULT 'SA',  -- SA=G/L, KR=Vendor, DR=Customer
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, company_code_id, document_number, fiscal_year)
);
CREATE INDEX idx_accounting_document_headers_tenant ON accounting_document_headers(tenant_id);
CREATE INDEX idx_accounting_document_headers_company ON accounting_document_headers(company_code_id);
CREATE INDEX idx_accounting_document_headers_posting ON accounting_document_headers(tenant_id, posting_date DESC);

-- Accounting document item (BSEG-style)
CREATE TABLE accounting_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_header_id UUID NOT NULL REFERENCES accounting_document_headers(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    gl_account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(18, 2) NOT NULL,
    debit_credit VARCHAR(1) NOT NULL,  -- D or C
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
    profit_center_id UUID REFERENCES profit_centers(id) ON DELETE SET NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    text VARCHAR(255),
    UNIQUE(document_header_id, line_number)
);
CREATE INDEX idx_accounting_document_items_doc ON accounting_document_items(document_header_id);
CREATE INDEX idx_accounting_document_items_gl ON accounting_document_items(gl_account_id);

-- Document line account assignment (internal order, etc.)
CREATE TABLE document_line_account_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_item_id UUID NOT NULL REFERENCES accounting_document_items(id) ON DELETE CASCADE,
    assignment_type VARCHAR(20) NOT NULL,  -- INTERNAL_ORDER, PROJECT, etc.
    assignment_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_document_line_assignments_item ON document_line_account_assignments(document_item_id);

-- Fix FK: accounting_document_items references cost_centers and profit_centers which are created after; reorder so cost_centers and profit_centers come before accounting_document_items
-- We need to move cost_centers and profit_centers creation BEFORE accounting_document_headers. So: chart_of_accounts, gl_accounts, fiscal_year_variants, fiscal_periods, posting_period_locks, cost_centers, profit_centers, cost_center_profit_center, accounting_document_headers, accounting_document_items, document_line_account_assignments.
-- Already ordered correctly: cost_centers and profit_centers are before accounting_document_items. But accounting_document_items has FK to cost_centers and profit_centers - and cost_centers/profit_centers are created after accounting_document_headers. So we're good - cost_centers and profit_centers exist before accounting_document_items.

-- +goose Down
DROP TABLE IF EXISTS document_line_account_assignments;
DROP TABLE IF EXISTS cost_center_profit_center;
DROP TABLE IF EXISTS profit_center_texts;
DROP TABLE IF EXISTS profit_centers;
DROP TABLE IF EXISTS cost_center_texts;
DROP TABLE IF EXISTS cost_centers;
DROP TABLE IF EXISTS accounting_document_items;
DROP TABLE IF EXISTS accounting_document_headers;
DROP TABLE IF EXISTS posting_period_locks;
DROP TABLE IF EXISTS fiscal_periods;
DROP TABLE IF EXISTS fiscal_year_variants;
DROP TABLE IF EXISTS gl_account_company_code;
DROP TABLE IF EXISTS gl_account_texts;
DROP TABLE IF EXISTS gl_accounts;
DROP TABLE IF EXISTS chart_of_accounts_texts;
DROP TABLE IF EXISTS chart_of_accounts;
