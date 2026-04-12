package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	decimalScale          int64 = 10000
	absoluteToleranceMass int64 = 2 * decimalScale
)

var (
	ErrInvalidWIPPayload      = errors.New("invalid wip payload")
	ErrWIPNoteRequired        = errors.New("note is required when mass-balance exceeds tolerance")
	ErrWIPInsufficientStock   = errors.New("insufficient stock")
	ErrInvalidBatchType       = errors.New("invalid source batch type for this stage")
	ErrWIPDiameterRequired    = errors.New("diameter is required on the source molded batch")
	ErrPendingApprovalOnly    = errors.New("journal is not pending approval")
	ErrWIPApproveUnauthorized = errors.New("admin privileges required")
	ErrProcessWIPFailed       = errors.New("unable to process wip transaction")
)

type WIPJournalResult struct {
	JournalID        string `json:"journal_id"`
	MovementGroupID  string `json:"movement_group_id"`
	Status           string `json:"status"`
	RequiresApproval bool   `json:"requires_approval"`
	Difference       string `json:"difference"`
	Tolerance        string `json:"tolerance"`
	OutputBatchID    string `json:"output_batch_id,omitempty"`
}

type PendingWIPApproval struct {
	JournalID       string `json:"journal_id"`
	MovementGroupID string `json:"movement_group_id"`
	SourceBatchID   string `json:"source_batch_id"`
	SourceBatchCode string `json:"source_batch_code"`
	SourceBatchType string `json:"source_batch_type"`
	InputWeight     string `json:"input_weight"`
	ExpectedTotal   string `json:"expected_total"`
	Difference      string `json:"difference"`
	Tolerance       string `json:"tolerance"`
	Note            string `json:"note"`
	CreatedAt       string `json:"created_at"`
	CreatedBy       string `json:"created_by"`
}

type WIPActivityEntry struct {
	JournalID     string `json:"journal_id"`
	CreatedAt     string `json:"created_at"`
	BatchCode     string `json:"batch_code"`
	ItemSKU       string `json:"item_sku"`
	ItemName      string `json:"item_name"`
	Workstation   string `json:"workstation"`
	InputQty      string `json:"input_qty"`
	OutputQty     string `json:"output_qty"`
	ScrapQty      string `json:"scrap_qty"`
	ShortQty      string `json:"short_qty"`
	Difference    string `json:"difference"`
	Status        string `json:"status"`
	ApprovalState string `json:"approval_state"`
	OperatorName  string `json:"operator_name,omitempty"`
}

type WIPProductionService struct {
	pool *pgxpool.Pool
}

func NewWIPProductionService(pool *pgxpool.Pool) *WIPProductionService {
	return &WIPProductionService{pool: pool}
}

