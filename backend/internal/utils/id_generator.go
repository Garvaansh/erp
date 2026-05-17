package utils

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const dayLayout = "060102"

// GenerateProcurementIDs generates PO and TX identifiers that share the same daily sequence.
func GenerateProcurementIDs(ctx context.Context, tx pgx.Tx, vendorCode string) (string, string, error) {
	vendorToken := normalizeVendorCode(vendorCode)
	if vendorToken == "" {
		return "", "", fmt.Errorf("vendor code required for procurement identifier generation")
	}

	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"procurement:po",
		"purchase_orders",
		"po_number",
		"PO-%-"+dayToken+"-%",
		4,
	)
	if err != nil {
		return "", "", err
	}

	poID := fmt.Sprintf("PO-%s-%s-%03d", vendorToken, dayToken, seq)
	txID := fmt.Sprintf("TX-%s-%03d", dayToken, seq)
	return poID, txID, nil
}

// GeneratePOID generates a purchase-order human ID.
func GeneratePOID(ctx context.Context, tx pgx.Tx, vendorCode string) (string, error) {
	poID, _, err := GenerateProcurementIDs(ctx, tx, vendorCode)
	if err != nil {
		return "", err
	}
	return poID, nil
}

// GenerateTransactionID generates a transaction human ID.
func GenerateTransactionID(ctx context.Context, tx pgx.Tx) (string, error) {
	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"procurement:tx",
		"purchase_orders",
		"transaction_id",
		"TX-"+dayToken+"-%",
		3,
	)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("TX-%s-%03d", dayToken, seq), nil
}

// GeneratePaymentTransactionID generates a TX-YYMMDD-NNN identifier for a payment record.
func GeneratePaymentTransactionID(ctx context.Context, tx pgx.Tx) (string, error) {
	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"finance:payment-tx",
		"purchase_order_payments",
		"transaction_id",
		"TX-"+dayToken+"-%",
		3,
	)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("TX-%s-%03d", dayToken, seq), nil
}

// GenerateBatchID generates a raw-material batch code in the format BATYYMMDD-NNN.
// Example: BAT260506-001, BAT260506-002
func GenerateBatchID(ctx context.Context, tx pgx.Tx) (string, int32, error) {
	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"inventory:BAT",
		"inventory_batches",
		"batch_code",
		"BAT"+dayToken+"-%",
		2,
	)
	if err != nil {
		return "", 0, err
	}

	return fmt.Sprintf("BAT%s-%03d", dayToken, seq), seq, nil
}

// GenerateWIPID generates a WIP stage ID and its per-day sequence value.
// Valid stages are MLD (molding) and POL (polishing).
func GenerateWIPID(ctx context.Context, tx pgx.Tx, stage string) (string, int32, error) {
	prefix, ok := normalizeWIPStagePrefix(stage)
	if !ok {
		return "", 0, fmt.Errorf("invalid wip stage: %s", strings.TrimSpace(stage))
	}

	return generateInventoryIDByPrefix(ctx, tx, prefix)
}

// GenerateBundleID generates a finished-goods bundle ID and its per-day sequence value.
func GenerateBundleID(ctx context.Context, tx pgx.Tx) (string, int32, error) {
	return generateInventoryIDByPrefix(ctx, tx, "BNDL")
}

// GenerateSalesOrderID generates a sales-order human ID in the format SO-YYMMDD-NNN.
func GenerateSalesOrderID(ctx context.Context, tx pgx.Tx) (string, error) {
	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"sales:order",
		"sales_orders",
		"order_number",
		"SO-"+dayToken+"-%",
		3,
	)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("SO-%s-%03d", dayToken, seq), nil
}

// GenerateFinishedGoodSKU generates a deterministic finished-goods SKU.
// Format: FGP-001, FGP-002.
func GenerateFinishedGoodSKU(ctx context.Context, tx pgx.Tx) (string, error) {
	const code = "FGP"

	lockKey := fmt.Sprintf("sku-seq:%s", code)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return "", fmt.Errorf("acquire finished goods SKU advisory lock: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO sku_sequences (category_code, next_val) VALUES ($1, 1) ON CONFLICT (category_code) DO NOTHING`,
		code,
	); err != nil {
		return "", fmt.Errorf("seed finished goods SKU sequence row: %w", err)
	}

	var seq int32
	if err := tx.QueryRow(ctx,
		`UPDATE sku_sequences SET next_val = next_val + 1 WHERE category_code = $1 RETURNING next_val - 1`,
		code,
	).Scan(&seq); err != nil {
		return "", fmt.Errorf("fetch next finished goods SKU sequence: %w", err)
	}

	return formatFinishedGoodSKU(seq), nil
}

