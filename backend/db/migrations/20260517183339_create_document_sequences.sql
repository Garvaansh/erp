-- +goose Up
-- +goose StatementBegin
CREATE TABLE document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    next_number BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO document_sequences (id, document_type, prefix, next_number)
VALUES (gen_random_uuid(), 'invoice', 'INV-', 1);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE document_sequences;
-- +goose StatementEnd