func (s *WIPProductionService) ListActivityEntries(ctx context.Context, fromDate, toDate string, limit, offset int32) ([]WIPActivityEntry, error) {
	if s == nil || s.pool == nil {
		return nil, ErrProcessWIPFailed
	}

	fromDate = strings.TrimSpace(fromDate)
	toDate = strings.TrimSpace(toDate)
	if fromDate == "" {
		fromDate = time.Now().UTC().Format("2006-01-02")
	}
	if toDate == "" {
		toDate = fromDate
	}

	fromTime, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return nil, ErrInvalidWIPPayload
	}
	toTime, err := time.Parse("2006-01-02", toDate)
	if err != nil {
		return nil, ErrInvalidWIPPayload
	}
	if toTime.Before(fromTime) {
		return nil, ErrInvalidWIPPayload
	}
	if toTime.Sub(fromTime) > 7*24*time.Hour {
		return nil, ErrInvalidWIPPayload
	}

	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	toExclusive := toTime.Add(24 * time.Hour)

	queries := db.New(s.pool)
	rows, err := queries.ListWIPActivityEntries(ctx, db.ListWIPActivityEntriesParams{
		FromTs:     pgtype.Timestamptz{Time: fromTime.UTC(), Valid: true},
		ToTs:       pgtype.Timestamptz{Time: toExclusive.UTC(), Valid: true},
		PageLimit:  limit,
		PageOffset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list wip activity entries: %w", err)
	}

	out := make([]WIPActivityEntry, 0, len(rows))
	for _, row := range rows {
		inputScaled, okInput := scaledFromNumericApprox(row.InputQty)
		outputScaled, okOutput := scaledFromNumericApprox(row.FinishedQty)
		scrapScaled, okScrap := scaledFromNumericApprox(row.ScrapQty)
		shortScaled, okShort := scaledFromNumericApprox(row.ShortlengthQty)
		lossScaled, okLoss := scaledFromNumericApprox(row.ProcessLossQty)

		differenceScaled := int64(0)
		displayStatus := "FLAGGED"
		if okInput && okOutput && okScrap && okShort && okLoss {
			differenceScaled = inputScaled - (outputScaled + scrapScaled + shortScaled + lossScaled)
			absDifference := differenceScaled
			if absDifference < 0 {
				absDifference = -absDifference
			}

			_, toleranceScaled, withinTolerance := evaluateMassBalance(
				inputScaled,
				outputScaled,
				scrapScaled,
				shortScaled,
				lossScaled,
			)

			switch {
			case absDifference == 0:
				displayStatus = "BALANCED"
			case row.Status == db.ProductionJournalStatusPENDINGAPPROVAL:
				displayStatus = "FLAGGED"
			case withinTolerance && absDifference <= toleranceScaled:
				displayStatus = "TOLERANCE"
			default:
				displayStatus = "FLAGGED"
			}
		}

		workstation := "UNKNOWN"
		switch row.SourceBatchType {
		case db.BatchTypeRAW:
			workstation = "MOLDING"
		case db.BatchTypeMOLDED:
			workstation = "POLISHING"
		}

		createdAt := ""
		if row.CreatedAt.Valid {
			createdAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		out = append(out, WIPActivityEntry{
			JournalID:     uuidString(row.ID),
			CreatedAt:     createdAt,
			BatchCode:     row.BatchCode,
			ItemSKU:       strings.TrimSpace(row.ItemSku),
			ItemName:      strings.TrimSpace(row.ItemName),
			Workstation:   workstation,
			InputQty:      scaledToDecimalString(inputScaled),
			OutputQty:     scaledToDecimalString(outputScaled),
			ScrapQty:      scaledToDecimalString(scrapScaled),
			ShortQty:      scaledToDecimalString(shortScaled),
			Difference:    scaledToDecimalString(differenceScaled),
			Status:        displayStatus,
			ApprovalState: string(row.Status),
			OperatorName:  strings.TrimSpace(row.OperatorName),
		})
	}

	return out, nil
}

func (s *WIPProductionService) ListPendingApprovals(ctx context.Context, isAdmin bool, limit, offset int32) ([]PendingWIPApproval, error) {
	if s == nil || s.pool == nil {
		return nil, ErrProcessWIPFailed
	}
	if !isAdmin {
		return nil, ErrWIPApproveUnauthorized
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	queries := db.New(s.pool)
	rows, err := queries.ListPendingApprovals(ctx, db.ListPendingApprovalsParams{
		PageLimit:  limit,
		PageOffset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list pending approvals: %w", err)
	}

	out := make([]PendingWIPApproval, 0, len(rows))
	for _, row := range rows {
		inputScaled, ok1 := scaledFromNumericApprox(row.InputQty)
		finishedScaled, ok2 := scaledFromNumericApprox(row.FinishedQty)
		scrapScaled, ok3 := scaledFromNumericApprox(row.ScrapQty)
		shortScaled, ok4 := scaledFromNumericApprox(row.ShortlengthQty)
		lossScaled, ok5 := scaledFromNumericApprox(row.ProcessLossQty)

		expectedScaled := int64(0)
		differenceScaled := int64(0)
		toleranceScaled := int64(0)
		if ok1 && ok2 && ok3 && ok4 && ok5 {
			expectedScaled = finishedScaled + scrapScaled + shortScaled + lossScaled
			differenceScaled, toleranceScaled, _ = evaluateMassBalance(inputScaled, finishedScaled, scrapScaled, shortScaled, lossScaled)
		}

		note := ""
		if row.Note.Valid {
			note = strings.TrimSpace(row.Note.String)
		}

		createdAt := ""
		if row.CreatedAt.Valid {
			createdAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		out = append(out, PendingWIPApproval{
			JournalID:       uuidString(row.ID),
			MovementGroupID: uuidString(row.MovementGroupID),
			SourceBatchID:   uuidString(row.SourceBatchID),
			SourceBatchCode: row.BatchCode,
			SourceBatchType: string(row.SourceBatchType),
			InputWeight:     scaledToDecimalString(inputScaled),
			ExpectedTotal:   scaledToDecimalString(expectedScaled),
			Difference:      scaledToDecimalString(differenceScaled),
			Tolerance:       scaledToDecimalString(toleranceScaled),
			Note:            note,
			CreatedAt:       createdAt,
			CreatedBy:       uuidString(row.CreatedBy),
		})
	}

	return out, nil
}

func (s *WIPProductionService) ProcessMolding(ctx context.Context, input models.ProcessMoldingInput) (*WIPJournalResult, error) {
	stage := wipStageRequest{
		sourceBatchID:  input.SourceBatchID,
		inputQty:       input.InputWeight,
		outputQty:      input.MoldedOutput,
		scrapQty:       input.ScrapQty,
		shortlengthQty: input.ShortlengthQty,
		processLossQty: input.ProcessLossQty,
		diameter:       input.Diameter,
		note:           input.Note,
		performedBy:    input.PerformedBy,
		idempotencyKey: input.IdempotencyKey,
		sourceType:     db.BatchTypeRAW,
		stageLabel:     "molding",
	}
	return s.processStage(ctx, stage)
}

func (s *WIPProductionService) ProcessPolishing(ctx context.Context, input models.ProcessPolishingInput) (*WIPJournalResult, error) {
	stage := wipStageRequest{
		sourceBatchID:  input.SourceBatchID,
		inputQty:       input.MoldedInput,
		outputQty:      input.FinishedOutput,
		scrapQty:       input.PolishingScrapQty,
		shortlengthQty: input.PolishingShortlength,
		processLossQty: input.FinalAdjustmentQty,
		diameter:       "",
		note:           input.Note,
		performedBy:    input.PerformedBy,
		idempotencyKey: input.IdempotencyKey,
		sourceType:     db.BatchTypeMOLDED,
		stageLabel:     "polishing",
	}
	return s.processStage(ctx, stage)
}

func (s *WIPProductionService) RejectJournal(ctx context.Context, journalID, adminID, note string, isAdmin bool) (*WIPJournalResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrProcessWIPFailed
	}
	if !isAdmin {
		return nil, ErrWIPApproveUnauthorized
	}

	parsedJournalID, ok := parseUUID(journalID)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	parsedAdminID, ok := parseUUID(adminID)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin rejection transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	journal, err := qtx.GetJournalByIDForUpdate(ctx, parsedJournalID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidWIPPayload
		}
		return nil, fmt.Errorf("get journal for rejection: %w", err)
	}
	if journal.Status != db.ProductionJournalStatusPENDINGAPPROVAL {
		return nil, ErrPendingApprovalOnly
	}

	if _, err := qtx.GetBatchForUpdate(ctx, journal.SourceBatchID); err != nil {
		return nil, fmt.Errorf("get source batch for rejection: %w", err)
	}

	if _, err := qtx.ReleaseBatchReservation(ctx, db.ReleaseBatchReservationParams{
		Qty: journal.InputQty,
		ID:  journal.SourceBatchID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWIPInsufficientStock
		}
		return nil, fmt.Errorf("release source batch reservation: %w", err)
	}

	rejectedJournal, err := qtx.RejectJournal(ctx, db.RejectJournalParams{
		RejectedBy:    parsedAdminID,
		RejectionNote: strings.TrimSpace(note),
		ID:            parsedJournalID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPendingApprovalOnly
		}
		return nil, fmt.Errorf("reject journal: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit rejection transaction: %w", err)
	}
	committed = true

	return buildWIPJournalResult(rejectedJournal, ""), nil
}

func (s *WIPProductionService) ApproveJournal(ctx context.Context, journalID, adminID, note string, isAdmin bool) (*WIPJournalResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrProcessWIPFailed
	}
	if !isAdmin {
		return nil, ErrWIPApproveUnauthorized
	}

	parsedJournalID, ok := parseUUID(journalID)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	parsedAdminID, ok := parseUUID(adminID)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin approval transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	journal, err := qtx.GetJournalByIDForUpdate(ctx, parsedJournalID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidWIPPayload
		}
		return nil, fmt.Errorf("get journal for approval: %w", err)
	}
	if journal.Status != db.ProductionJournalStatusPENDINGAPPROVAL {
		return nil, ErrPendingApprovalOnly
	}

	sourceBatch, err := qtx.GetBatchForUpdate(ctx, journal.SourceBatchID)
	if err != nil {
		return nil, fmt.Errorf("get source batch for approval: %w", err)
	}

	approvedJournal, err := qtx.ApproveJournal(ctx, db.ApproveJournalParams{
		ApprovedBy:   parsedAdminID,
		ApprovalNote: strings.TrimSpace(note),
		ID:           parsedJournalID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPendingApprovalOnly
		}
		return nil, fmt.Errorf("approve journal: %w", err)
	}

	outputBatchID, err := finalizeJournal(ctx, tx, qtx, approvedJournal, sourceBatch, parsedAdminID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approval transaction: %w", err)
	}
	committed = true

	return buildWIPJournalResult(approvedJournal, outputBatchID), nil
}

