package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// =============================================================================
// READ MODELS — production run views exposed to callers
// These types contain ONLY what the UI needs; no internal DB types are leaked.
// =============================================================================

// ProductionRunSummary is a single row in the production run list.
type ProductionRunSummary struct {
	RunID          string    `json:"run_id"`
	RunSequence    int64     `json:"run_sequence"`
	OutputItemID   string    `json:"output_item_id"`
	OutputItemSKU  string    `json:"output_item_sku"`
	OutputItemName string    `json:"output_item_name"`
	RunType        string    `json:"run_type"`
	OperatorID     string    `json:"operator_id"`
	OperatorName   string    `json:"operator_name"`
	Workstation    string    `json:"workstation"`
	InputQty       float64   `json:"input_qty"`
	OutputQty      float64   `json:"output_qty"`
	ScrapQty       float64   `json:"scrap_qty"`
	ShortlengthQty float64   `json:"shortlength_qty"`
	ProcessLossQty float64   `json:"process_loss_qty"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

// ProductionRunDetail extends the summary with full audit information.
type ProductionRunDetail struct {
	ProductionRunSummary
	Notes     string    `json:"notes"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BatchLineageEntry represents one upstream source batch in a batch's lineage.
type BatchLineageEntry struct {
	LineageID            string    `json:"lineage_id"`
	ProductionRunID      string    `json:"production_run_id"`
	SourceBatchID        string    `json:"source_batch_id"`
	SourceBatchCode      string    `json:"source_batch_code"`
	SourceBatchType      string    `json:"source_batch_type"`
	SourceBatchStatus    string    `json:"source_batch_status"`
	TargetBatchID        string    `json:"target_batch_id"`
	QuantityConsumed     float64   `json:"quantity_consumed"`
	BatchRemainingBefore float64   `json:"batch_remaining_before"`
	BatchRemainingAfter  float64   `json:"batch_remaining_after"`
	CreatedAt            time.Time `json:"created_at"`
}

// BatchConsumerEntry represents one downstream production run that consumed a batch.
type BatchConsumerEntry struct {
	LineageID        string    `json:"lineage_id"`
	ProductionRunID  string    `json:"production_run_id"`
	RunSequence      int64     `json:"run_sequence"`
	Workstation      string    `json:"workstation"`
	ProductionStatus string    `json:"production_status"`
	SourceBatchID    string    `json:"source_batch_id"`
	TargetBatchID    string    `json:"target_batch_id"`
	TargetBatchCode  string    `json:"target_batch_code"`
	TargetBatchType  string    `json:"target_batch_type"`
	QuantityConsumed float64   `json:"quantity_consumed"`
	RemainingBefore  float64   `json:"remaining_before"`
	RemainingAfter   float64   `json:"remaining_after"`
	CreatedAt        time.Time `json:"created_at"`
}

// BatchLineageView is the full lineage response for a single batch (both directions).
type BatchLineageView struct {
	BatchID   string               `json:"batch_id"`
	Sources   []BatchLineageEntry  `json:"sources"`   // what was consumed to produce this batch
	Consumers []BatchConsumerEntry `json:"consumers"` // downstream runs that consumed this batch
}

// ProductionRunListParams drives the production run list query.
type ProductionRunListParams struct {
	OutputItemID string // optional UUID filter
	Page         int32  // 1-based page number
	PageSize     int32  // rows per page
}

// =============================================================================
// SERVICE STRUCT
// =============================================================================

// WIPProductionQueryService provides read-only production run and lineage queries.
// It uses the pool directly (no transactions needed for reads).
type WIPProductionQueryService struct {
	pool *pgxpool.Pool
}

func NewWIPProductionQueryService(pool *pgxpool.Pool) *WIPProductionQueryService {
	return &WIPProductionQueryService{pool: pool}
}

// =============================================================================
// QUERY METHODS
// =============================================================================

// ListProductionRuns returns a paginated list of production runs.
// Optionally filters by output item ID (pass "" for all runs).
func (s *WIPProductionQueryService) ListProductionRuns(ctx context.Context, params ProductionRunListParams) ([]ProductionRunSummary, error) {
	if params.PageSize <= 0 {
		params.PageSize = 50
	}
	if params.PageSize > 200 {
		params.PageSize = 200
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.PageSize

	var outputItemID pgtype.UUID
	if trimmed := strings.TrimSpace(params.OutputItemID); trimmed != "" {
		parsed, ok := parseUUID(trimmed)
		if !ok {
			return nil, ErrWIPItemNotFound
		}
		outputItemID = parsed
	}

	rows, err := db.New(s.pool).ListProductionRuns(ctx, db.ListProductionRunsParams{
		OutputItemID: outputItemID,
		PageOffset:   offset,
		PageLimit:    params.PageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("list production runs: %w", err)
	}

	out := make([]ProductionRunSummary, 0, len(rows))
	for _, r := range rows {
		summary, err := mapListRunRow(r)
		if err != nil {
			return nil, err
		}
		out = append(out, summary)
	}
	return out, nil
}

// GetProductionRunByID returns full detail for a single production run.
func (s *WIPProductionQueryService) GetProductionRunByID(ctx context.Context, runID string) (*ProductionRunDetail, error) {
	parsed, ok := parseUUID(strings.TrimSpace(runID))
	if !ok {
		return nil, ErrWIPBatchNotFound
	}

	row, err := db.New(s.pool).GetProductionRunByID(ctx, parsed)
	if err != nil {
		if isNoRows(err) {
			return nil, ErrWIPBatchNotFound
		}
		return nil, fmt.Errorf("get production run by id: %w", err)
	}

	return mapDetailRunRow(row), nil
}

// GetBatchLineage returns the full lineage view for a batch:
//   - Sources: which upstream batches were consumed to produce this one
//   - Consumers: which downstream runs consumed this batch
func (s *WIPProductionQueryService) GetBatchLineage(ctx context.Context, batchID string) (*BatchLineageView, error) {
	parsed, ok := parseUUID(strings.TrimSpace(batchID))
	if !ok {
		return nil, ErrWIPBatchNotFound
	}

	q := db.New(s.pool)

	sourceRows, err := q.GetBatchLineageByTargetBatch(ctx, parsed)
	if err != nil {
		return nil, fmt.Errorf("get batch lineage sources: %w", err)
	}

	consumerRows, err := q.GetBatchConsumersBySourceBatch(ctx, parsed)
	if err != nil {
		return nil, fmt.Errorf("get batch consumers: %w", err)
	}

	sources := make([]BatchLineageEntry, 0, len(sourceRows))
	for _, r := range sourceRows {
		entry, err := mapLineageRow(r, batchID)
		if err != nil {
			return nil, err
		}
		sources = append(sources, entry)
	}

	consumers := make([]BatchConsumerEntry, 0, len(consumerRows))
	for _, r := range consumerRows {
		entry, err := mapConsumerRow(r)
		if err != nil {
			return nil, err
		}
		consumers = append(consumers, entry)
	}

	return &BatchLineageView{
		BatchID:   batchID,
		Sources:   sources,
		Consumers: consumers,
	}, nil
}

// =============================================================================
// MAPPING HELPERS
// =============================================================================

func mapListRunRow(r db.ListProductionRunsRow) (ProductionRunSummary, error) {
	inputQty, _ := numericToFloat64(r.InputQty)
	outputQty, _ := numericToFloat64(r.OutputQty)
	scrapQty, _ := numericToFloat64(r.ScrapQty)
	shortQty, _ := numericToFloat64(r.ShortlengthQty)
	lossQty, _ := numericToFloat64(r.ProcessLossQty)

	seq := int64(0)
	if r.RunSequence.Valid {
		seq = r.RunSequence.Int64
	}
	createdAt := time.Time{}
	if r.CreatedAt.Valid {
		createdAt = r.CreatedAt.Time
	}
	workstation := ""
	if r.Workstation.Valid {
		workstation = r.Workstation.String
	}

	runType := workstation
	if runType == "" {
		runType = "UNKNOWN"
	}

	return ProductionRunSummary{
		RunID:          uuidString(r.ID),
		RunSequence:    seq,
		OutputItemID:   uuidString(r.OutputItemID),
		OutputItemSKU:  r.OutputItemSku,
		OutputItemName: r.OutputItemName,
		RunType:        runType,
		OperatorID:     uuidString(r.OperatorID),
		OperatorName:   r.OperatorName,
		Workstation:    workstation,
		InputQty:       inputQty,
		OutputQty:      outputQty,
		ScrapQty:       scrapQty,
		ShortlengthQty: shortQty,
		ProcessLossQty: lossQty,
		Status:         string(r.Status),
		CreatedAt:      createdAt,
	}, nil
}

func mapDetailRunRow(r db.GetProductionRunByIDRow) *ProductionRunDetail {
	inputQty, _ := numericToFloat64(r.InputQty)
	outputQty, _ := numericToFloat64(r.OutputQty)
	scrapQty, _ := numericToFloat64(r.ScrapQty)
	shortQty, _ := numericToFloat64(r.ShortlengthQty)
	lossQty, _ := numericToFloat64(r.ProcessLossQty)

	seq := int64(0)
	if r.RunSequence.Valid {
		seq = r.RunSequence.Int64
	}
	createdAt := time.Time{}
	if r.CreatedAt.Valid {
		createdAt = r.CreatedAt.Time
	}
	updatedAt := time.Time{}
	if r.UpdatedAt.Valid {
		updatedAt = r.UpdatedAt.Time
	}
	workstation := ""
	if r.Workstation.Valid {
		workstation = r.Workstation.String
	}
	notes := ""
	if r.Notes.Valid {
		notes = r.Notes.String
	}

	runType := workstation
	if runType == "" {
		runType = "UNKNOWN"
	}

	return &ProductionRunDetail{
		ProductionRunSummary: ProductionRunSummary{
			RunID:          uuidString(r.ID),
			RunSequence:    seq,
			OutputItemID:   uuidString(r.OutputItemID),
			OutputItemSKU:  r.OutputItemSku,
			OutputItemName: r.OutputItemName,
			RunType:        runType,
			OperatorID:     uuidString(r.OperatorID),
			OperatorName:   r.OperatorName,
			Workstation:    workstation,
			InputQty:       inputQty,
			OutputQty:      outputQty,
			ScrapQty:       scrapQty,
			ShortlengthQty: shortQty,
			ProcessLossQty: lossQty,
			Status:         string(r.Status),
			CreatedAt:      createdAt,
		},
		Notes:     notes,
		UpdatedAt: updatedAt,
	}
}

func mapLineageRow(r db.GetBatchLineageByTargetBatchRow, targetID string) (BatchLineageEntry, error) {
	consumed, _ := numericToFloat64(r.QuantityConsumed)
	before, _ := numericToFloat64(r.BatchRemainingBefore)
	after, _ := numericToFloat64(r.BatchRemainingAfter)
	createdAt := time.Time{}
	if r.CreatedAt.Valid {
		createdAt = r.CreatedAt.Time
	}
	return BatchLineageEntry{
		LineageID:            uuidString(r.ID),
		ProductionRunID:      uuidString(r.ProductionRunID),
		SourceBatchID:        uuidString(r.SourceBatchID),
		SourceBatchCode:      r.SourceBatchCode,
		SourceBatchType:      string(r.SourceBatchType),
		SourceBatchStatus:    string(r.SourceBatchStatus),
		TargetBatchID:        targetID,
		QuantityConsumed:     consumed,
		BatchRemainingBefore: before,
		BatchRemainingAfter:  after,
		CreatedAt:            createdAt,
	}, nil
}

func mapConsumerRow(r db.GetBatchConsumersBySourceBatchRow) (BatchConsumerEntry, error) {
	consumed, _ := numericToFloat64(r.QuantityConsumed)
	before, _ := numericToFloat64(r.BatchRemainingBefore)
	after, _ := numericToFloat64(r.BatchRemainingAfter)
	createdAt := time.Time{}
	if r.CreatedAt.Valid {
		createdAt = r.CreatedAt.Time
	}
	seq := int64(0)
	if r.RunSequence.Valid {
		seq = r.RunSequence.Int64
	}
	workstation := ""
	if r.Workstation.Valid {
		workstation = r.Workstation.String
	}
	targetBatchCode := ""
	if r.TargetBatchCode.Valid {
		targetBatchCode = r.TargetBatchCode.String
	}
	targetBatchType := ""
	if r.TargetBatchType.Valid {
		targetBatchType = string(r.TargetBatchType.BatchType)
	}

	return BatchConsumerEntry{
		LineageID:        uuidString(r.ID),
		ProductionRunID:  uuidString(r.ProductionRunID),
		RunSequence:      seq,
		Workstation:      workstation,
		ProductionStatus: r.ProductionRunStatus,
		SourceBatchID:    uuidString(r.SourceBatchID),
		TargetBatchID:    uuidString(r.TargetBatchID),
		TargetBatchCode:  targetBatchCode,
		TargetBatchType:  targetBatchType,
		QuantityConsumed: consumed,
		RemainingBefore:  before,
		RemainingAfter:   after,
		CreatedAt:        createdAt,
	}, nil
}

// isNoRows returns true if err is pgx.ErrNoRows.
func isNoRows(err error) bool {
	return err == pgx.ErrNoRows
}
