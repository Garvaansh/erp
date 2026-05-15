package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// =============================================================================
// DOMAIN ERRORS — Production Execution Layer
// =============================================================================

var (
	ErrWIPInsufficientInventory = errors.New("insufficient inventory for requested allocation")
	ErrWIPHoldBatchForbidden    = errors.New("HOLD batches cannot be allocated; only ACTIVE batches are eligible")
	ErrWIPExhaustedBatch        = errors.New("batch is already exhausted")
	ErrWIPInvalidInputQty       = errors.New("input_qty must be greater than zero")
	ErrWIPInvalidOutputQty      = errors.New("output_qty must be greater than zero")
	ErrWIPInvalidScrapQty       = errors.New("scrap_qty cannot be negative")
	ErrWIPInvalidShortlengthQty = errors.New("shortlength_qty cannot be negative")
	ErrWIPItemNotFound          = errors.New("output item not found")
	ErrWIPBatchNotFound         = errors.New("source batch not found")
	ErrWIPExecutionFailed       = errors.New("production execution failed; transaction rolled back")
	ErrWIPNoBatchesAvailable    = errors.New("no active batches available for this item")
	// ErrWIPMissingRecipe is returned when a finished good has no linked raw material.
	// Every finished good MUST have a recipe (linked_raw_material_id) to enter production.
	ErrWIPMissingRecipe = errors.New("finished good has no linked raw material; recipe configuration required")
)

// =============================================================================
// INPUT / OUTPUT MODELS — Operator-facing DTOs
// =============================================================================

// MoldingCommand is the operator input for a Molding production run.
//
// IMPORTANT — Recipe Architecture:
// The operator selects ONLY the finished good item (e.g. "CUR-32MM").
// The backend resolves the linked raw material automatically.
// Operators NEVER manually select raw material items or procurement SKUs.
type MoldingCommand struct {
	OutputItemID   string  // UUID of the FINISHED GOOD item (e.g. CUR-32MM). Backend resolves raw material from recipe.
	InputQty       float64 // kg of raw material consumed
	OutputQty      float64 // kg of molded output produced
	ScrapQty       float64 // kg scrap (non-negative)
	ShortlengthQty float64 // kg shortlength (non-negative)
	Notes          string  // optional operator note
	OperatorID     string  // UUID of the logged-in operator
}

// PolishingCommand is the operator input for a Polishing production run.
//
// IMPORTANT — Recipe Architecture:
// The operator selects ONLY the finished good item (e.g. "CUR-32MM").
// The backend resolves which MOLDED batches belong to this item automatically.
// InputItemID is NOT required — the system uses the finished good item to find MOLDED inventory.
type PolishingCommand struct {
	OutputItemID   string  // UUID of the FINISHED GOOD item being produced
	InputQty       float64 // kg of molded material consumed
	OutputQty      float64 // kg of finished output produced
	ScrapQty       float64 // kg scrap (non-negative)
	ShortlengthQty float64 // kg shortlength (non-negative)
	Notes          string  // optional operator note
	OperatorID     string  // UUID of the logged-in operator
}