type wipStageRequest struct {
	sourceBatchID  string
	inputQty       string
	outputQty      string
	scrapQty       string
	shortlengthQty string
	processLossQty string
	diameter       string
	note           string
	performedBy    string
	idempotencyKey string
	sourceType     db.BatchType
	stageLabel     string
}

func (s *WIPProductionService) processStage(ctx context.Context, req wipStageRequest) (*WIPJournalResult, error) {
	if s == nil || s.pool == nil {
		return nil, ErrProcessWIPFailed
	}

	sourceBatchID, ok := parseUUID(req.sourceBatchID)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	performedBy, ok := parseUUID(req.performedBy)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	if strings.TrimSpace(req.idempotencyKey) == "" {
		return nil, ErrInvalidWIPPayload
	}

	inputScaled, ok := parseDecimalStringToScaled(req.inputQty, false)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	outputScaled, ok := parseDecimalStringToScaled(req.outputQty, true)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	scrapScaled, ok := parseDecimalStringToScaled(req.scrapQty, true)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	shortScaled, ok := parseDecimalStringToScaled(req.shortlengthQty, true)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	processLossScaled, ok := parseDecimalStringToScaled(req.processLossQty, true)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	if outputScaled+scrapScaled+shortScaled+processLossScaled <= 0 {
		return nil, ErrInvalidWIPPayload
	}

	diffScaled, toleranceScaled, withinTolerance := evaluateMassBalance(inputScaled, outputScaled, scrapScaled, shortScaled, processLossScaled)
	note := strings.TrimSpace(req.note)
	if !withinTolerance && note == "" {
		return nil, ErrWIPNoteRequired
	}

	inputNumeric, ok := numericFromScaled(inputScaled)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	outputNumeric, ok := numericFromScaled(outputScaled)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	scrapNumeric, ok := numericFromScaled(scrapScaled)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	shortNumeric, ok := numericFromScaled(shortScaled)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}
	processLossNumeric, ok := numericFromScaled(processLossScaled)
	if !ok {
		return nil, ErrInvalidWIPPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin stage transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", req.idempotencyKey); err != nil {
		return nil, fmt.Errorf("acquire idempotency lock: %w", err)
	}

	movementGroupUUID := uuid.NewSHA1(uuid.NameSpaceURL, []byte(req.idempotencyKey))
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	existing, err := qtx.GetJournalByMovementGroup(ctx, movementGroupID)
	if err == nil {
		return buildWIPJournalResult(existing, ""), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("get existing journal by movement group: %w", err)
	}

	sourceBatch, err := qtx.GetBatchForUpdate(ctx, sourceBatchID)
	if err != nil {
		return nil, fmt.Errorf("get source batch for stage: %w", err)
	}
	if sourceBatch.Type != req.sourceType {
		return nil, ErrInvalidBatchType
	}

	sourceRemainingScaled, ok := scaledFromNumericApprox(sourceBatch.RemainingQty)
	if !ok {
		return nil, ErrProcessWIPFailed
	}
	if _, _, err := applyBatchConsumption(sourceRemainingScaled, inputScaled); err != nil {
		return nil, ErrWIPInsufficientStock
	}

	if req.sourceType == db.BatchTypeMOLDED && !sourceBatch.Diameter.Valid {
		return nil, ErrWIPDiameterRequired
	}

	_, err = qtx.ReserveBatchStock(ctx, db.ReserveBatchStockParams{Qty: inputNumeric, ID: sourceBatchID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWIPInsufficientStock
		}
		return nil, fmt.Errorf("reserve source batch stock: %w", err)
	}

	journalStatus := db.ProductionJournalStatusFINAL
	if !withinTolerance {
		journalStatus = db.ProductionJournalStatusPENDINGAPPROVAL
	}

	diameterNumeric := sourceBatch.Diameter
	if req.sourceType == db.BatchTypeRAW {
		diameterScaled, ok := parseDecimalStringToScaled(req.diameter, false)
		if !ok {
			return nil, ErrInvalidWIPPayload
		}
		diameterNumeric, ok = numericFromScaled(diameterScaled)
		if !ok {
			return nil, ErrInvalidWIPPayload
		}
	}

	journal, err := qtx.CreateWIPJournal(ctx, db.CreateWIPJournalParams{
		MovementGroupID: movementGroupID,
		SourceBatchID:   sourceBatchID,
		InputQty:        inputNumeric,
		FinishedQty:     outputNumeric,
		ScrapQty:        scrapNumeric,
		ShortlengthQty:  shortNumeric,
		ProcessLossQty:  processLossNumeric,
		LossReason: pgtype.Text{
			String: fmt.Sprintf("mass_diff=%s tolerance=%s", scaledToDecimalString(diffScaled), scaledToDecimalString(toleranceScaled)),
			Valid:  true,
		},
		Status:    journalStatus,
		Diameter:  diameterNumeric,
		Note:      pgtype.Text{String: note, Valid: note != ""},
		CreatedBy: performedBy,
	})
	if err != nil {
		return nil, fmt.Errorf("create wip journal: %w", err)
	}

	outputBatchID := ""
	if journalStatus == db.ProductionJournalStatusFINAL {
		outputBatchID, err = finalizeJournal(ctx, tx, qtx, journal, sourceBatch, performedBy)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit stage transaction: %w", err)
	}
	committed = true

	result := buildWIPJournalResult(journal, outputBatchID)
	result.Difference = scaledToDecimalString(diffScaled)
	result.Tolerance = scaledToDecimalString(toleranceScaled)
	return result, nil
}

