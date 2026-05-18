-- +goose Up
-- +goose StatementBegin
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    snapshot JSONB NOT NULL,
    generated_by UUID,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_order_id ON invoices (order_id);
CREATE INDEX idx_invoices_invoice_number ON invoices (invoice_number);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE invoices;
-- +goose StatementEnd