// ProductionRunResult is the response returned to the caller after a successful run.
// Internal IDs are exposed only as strings to prevent raw-UUID leakage.
type ProductionRunResult struct {
	RunID           string    `json:"run_id"`
	RunSequence     int64     `json:"run_sequence"`
	OutputBatchID   string    `json:"output_batch_id"`
	OutputBatchCode string    `json:"output_batch_code"`
	InputQty        float64   `json:"input_qty"`
	OutputQty       float64   `json:"output_qty"`
	ScrapQty        float64   `json:"scrap_qty"`
	ShortlengthQty  float64   `json:"shortlength_qty"`
	ProcessLossQty  float64   `json:"process_loss_qty"`
	BatchesConsumed int       `json:"batches_consumed"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

// =============================================================================
// INTERNAL ALLOCATION DATA STRUCTURES
// =============================================================================

// fifoAllocation captures the computed deduction for a single source batch.
// All amounts are stored as float64 (operator view) and pgtype.Numeric (DB view).
type fifoAllocation struct {
	batchID       pgtype.UUID
	batchCode     string
	itemID        pgtype.UUID
	consumed      float64
	beforeNumeric pgtype.Numeric // remaining_qty BEFORE deduction (snapshot for lineage)
	afterNumeric  pgtype.Numeric // remaining_qty AFTER deduction (computed locally)
	consumedNum   pgtype.Numeric
}

// =============================================================================
// SERVICE STRUCT
// =============================================================================

// WIPProductionCommandService executes transactional WIP production runs.
// It is the ONLY place that touches production_runs, batch_consumptions,
// and inventory mutation within the WIP execution pipeline.
type WIPProductionCommandService struct {
	pool *pgxpool.Pool
}

func NewWIPProductionCommandService(pool *pgxpool.Pool) *WIPProductionCommandService {
	return &WIPProductionCommandService{pool: pool}
}

// =============================================================================
// PHASE 1 — PUBLIC COMMAND METHODS
// =============================================================================

// ExecuteMolding runs a complete, transaction-safe Molding production cycle.
//
// PATCH 1 — Recipe Resolution:
// The operator provides the FINISHED GOOD item ID (e.g. CUR-32MM).
// The backend automatically resolves the linked raw material from the recipe
// and performs FIFO allocation against RAW batches of that linked material.
// production_runs.output_item_id remains the FINISHED GOOD item ID — this is
// intentional so that GetFinishedGoodProductionHistory can aggregate both
// molding and polishing runs under the same finished product record.
//
// Algorithm:
//  1. Validate inputs.
//  2. Resolve linked_raw_material_id from the finished good item record.
//  3. BEGIN transaction.
//  4. CREATE production_run with output_item_id = finished good item.
//  5. FETCH + LOCK ACTIVE RAW batches for the linked raw material (type-filtered).
//  6. GREEDY FIFO loop, DEDUCT, LINEAGE, LEDGER (OUT per batch).
//  7. CREATE MOLDED output batch with item_id = finished good item.
//  8. LEDGER IN for output batch. COMMIT.
func (s *WIPProductionCommandService) ExecuteMolding(ctx context.Context, cmd MoldingCommand) (*ProductionRunResult, error) {
	if err := validateMoldingCommand(cmd); err != nil {
		return nil, err
	}

	// PATCH 1: Operator provides the finished good item ID.
	finishedGoodItemID, ok := parseUUID(cmd.OutputItemID)
	if !ok {
		return nil, ErrWIPItemNotFound
	}
	operatorID, _ := parseUUID(cmd.OperatorID)

	// PATCH 1: Resolve the linked raw material item from the recipe.
	// We do this outside the transaction — it's a read-only lookup.
	linkedRawMaterialID, err := s.resolveLinkedRawMaterial(ctx, finishedGoodItemID)
	if err != nil {
		return nil, err // ErrWIPItemNotFound or ErrWIPMissingRecipe
	}

	// PATCH 1+4: output_item_id = finished good item ID (NOT the raw material).
	// This ensures GetFinishedGoodProductionHistory aggregates this run under
	// the correct finished product.
	// PATCH 3: output batch (MOLDED type) also uses finished good item ID so that
	// MOLDED batches are correctly linked to the finished goods pipeline.
	return s.executeProductionAllocation(ctx, allocationRequest{
		outputItemID:   finishedGoodItemID,  // stays the finished good
		sourceItemID:   linkedRawMaterialID, // FIFO consumes RAW batches of this item
		sourceType:     db.BatchTypeRAW,
		outputType:     db.BatchTypeMOLDED,
		inputQty:       cmd.InputQty,
		outputQty:      cmd.OutputQty,
		scrapQty:       cmd.ScrapQty,
		shortlengthQty: cmd.ShortlengthQty,
		notes:          cmd.Notes,
		operatorID:     operatorID,
		workstation:    "MOLDING",
	})
}

// ExecutePolishing runs a complete, transaction-safe Polishing production cycle.
//
// PATCH 1 — Recipe Architecture:
// The operator provides ONLY the finished good item ID.
// The backend automatically allocates from MOLDED batches that belong to
// that finished good item (item_id = finished good, type = MOLDED).
// This is correct because Molding already creates MOLDED batches with
// item_id = finished good item ID.
//
// Produces FINISHED bundles (BatchTypeFINISHED) with item_id = finished good.
// Both Molding and Polishing runs share the same output_item_id (finished good),
// enabling correct aggregation in GetFinishedGoodProductionHistory.
func (s *WIPProductionCommandService) ExecutePolishing(ctx context.Context, cmd PolishingCommand) (*ProductionRunResult, error) {
	if err := validatePolishingCommand(cmd); err != nil {
		return nil, err
	}

	// Operator provides the finished good item ID.
	finishedGoodItemID, ok := parseUUID(cmd.OutputItemID)
	if !ok {
		return nil, ErrWIPItemNotFound
	}
	operatorID, _ := parseUUID(cmd.OperatorID)

	// PATCH 1: MOLDED batches for this product have item_id = finished good item ID.
	// (This is set during Molding, which stores the MOLDED batch under the finished good item.)
	// Polishing consumes those MOLDED batches and produces FINISHED bundles.
	return s.executeProductionAllocation(ctx, allocationRequest{
		outputItemID:   finishedGoodItemID, // finished good item — also the source item for MOLDED lookup
		sourceItemID:   finishedGoodItemID, // MOLDED batches are stored under the finished good item
		sourceType:     db.BatchTypeMOLDED,
		outputType:     db.BatchTypeFINISHED,
		inputQty:       cmd.InputQty,
		outputQty:      cmd.OutputQty,
		scrapQty:       cmd.ScrapQty,
		shortlengthQty: cmd.ShortlengthQty,
		notes:          cmd.Notes,
		operatorID:     operatorID,
		workstation:    "POLISHING",
	})
}

// =============================================================================
// PHASE 1 — SHARED ALLOCATION ENGINE
// executeProductionAllocation is the single implementation of the greedy FIFO
// allocation loop. Both Molding and Polishing call this method with appropriate
// source/output types, keeping the math DRY and audit-consistent.
// =============================================================================

// allocationRequest bundles all inputs for a generic production run.
type allocationRequest struct {
	outputItemID   pgtype.UUID  // item being produced
	sourceItemID   pgtype.UUID  // item whose batches are being consumed
	sourceType     db.BatchType // RAW or MOLDED
	outputType     db.BatchType // MOLDED or FINISHED
	inputQty       float64
	outputQty      float64
	scrapQty       float64
	shortlengthQty float64
	notes          string
	operatorID     pgtype.UUID
	workstation    string
}

// executeProductionAllocation is the authoritative implementation of the
// Greedy FIFO Allocation Algorithm as specified in the architecture.
//
// Data structure: []fifoAllocation (slice, ordered by FIFO batch age)
//
// Algorithm (step-by-step as specified):
//  1. BEGIN TRANSACTION.
//  2. CREATE production_runs record.
//  3. FETCH + LOCK ACTIVE batches for source item (GetFIFOBatchesForUpdate).
//  4. COMPUTE allocations greedily in a single pass (no extra queries inside loop).
//  5. VALIDATE total >= required; ROLLBACK if insufficient.
//  6. DEDUCT each batch (DeductBatchForProduction — auto-exhausts at zero).
//  7. CREATE batch_consumptions lineage rows.
//  8. RECORD OUT inventory_transactions for each consumed batch.
//  9. CREATE output batch (CreateProducedBatch).
//
// 10. RECORD IN inventory_transaction for output batch.
// 11. COMMIT.
func (s *WIPProductionCommandService) executeProductionAllocation(
	ctx context.Context,
	req allocationRequest,
) (*ProductionRunResult, error) {
	processLossQty := req.inputQty - (req.outputQty + req.scrapQty + req.shortlengthQty)
	if processLossQty < 0 {
		processLossQty = 0 // allow output > input only if operator recorded it; don't go negative
	}

	// --- Convert operator quantities to pgtype.Numeric ---
	inputNum, ok := numericFromFloat(req.inputQty)
	if !ok {
		return nil, ErrWIPInvalidInputQty
	}
	outputNum, ok := numericFromFloat(req.outputQty)
	if !ok {
		return nil, ErrWIPInvalidOutputQty
	}
	scrapNum, scrapOK := numericFromFloat(req.scrapQty)
	if !scrapOK && req.scrapQty > 0 {
		return nil, ErrWIPInvalidScrapQty
	}
	if !scrapOK {
		scrapNum, _ = numericFromFloat(0.0001) // use tiny valid numeric for zero
		scrapNum = numericZero()
	}
	shortNum, shortOK := numericFromFloat(req.shortlengthQty)
	if !shortOK && req.shortlengthQty > 0 {
		return nil, ErrWIPInvalidShortlengthQty
	}
	if !shortOK {
		shortNum = numericZero()
	}
	lossNum, lossOK := numericFromFloat(processLossQty)
	if !lossOK {
		lossNum = numericZero()
	}
	_ = lossOK

	notes := pgtype.Text{String: strings.TrimSpace(req.notes), Valid: strings.TrimSpace(req.notes) != ""}

	// --- BEGIN TRANSACTION ---
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin production transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)

	// --- STEP 2: Create production_run record (operator journal entry) ---
	run, err := qtx.CreateProductionRun(ctx, db.CreateProductionRunParams{
		OutputItemID:   req.outputItemID,
		OperatorID:     req.operatorID,
		Workstation:    pgtype.Text{String: req.workstation, Valid: true},
		InputQty:       inputNum,
		OutputQty:      outputNum,
		ScrapQty:       scrapNum,
		ShortlengthQty: shortNum,
		ProcessLossQty: lossNum,
		Status:         "COMPLETED",
		Notes:          notes,
	})
	if err != nil {
		return nil, fmt.Errorf("create production run record: %w", err)
	}

	// --- STEP 3: Fetch + LOCK ACTIVE batches of the correct TYPE in FIFO order ---
	// PATCH 2: Use GetFIFOBatchesForUpdateByType to enforce batch type safety:
	//   - Molding  → sourceType = RAW   (cannot accidentally consume MOLDED batches)
	//   - Polishing → sourceType = MOLDED (cannot accidentally consume FINISHED bundles)
	// FOR UPDATE lock is baked in — this call MUST be inside a transaction.
	batches, err := qtx.GetFIFOBatchesForUpdateByType(ctx, req.sourceItemID, req.sourceType)
	if err != nil {
		return nil, fmt.Errorf("fetch fifo batches (type=%s) for allocation: %w", req.sourceType, err)
	}
	if len(batches) == 0 {
		return nil, ErrWIPNoBatchesAvailable
	}

	// --- STEP 4: Compute greedy FIFO allocations (single pass, no DB queries inside loop) ---
	//
	// Data structure: allocations []fifoAllocation
	// Each element records:
	//   - batchID, itemID: identity
	//   - consumed: amount taken from this batch (float64 for math, Numeric for DB)
	//   - beforeNumeric, afterNumeric: point-in-time snapshots for audit lineage
	//
	// The loop exits as soon as remainingNeeded reaches zero, ensuring minimal consumption
	// from the fewest batches needed while strictly respecting FIFO order.
	remainingNeeded := req.inputQty
	allocations := make([]fifoAllocation, 0, len(batches))

	for _, batch := range batches {
		if remainingNeeded <= 0 {
			break
		}

		batchAvailable, ok := numericToFloat64(batch.RemainingQty)
		if !ok || batchAvailable <= 0 {
			continue
		}

		// Greedy: take as much as possible from this batch, up to what we still need.
		consume := math.Min(batchAvailable, remainingNeeded)
		afterAmt := batchAvailable - consume

		beforeNum, ok1 := numericFromFloat(batchAvailable)
		afterNum, ok2 := numericFromFloat(afterAmt)
		consumeNum, ok3 := numericFromFloat(consume)
		if !ok1 || !ok3 {
			return nil, fmt.Errorf("numeric conversion failed for batch %s", uuidString(batch.ID))
		}
		if !ok2 {
			afterNum = numericZero()
		}

		allocations = append(allocations, fifoAllocation{
			batchID:       batch.ID,
			batchCode:     batch.BatchCode,
			itemID:        batch.ItemID,
			consumed:      consume,
			beforeNumeric: beforeNum,
			afterNumeric:  afterNum,
			consumedNum:   consumeNum,
		})

		remainingNeeded -= consume
	}

	// --- STEP 5: Validate sufficient stock ---
	// remainingNeeded should be <= 0 after the loop if we had enough stock.
	if remainingNeeded > 0.0001 { // epsilon guard against float rounding
		return nil, ErrWIPInsufficientInventory
	}

	// --- STEP 6 + 7 + 8: Apply allocations (deduct, lineage, ledger) ---
	// Generate a single movement group UUID for all transactions in this run.
	movementGroupUUID := uuid.New()
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	// The first allocated batch becomes the parent_batch_id (convenience reference).
	var primaryParentBatchID pgtype.UUID
	if len(allocations) > 0 {
		primaryParentBatchID = allocations[0].batchID
	}

	for _, alloc := range allocations {
		// STEP 6: Deduct remaining_qty from the source batch.
		// DeductBatchForProduction auto-transitions to EXHAUSTED when remaining reaches 0.
		if _, err := qtx.DeductBatchForProduction(ctx, db.DeductBatchForProductionParams{
			QtyToDeduct: alloc.consumedNum,
			ID:          alloc.batchID,
		}); err != nil {
			return nil, fmt.Errorf("deduct batch %s: %w", alloc.batchCode, err)
		}

		// STEP 7: Record lineage in batch_consumptions.
		// target_batch_id is set after output batch creation; we use a null UUID here
		// and will create a second pass with the actual target ID.
		// NOTE: We create the output batch first, then fill target_batch_id accurately.
		// For now, record with null target (will update after output batch is created).
		// Actually — we must create output batch first, then record consumption.
		// So: skip consumption creation here, do it after output batch is created below.
		_ = alloc // defer consumption creation below
	}

	// --- STEP 9: Create output batch ---
	batchCodeStr, dailySequence, err := nextWIPBatchCode(ctx, tx, req.outputType)
	if err != nil {
		return nil, fmt.Errorf("generate output batch code: %w", err)
	}

	outputBatch, err := qtx.CreateProducedBatch(ctx, db.CreateProducedBatchParams{
		ItemID:        req.outputItemID,
		BatchCode:     batchCodeStr,
		DailySequence: dailySequence,
		InitialQty:    outputNum,
		BatchType:     req.outputType,
		ParentBatchID: primaryParentBatchID, // convenience ref to first consumed batch
	})
	if err != nil {
		return nil, fmt.Errorf("create output batch: %w", err)
	}

	// --- STEP 7 (deferred): Record batch_consumptions lineage with accurate target_batch_id ---
	for _, alloc := range allocations {
		if _, err := qtx.CreateBatchConsumption(ctx, db.CreateBatchConsumptionParams{
			ProductionRunID:      run.ID,
			SourceBatchID:        alloc.batchID,
			TargetBatchID:        outputBatch.ID,
			QuantityConsumed:     alloc.consumedNum,
			BatchRemainingBefore: alloc.beforeNumeric,
			BatchRemainingAfter:  alloc.afterNumeric,
		}); err != nil {
			return nil, fmt.Errorf("record batch consumption lineage for %s: %w", alloc.batchCode, err)
		}
	}

	// --- STEP 8: Record OUT inventory_transactions for each consumed source batch ---
	for _, alloc := range allocations {
		if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
			MovementGroupID: movementGroupID,
			ItemID:          alloc.itemID,
			BatchID:         alloc.batchID,
			Direction:       db.TxDirectionOUT,
			Quantity:        alloc.consumedNum,
			ReferenceType:   string(db.TxReferenceTypePRODUCTIONJOURNAL),
			ReferenceID:     run.ID,
			PerformedBy:     req.operatorID,
			Notes: pgtype.Text{
				String: fmt.Sprintf("%s: consumed from batch %s", req.workstation, alloc.batchCode),
				Valid:  true,
			},
		}); err != nil {
			return nil, fmt.Errorf("record OUT transaction for batch %s: %w", alloc.batchCode, err)
		}
	}

	// --- STEP 10: Record IN inventory_transaction for the output batch ---
	if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          req.outputItemID,
		BatchID:         outputBatch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        outputNum,
		ReferenceType:   string(db.TxReferenceTypePRODUCTIONJOURNAL),
		ReferenceID:     run.ID,
		PerformedBy:     req.operatorID,
		Notes: pgtype.Text{
			String: fmt.Sprintf("%s: produced batch %s", req.workstation, batchCodeStr),
			Valid:  true,
		},
	}); err != nil {
		return nil, fmt.Errorf("record IN transaction for output batch: %w", err)
	}

	// --- STEP 11: COMMIT ---
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit production transaction: %w", err)
	}
	committed = true

	// --- Build user-facing result (no internal IDs leaked in unexpected form) ---
	runSeq := int64(0)
	if run.RunSequence.Valid {
		runSeq = run.RunSequence.Int64
	}
	createdAt := time.Time{}
	if run.CreatedAt.Valid {
		createdAt = run.CreatedAt.Time
	}

	return &ProductionRunResult{
		RunID:           uuidString(run.ID),
		RunSequence:     runSeq,
		OutputBatchID:   uuidString(outputBatch.ID),
		OutputBatchCode: outputBatch.BatchCode,
		InputQty:        req.inputQty,
		OutputQty:       req.outputQty,
		ScrapQty:        req.scrapQty,
		ShortlengthQty:  req.shortlengthQty,
		ProcessLossQty:  processLossQty,
		BatchesConsumed: len(allocations),
		Status:          run.Status,
		CreatedAt:       createdAt,
	}, nil
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

func validateMoldingCommand(cmd MoldingCommand) error {
	if strings.TrimSpace(cmd.OutputItemID) == "" {
		return ErrWIPItemNotFound
	}
	if cmd.InputQty <= 0 {
		return ErrWIPInvalidInputQty
	}
	if cmd.OutputQty <= 0 {
		return ErrWIPInvalidOutputQty
	}
	if cmd.ScrapQty < 0 {
		return ErrWIPInvalidScrapQty
	}
	if cmd.ShortlengthQty < 0 {
		return ErrWIPInvalidShortlengthQty
	}
	return nil
}

func validatePolishingCommand(cmd PolishingCommand) error {
	if strings.TrimSpace(cmd.OutputItemID) == "" {
		return ErrWIPItemNotFound
	}
	// PATCH 1: InputItemID removed — operator only selects finished good.
	// System resolves MOLDED source batches by finished good item ID automatically.
	if cmd.InputQty <= 0 {
		return ErrWIPInvalidInputQty
	}
	if cmd.OutputQty <= 0 {
		return ErrWIPInvalidOutputQty
	}
	if cmd.ScrapQty < 0 {
		return ErrWIPInvalidScrapQty
	}
	if cmd.ShortlengthQty < 0 {
		return ErrWIPInvalidShortlengthQty
	}
	return nil
}

// =============================================================================
// INTERNAL UTILITIES
// =============================================================================

// resolveLinkedRawMaterial loads a finished good item and returns its linked
// raw material item ID. Returns ErrWIPMissingRecipe if the linkage is absent.
//
// PATCH 1: This enforces the recipe architecture:
//   - Every finished good MUST have a linked_raw_material_id configured.
//   - Molding cannot proceed without a valid recipe.
//   - The operator selects the finished good; the backend resolves the raw material.
func (s *WIPProductionCommandService) resolveLinkedRawMaterial(ctx context.Context, finishedGoodItemID pgtype.UUID) (pgtype.UUID, error) {
	item, err := db.New(s.pool).GetItem(ctx, finishedGoodItemID)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return pgtype.UUID{}, ErrWIPItemNotFound
		}
		return pgtype.UUID{}, fmt.Errorf("load finished good item for recipe resolution: %w", err)
	}
	if !item.LinkedRawMaterialID.Valid {
		return pgtype.UUID{}, ErrWIPMissingRecipe
	}
	return item.LinkedRawMaterialID, nil
}

// numericZero returns a pgtype.Numeric representing exactly 0.
func numericZero() pgtype.Numeric {
	var n pgtype.Numeric
	_ = n.Scan("0")
	return n
}

// nextWIPBatchCode generates the stage-appropriate batch code.
//
// PATCH 3 — Batch Code Generation:
// Batch codes are deterministic, stage-aware, and concurrency-safe.
// They are generated ONLY in the backend — never by the frontend.
//
//	MOLDED   → MLD-YYMMDD-NNN  (GenerateWIPID with "MLD" prefix)
//	FINISHED → BNDL-YYMMDD-NNN (GenerateBundleID)
//
// RAW batches (BAT-YYMMDD-NNN) are generated during procurement receipt
// and are NOT produced here.
func nextWIPBatchCode(ctx context.Context, tx pgx.Tx, outputType db.BatchType) (string, int32, error) {
	switch outputType {
	case db.BatchTypeMOLDED:
		// MLD-YYMMDD-NNN
		return utils.GenerateWIPID(ctx, tx, "MLD")
	case db.BatchTypeFINISHED:
		// BNDL-YYMMDD-NNN
		return utils.GenerateBundleID(ctx, tx)
	default:
		return "", 0, fmt.Errorf("unsupported output batch type: %s", outputType)
	}
}