func finalizeJournal(ctx context.Context, tx pgx.Tx, qtx *db.Queries, journal db.ProductionJournal, sourceBatch db.InventoryBatch, performedBy pgtype.UUID) (string, error) {
	_, err := qtx.FinalizeBatchReservation(ctx, db.FinalizeBatchReservationParams{
		Qty: journal.InputQty,
		ID:  sourceBatch.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrWIPInsufficientStock
		}
		return "", fmt.Errorf("finalize source reservation: %w", err)
	}

	if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: journal.MovementGroupID,
		ItemID:          sourceBatch.ItemID,
		BatchID:         sourceBatch.ID,
		Direction:       db.TxDirectionOUT,
		Quantity:        journal.InputQty,
		ReferenceType:   db.TxReferenceTypePRODUCTIONJOURNAL,
		ReferenceID:     journal.ID,
		PerformedBy:     performedBy,
		Notes: pgtype.Text{
			String: "WIP source consumption finalized",
			Valid:  true,
		},
	}); err != nil {
		return "", fmt.Errorf("record source batch transaction: %w", err)
	}

	finishedQty, ok := numericToFloat64(journal.FinishedQty)
	if !ok {
		return "", ErrProcessWIPFailed
	}
	if finishedQty <= 0 {
		return "", nil
	}

	outputType, err := resolveOutputType(sourceBatch.Type)
	if err != nil {
		return "", err
	}

	item, err := qtx.GetItem(ctx, sourceBatch.ItemID)
	if err != nil {
		return "", fmt.Errorf("get output item: %w", err)
	}

	dailySequence, err := nextWIPDailySequenceByType(ctx, tx, outputType)
	if err != nil {
		return "", fmt.Errorf("generate derived batch sequence: %w", err)
	}

	nowUTC := time.Now().UTC()
	batchCode, err := generateStageBatchCode(outputType, item.Sku.String, nowUTC, dailySequence)
	if err != nil {
		return "", err
	}

	reservedZero, ok := numericFromScaled(0)
	if !ok {
		return "", ErrProcessWIPFailed
	}
	diameter := journal.Diameter
	if !diameter.Valid {
		diameter = sourceBatch.Diameter
	}
	parentBatchID := pgtype.UUID{}
	if outputType == db.BatchTypeFINISHED {
		parentBatchID = sourceBatch.ID
	}

	derivedBatch, err := qtx.CreateDerivedBatch(ctx, db.CreateDerivedBatchParams{
		ItemID:        sourceBatch.ItemID,
		BatchCode:     batchCode,
		DailySequence: dailySequence,
		InitialQty:    journal.FinishedQty,
		RemainingQty:  journal.FinishedQty,
		ReservedQty:   reservedZero,
		Status:        db.BatchStatusACTIVE,
		Type:          outputType,
		Diameter:      diameter,
		ParentBatchID: parentBatchID,
	})
	if err != nil {
		return "", fmt.Errorf("create derived output batch: %w", err)
	}

	if _, err := qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: journal.MovementGroupID,
		ItemID:          derivedBatch.ItemID,
		BatchID:         derivedBatch.ID,
		Direction:       db.TxDirectionIN,
		Quantity:        journal.FinishedQty,
		ReferenceType:   db.TxReferenceTypePRODUCTIONJOURNAL,
		ReferenceID:     journal.ID,
		PerformedBy:     performedBy,
		Notes: pgtype.Text{
			String: "WIP final output receipt",
			Valid:  true,
		},
	}); err != nil {
		return "", fmt.Errorf("record derived batch transaction: %w", err)
	}

	return uuidString(derivedBatch.ID), nil
}

