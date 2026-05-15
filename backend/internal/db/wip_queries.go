package db

// wip_queries.go — Hand-written pgx queries for the WIP execution layer.
// These queries require batch_type filtering that is NOT present in the
// sqlc-generated GetFIFOBatchesForUpdate (which is type-agnostic by design).
//
// DO NOT modify this file with sqlc. These are maintained by hand.
// They complement, not replace, the generated queries.

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// GetFIFOBatchesForUpdateByType returns ACTIVE batches of a specific type
// for a given item in strict FIFO order (created_at ASC, id ASC).
//
// PATCH 2 — Type Safety:
// This replaces the generic GetFIFOBatchesForUpdate in the WIP execution path.
// It enforces that:
//   - Molding  consumes ONLY batch_type = 'RAW'
//   - Polishing consumes ONLY batch_type = 'MOLDED'
//
// Constraints preserved from GetFIFOBatchesForUpdate:
//   - status = 'ACTIVE' (HOLD and EXHAUSTED excluded)
//   - remaining_qty > 0
//   - FOR UPDATE lock (prevents concurrent double-allocation)
//   - FIFO order: created_at ASC, id ASC
const getFIFOBatchesForUpdateByType = `
SELECT
    b.id,
    b.item_id,
    b.batch_code,
    b.type,
    b.initial_qty,
    b.remaining_qty,
    b.reserved_qty,
    b.status,
    b.created_at
FROM inventory_batches b
WHERE b.item_id      = $1
  AND b.status       = 'ACTIVE'::batch_status
  AND b.type         = $2::batch_type
  AND b.remaining_qty > 0
ORDER BY b.created_at ASC, b.id ASC
FOR UPDATE
`

// GetFIFOBatchesForUpdateByType executes the type-filtered FIFO allocation query.
// Caller MUST be inside a transaction.
func (q *Queries) GetFIFOBatchesForUpdateByType(
	ctx context.Context,
	itemID pgtype.UUID,
	batchType BatchType,
) ([]GetFIFOBatchesForUpdateRow, error) {
	rows, err := q.db.Query(ctx, getFIFOBatchesForUpdateByType, itemID, string(batchType))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []GetFIFOBatchesForUpdateRow
	for rows.Next() {
		var i GetFIFOBatchesForUpdateRow
		if err := rows.Scan(
			&i.ID,
			&i.ItemID,
			&i.BatchCode,
			&i.Type,
			&i.InitialQty,
			&i.RemainingQty,
			&i.ReservedQty,
			&i.Status,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
