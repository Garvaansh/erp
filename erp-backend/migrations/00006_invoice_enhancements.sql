-- +goose Up
-- Invoice line items for itemized invoices (production-ready)
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_line DECIMAL(15, 2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- Sequential invoice number per tenant per year (legal/compliance)
CREATE TABLE invoice_number_sequences (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year INT NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, year)
);

-- +goose Down
DROP TABLE IF EXISTS invoice_line_items;
DROP TABLE IF EXISTS invoice_number_sequences;