func resolveOutputType(sourceType db.BatchType) (db.BatchType, error) {
	switch sourceType {
	case db.BatchTypeRAW:
		return db.BatchTypeMOLDED, nil
	case db.BatchTypeMOLDED:
		return db.BatchTypeFINISHED, nil
	default:
		return "", ErrInvalidBatchType
	}
}

func applyBatchConsumption(remainingScaled, consumeScaled int64) (int64, bool, error) {
	if consumeScaled <= 0 {
		return 0, false, ErrInvalidWIPPayload
	}
	if remainingScaled < consumeScaled {
		return 0, false, ErrWIPInsufficientStock
	}
	nextRemaining := remainingScaled - consumeScaled
	return nextRemaining, nextRemaining == 0, nil
}

func nextWIPDailySequenceByType(ctx context.Context, tx pgx.Tx, batchType db.BatchType) (int32, error) {
	nowUTC := time.Now().UTC()
	todayToken := nowUTC.Format("20060102")
	lockKey := fmt.Sprintf("wip-seq:%s:%s", batchType, todayToken)

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", lockKey); err != nil {
		return 0, err
	}

	dayStartUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	dayEndUTC := dayStartUTC.Add(24 * time.Hour)

	var nextSequence int32
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(daily_sequence), 0) + 1
		FROM inventory_batches
		WHERE type = $1
		  AND created_at >= $2
		  AND created_at < $3
	`, batchType, dayStartUTC, dayEndUTC).Scan(&nextSequence)
	if err != nil {
		return 0, err
	}

	return nextSequence, nil
}

func evaluateMassBalance(inputQty, outputQty, scrapQty, shortlengthQty, processLossQty int64) (int64, int64, bool) {
	total := outputQty + scrapQty + shortlengthQty + processLossQty
	diff := inputQty - total
	if diff < 0 {
		diff = -diff
	}
	onePctTolerance := ceilDiv(inputQty, 100)
	fivePctCap := ceilDiv(inputQty*5, 100)
	tolerance := absoluteToleranceMass
	if onePctTolerance > tolerance {
		tolerance = onePctTolerance
	}
	if fivePctCap > 0 && tolerance > fivePctCap {
		tolerance = fivePctCap
	}
	if tolerance <= 0 {
		tolerance = 1
	}
	return diff, tolerance, diff <= tolerance
}

func numericFromScaled(value int64) (pgtype.Numeric, bool) {
	sign := ""
	absValue := value
	if value < 0 {
		sign = "-"
		absValue = -value
	}
	numericText := fmt.Sprintf("%s%d.%04d", sign, absValue/decimalScale, absValue%decimalScale)

	var numeric pgtype.Numeric
	if err := numeric.Scan(numericText); err != nil {
		return pgtype.Numeric{}, false
	}
	return numeric, true
}

func parseDecimalStringToScaled(raw string, allowZero bool) (int64, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, false
	}
	value = strings.TrimPrefix(value, "+")
	if strings.HasPrefix(value, "-") {
		return 0, false
	}
	if strings.Count(value, ".") > 1 {
		return 0, false
	}

	parts := strings.SplitN(value, ".", 2)
	wholePart := parts[0]
	if wholePart == "" {
		wholePart = "0"
	}
	if !allDigits(wholePart) {
		return 0, false
	}

	fractionPart := ""
	if len(parts) == 2 {
		fractionPart = parts[1]
		if fractionPart == "" {
			fractionPart = "0"
		}
		if !allDigits(fractionPart) {
			return 0, false
		}
		if len(fractionPart) > 4 {
			return 0, false
		}
	}

	whole, err := strconv.ParseInt(wholePart, 10, 64)
	if err != nil {
		return 0, false
	}
	if whole > math.MaxInt64/decimalScale {
		return 0, false
	}

	for len(fractionPart) < 4 {
		fractionPart += "0"
	}
	fraction := int64(0)
	if fractionPart != "" {
		fraction, err = strconv.ParseInt(fractionPart, 10, 64)
		if err != nil {
			return 0, false
		}
	}

	scaled := whole*decimalScale + fraction
	if !allowZero && scaled <= 0 {
		return 0, false
	}
	if allowZero && scaled < 0 {
		return 0, false
	}
	return scaled, true
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func scaledToDecimalString(value int64) string {
	sign := ""
	absValue := value
	if value < 0 {
		sign = "-"
		absValue = -value
	}
	return fmt.Sprintf("%s%d.%04d", sign, absValue/decimalScale, absValue%decimalScale)
}

func ceilDiv(numerator, denominator int64) int64 {
	if denominator <= 0 || numerator <= 0 {
		return 0
	}
	return (numerator + denominator - 1) / denominator
}

func scaledFromNumericApprox(value pgtype.Numeric) (int64, bool) {
	floatValue, ok := numericToFloat64(value)
	if !ok {
		return 0, false
	}
	if math.IsNaN(floatValue) || math.IsInf(floatValue, 0) {
		return 0, false
	}
	return int64(math.Round(floatValue * float64(decimalScale))), true
}

func buildWIPJournalResult(journal db.ProductionJournal, outputBatchID string) *WIPJournalResult {
	inputScaled, ok1 := scaledFromNumericApprox(journal.InputQty)
	finishedScaled, ok2 := scaledFromNumericApprox(journal.FinishedQty)
	scrapScaled, ok3 := scaledFromNumericApprox(journal.ScrapQty)
	shortScaled, ok4 := scaledFromNumericApprox(journal.ShortlengthQty)
	lossScaled, ok5 := scaledFromNumericApprox(journal.ProcessLossQty)

	diff := int64(0)
	tolerance := int64(0)
	if ok1 && ok2 && ok3 && ok4 && ok5 {
		diff, tolerance, _ = evaluateMassBalance(inputScaled, finishedScaled, scrapScaled, shortScaled, lossScaled)
	}

	return &WIPJournalResult{
		JournalID:        uuidString(journal.ID),
		MovementGroupID:  uuidString(journal.MovementGroupID),
		Status:           string(journal.Status),
		RequiresApproval: journal.Status == db.ProductionJournalStatusPENDINGAPPROVAL,
		Difference:       scaledToDecimalString(diff),
		Tolerance:        scaledToDecimalString(tolerance),
		OutputBatchID:    outputBatchID,
	}
}

func generateFinishedBundleBatchCode(sku string, createdAt time.Time, sequence int32) string {
	return fmt.Sprintf(
		"BNDL-%s-%s-%02d",
		sanitizeBundleSKUToken(sku),
		createdAt.UTC().Format("20060102"),
		sequence,
	)
}

func generateMoldedWIPBatchCode(sku string, createdAt time.Time, sequence int32) string {
	return fmt.Sprintf(
		"MWIP-%s-%s-%02d",
		sanitizeBundleSKUToken(sku),
		createdAt.UTC().Format("20060102"),
		sequence,
	)
}

func generateStageBatchCode(batchType db.BatchType, sku string, createdAt time.Time, sequence int32) (string, error) {
	switch batchType {
	case db.BatchTypeMOLDED:
		return generateMoldedWIPBatchCode(sku, createdAt, sequence), nil
	case db.BatchTypeFINISHED:
		return generateFinishedBundleBatchCode(sku, createdAt, sequence), nil
	default:
		return "", ErrInvalidBatchType
	}
}

func sanitizeBundleSKUToken(raw string) string {
	sku := strings.ToUpper(strings.TrimSpace(raw))
	if sku == "" {
		return "NA"
	}

	var builder strings.Builder
	builder.Grow(len(sku))
	for _, r := range sku {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == 'X' {
			builder.WriteRune(r)
		}
	}

	cleaned := builder.String()
	if cleaned == "" {
		return "NA"
	}

	return cleaned
}
