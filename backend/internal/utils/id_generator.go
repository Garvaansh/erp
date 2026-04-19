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

// GenerateBatchID generates a raw-material batch ID and its per-day sequence value.
func GenerateBatchID(ctx context.Context, tx pgx.Tx) (string, int32, error) {
	return generateInventoryIDByPrefix(ctx, tx, "BAT")
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