// GenerateSKU generates a deterministic SKU for raw materials.
// Format: RM{categoryCode}{sequence} e.g. RMSS001, RMCP002
// Uses sku_sequences table with advisory locks for uniqueness.
func GenerateSKU(ctx context.Context, tx pgx.Tx, categoryCode string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(categoryCode))
	if code == "" || len(code) > 4 {
		return "", fmt.Errorf("invalid category code for SKU generation: %q", categoryCode)
	}

	lockKey := fmt.Sprintf("sku-seq:%s", code)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return "", fmt.Errorf("acquire SKU advisory lock: %w", err)
	}

	// Ensure row exists
	if _, err := tx.Exec(ctx,
		`INSERT INTO sku_sequences (category_code, next_val) VALUES ($1, 1) ON CONFLICT (category_code) DO NOTHING`,
		code,
	); err != nil {
		return "", fmt.Errorf("seed SKU sequence row: %w", err)
	}

	// Atomically fetch current value and increment
	var seq int32
	if err := tx.QueryRow(ctx,
		`UPDATE sku_sequences SET next_val = next_val + 1 WHERE category_code = $1 RETURNING next_val - 1`,
		code,
	).Scan(&seq); err != nil {
		return "", fmt.Errorf("fetch next SKU sequence: %w", err)
	}

	return fmt.Sprintf("RM%s%03d", code, seq), nil
}

func generateInventoryIDByPrefix(ctx context.Context, tx pgx.Tx, prefix string) (string, int32, error) {
	cleanPrefix := strings.ToUpper(strings.TrimSpace(prefix))
	if cleanPrefix == "" {
		return "", 0, fmt.Errorf("missing identifier prefix")
	}

	dayToken := time.Now().UTC().Format(dayLayout)
	seq, err := nextDailySequenceByPattern(
		ctx,
		tx,
		"inventory:"+cleanPrefix,
		"inventory_batches",
		"batch_code",
		cleanPrefix+"-"+dayToken+"-%",
		3,
	)
	if err != nil {
		return "", 0, err
	}

	return fmt.Sprintf("%s-%s-%03d", cleanPrefix, dayToken, seq), seq, nil
}

func normalizeVendorCode(raw string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed == "" {
		return ""
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	for _, r := range trimmed {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
		}
	}

	return builder.String()
}

func normalizeWIPStagePrefix(raw string) (string, bool) {
	normalized := strings.ToUpper(strings.TrimSpace(raw))
	switch normalized {
	case "MLD", "MOLDING":
		return "MLD", true
	case "POL", "POLISHING":
		return "POL", true
	default:
		return "", false
	}
}

func formatFinishedGoodSKU(seq int32) string {
	return fmt.Sprintf("FGP-%03d", seq)
}

func nextDailySequenceByPattern(
	ctx context.Context,
	tx pgx.Tx,
	lockScope string,
	tableName string,
	columnName string,
	likePattern string,
	sequencePart int,
) (int32, error) {
	if sequencePart <= 0 {
		return 0, fmt.Errorf("invalid sequence part")
	}

	dayToken := time.Now().UTC().Format(dayLayout)
	lockKey := fmt.Sprintf("id-seq:%s:%s", lockScope, dayToken)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return 0, err
	}

	query := fmt.Sprintf(`
		SELECT COALESCE(
			MAX(
				CASE
					WHEN SPLIT_PART(%s, '-', %d) ~ '^[0-9]+$'
					THEN CAST(SPLIT_PART(%s, '-', %d) AS INTEGER)
					ELSE NULL
				END
			),
			0
		) + 1
		FROM %s
		WHERE %s LIKE $1
	`, columnName, sequencePart, columnName, sequencePart, tableName, columnName)

	var nextSeq int32
	if err := tx.QueryRow(ctx, query, likePattern).Scan(&nextSeq); err != nil {
		return 0, err
	}

	return nextSeq, nil
}
