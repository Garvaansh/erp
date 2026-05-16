-- +goose Up
-- +goose StatementBegin

CREATE TABLE production_runs (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_sequence       BIGSERIAL    UNIQUE,
    output_item_id      UUID         NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    operator_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
    workstation        VARCHAR(100),
    input_qty          NUMERIC(18,4) NOT NULL,
    output_qty         NUMERIC(18,4) NOT NULL,
    scrap_qty          NUMERIC(18,4) NOT NULL DEFAULT 0,
    shortlength_qty    NUMERIC(18,4) NOT NULL DEFAULT 0,
    process_loss_qty   NUMERIC(18,4) NOT NULL DEFAULT 0,
    status             VARCHAR(50)  NOT NULL DEFAULT 'COMPLETED',
    notes              TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT production_runs_input_qty_nonnegative        CHECK (input_qty >= 0),
    CONSTRAINT production_runs_output_qty_nonnegative       CHECK (output_qty >= 0),
    CONSTRAINT production_runs_scrap_qty_nonnegative        CHECK (scrap_qty >= 0),
    CONSTRAINT production_runs_shortlength_qty_nonnegative  CHECK (shortlength_qty >= 0),
    CONSTRAINT production_runs_process_loss_qty_nonnegative CHECK (process_loss_qty >= 0)
);

CREATE TABLE batch_consumptions (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    production_run_id       UUID          NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
    source_batch_id         UUID          NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
    target_batch_id         UUID          REFERENCES inventory_batches(id) ON DELETE SET NULL,
    quantity_consumed       NUMERIC(18,4) NOT NULL,
    batch_remaining_before  NUMERIC(18,4) NOT NULL,
    batch_remaining_after   NUMERIC(18,4) NOT NULL,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT batch_consumptions_quantity_consumed_positive             CHECK (quantity_consumed > 0),
    CONSTRAINT batch_consumptions_batch_remaining_before_nonnegative    CHECK (batch_remaining_before >= 0),
    CONSTRAINT batch_consumptions_batch_remaining_after_nonnegative     CHECK (batch_remaining_after >= 0),
    CONSTRAINT batch_consumptions_remaining_after_lte_before            CHECK (batch_remaining_after <= batch_remaining_before)
);

CREATE INDEX idx_inventory_fifo_lookup
ON inventory_batches (item_id, status, created_at ASC, id);

CREATE INDEX idx_production_runs_output_item_id ON production_runs(output_item_id);
CREATE INDEX idx_production_runs_operator_id    ON production_runs(operator_id);
CREATE INDEX idx_production_runs_created_at     ON production_runs(created_at);

CREATE UNIQUE INDEX idx_batch_consumptions_unique_with_target
ON batch_consumptions(production_run_id, source_batch_id, target_batch_id)
WHERE target_batch_id IS NOT NULL;

CREATE UNIQUE INDEX idx_batch_consumptions_unique_without_target
ON batch_consumptions(production_run_id, source_batch_id)
WHERE target_batch_id IS NULL;

CREATE INDEX idx_batch_consumptions_production_run_id ON batch_consumptions(production_run_id);
CREATE INDEX idx_batch_consumptions_source_batch_id   ON batch_consumptions(source_batch_id);
CREATE INDEX idx_batch_consumptions_target_batch_id   ON batch_consumptions(target_batch_id);
CREATE INDEX idx_batch_consumptions_lineage           ON batch_consumptions(target_batch_id, source_batch_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_batch_consumptions_lineage;
DROP INDEX IF EXISTS idx_batch_consumptions_target_batch_id;
DROP INDEX IF EXISTS idx_batch_consumptions_source_batch_id;
DROP INDEX IF EXISTS idx_batch_consumptions_production_run_id;
DROP INDEX IF EXISTS idx_batch_consumptions_unique_without_target;
DROP INDEX IF EXISTS idx_batch_consumptions_unique_with_target;
DROP INDEX IF EXISTS idx_production_runs_created_at;
DROP INDEX IF EXISTS idx_production_runs_operator_id;
DROP INDEX IF EXISTS idx_production_runs_output_item_id;

DROP TABLE IF EXISTS batch_consumptions;
DROP TABLE IF EXISTS production_runs;

DROP INDEX IF EXISTS idx_inventory_fifo_lookup;

-- +goose StatementEnd
