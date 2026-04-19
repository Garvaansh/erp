package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const minYieldRatio = 0.98

var (
	ErrInvalidDailyLogPayload  = errors.New("invalid daily log payload")
	ErrYieldLossReasonRequired = errors.New("loss reason required when yield is below 98%")
	ErrInsufficientStock       = errors.New("insufficient stock")
	ErrProcessDailyLogFailed   = errors.New("unable to process daily log")
)

type ProductionService struct {
	pool *pgxpool.Pool
}

type ProcessDailyLogResult struct {
	MovementGroupID string `json:"movement_group_id"`
	JournalID       string `json:"journal_id"`
	FinishedBatchID string `json:"finished_batch_id,omitempty"`
}

func NewProductionService(pool *pgxpool.Pool) *ProductionService {
	return &ProductionService{pool: pool}
}

func (s *ProductionService) ProcessDailyLog(ctx context.Context, input models.ProcessDailyLogInput) (*ProcessDailyLogResult, error) {
	if s == nil {
		return nil, ErrProcessDailyLogFailed
	}

	var ok bool

	sourceBatchID, ok := parseUUID(input.SourceBatchID)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}

	workerID, ok := parseUUID(input.WorkerID)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}

	outputName := strings.TrimSpace(input.OutputItemName)
	if outputName == "" || input.InputQty <= 0 || input.FinishedQty < 0 || input.ScrapQty < 0 {
		return nil, ErrInvalidDailyLogPayload
	}

	idempotencyKey := strings.TrimSpace(input.IdempotencyKey)
	if idempotencyKey == "" {
		return nil, ErrInvalidDailyLogPayload
	}

	if input.FinishedQty+input.ScrapQty <= 0 {
		return nil, ErrInvalidDailyLogPayload
	}

	yieldRatio := (input.FinishedQty + input.ScrapQty) / input.InputQty
	lossReason := strings.TrimSpace(input.LossReason)
	if yieldRatio < minYieldRatio && lossReason == "" {
		return nil, ErrYieldLossReasonRequired
	}

	if s.pool == nil {
		return nil, ErrProcessDailyLogFailed
	}

	inputQty, ok := numericFromFloat(input.InputQty)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}
	negInputQty, ok := numericFromSignedFloat(-input.InputQty)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}
	finishedQty, ok := numericFromSignedFloat(input.FinishedQty)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}
	scrapQty, ok := numericFromSignedFloat(input.ScrapQty)
	if !ok {
		return nil, ErrInvalidDailyLogPayload
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	itemService := NewItemService(qtx)

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", idempotencyKey); err != nil {
		return nil, fmt.Errorf("acquire idempotency lock: %w", err)
	}

	movementGroupUUID := uuid.NewSHA1(uuid.NameSpaceURL, []byte(idempotencyKey))
	movementGroupID := pgtype.UUID{Bytes: [16]byte(movementGroupUUID), Valid: true}

	existingJournal, err := qtx.GetJournalByMovementGroup(ctx, movementGroupID)
	if err == nil {
		return &ProcessDailyLogResult{
			MovementGroupID: movementGroupUUID.String(),
			JournalID:       uuidString(existingJournal.ID),
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("fetch existing journal by movement group: %w", err)
	}

	outputItem, err := itemService.FindOrCreateItem(ctx, models.CreateItemRequest{
		Name:     outputName,
		Category: string(db.ItemCategoryFINISHED),
		BaseUnit: string(db.BaseUnitTypeWEIGHT),
		Specs:    input.OutputItemSpecs,
		SKU:      "SKU-" + strings.ToUpper(movementGroupUUID.String()[0:8]),
	})
	if err != nil {
		return nil, fmt.Errorf("find or create output item: %w", err)
	}

	sourceBatch, err := qtx.GetBatchForUpdate(ctx, sourceBatchID)
	if err != nil {
		return nil, fmt.Errorf("fetch source batch for update: %w", err)
	}

	availableQty, ok := numericToFloat64(sourceBatch.RemainingQty)
	if !ok {
		return nil, fmt.Errorf("parse source batch quantity: %w", ErrProcessDailyLogFailed)
	}

	if input.InputQty > availableQty {
		return nil, fmt.Errorf("%w: requested %.4f, available %.4f", ErrInsufficientStock, input.InputQty, availableQty)
	}

	_, err = qtx.UpdateBatchQuantity(ctx, db.UpdateBatchQuantityParams{
		ID:           sourceBatchID,
		RemainingQty: negInputQty,
	})
	if err != nil {
		return nil, fmt.Errorf("consume source batch quantity: %w", err)
	}

	_, err = qtx.RecordTransaction(ctx, db.RecordTransactionParams{
		MovementGroupID: movementGroupID,
		ItemID:          sourceBatch.ItemID,
		BatchID:         sourceBatchID,
		Direction:       db.TxDirectionOUT,
		Quantity:        inputQty,
		ReferenceType:   string(db.TxReferenceTypePRODUCTIONJOURNAL),
		ReferenceID:     movementGroupID,
		PerformedBy:     workerID,
		Notes:           pgtype.Text{String: "Input consumption for daily log", Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("record input consumption transaction: %w", err)
	}

	result := &ProcessDailyLogResult{
		MovementGroupID: movementGroupUUID.String(),
	}

	if input.FinishedQty > 0 {
		finishedBatchCode, finishedDailySequence, seqErr := utils.GenerateBundleID(ctx, tx)
		if seqErr != nil {
			return nil, fmt.Errorf("generate production batch daily sequence: %w", seqErr)
		}

		reservedQty, ok := numericFromSignedFloat(0)
		if !ok {
			return nil, fmt.Errorf("parse reserved quantity: %w", ErrProcessDailyLogFailed)
		}

		finishedBatch, createErr := qtx.CreateDerivedBatch(ctx, db.CreateDerivedBatchParams{
			ItemID:        outputItem.ID,
			BatchCode:     finishedBatchCode,
			DailySequence: finishedDailySequence,
			InitialQty:    finishedQty,
			RemainingQty:  finishedQty,
			ReservedQty:   reservedQty,
			Status:        db.BatchStatusACTIVE,
			Type:          db.BatchTypeFINISHED,
			Diameter:      sourceBatch.Diameter,
			ParentBatchID: sourceBatch.ID,
		})
		if createErr != nil {
			return nil, fmt.Errorf("create finished batch: %w", createErr)
		}

		_, createErr = qtx.RecordTransaction(ctx, db.RecordTransactionParams{
			MovementGroupID: movementGroupID,
			ItemID:          outputItem.ID,
			BatchID:         finishedBatch.ID,
			Direction:       db.TxDirectionIN,
			Quantity:        finishedQty,
			ReferenceType:   string(db.TxReferenceTypePRODUCTIONJOURNAL),
			ReferenceID:     movementGroupID,
			PerformedBy:     workerID,
			Notes:           pgtype.Text{String: "Finished goods receipt from daily log", Valid: true},
		})
		if createErr != nil {
			return nil, fmt.Errorf("record finished goods transaction: %w", createErr)
		}

		result.FinishedBatchID = uuidString(finishedBatch.ID)
	}

	if input.ScrapQty > 0 {
		scrapItem, createErr := s.getOrCreateScrapItem(ctx, qtx, itemService)
		if createErr != nil {
			return nil, fmt.Errorf("resolve scrap item: %w", createErr)
		}

		_, createErr = qtx.RecordTransaction(ctx, db.RecordTransactionParams{
			MovementGroupID: movementGroupID,
			ItemID:          scrapItem.ID,
			BatchID:         pgtype.UUID{},
			Direction:       db.TxDirectionIN,
			Quantity:        scrapQty,
			ReferenceType:   string(db.TxReferenceTypePRODUCTIONJOURNAL),
			ReferenceID:     movementGroupID,
			PerformedBy:     workerID,
			Notes:           pgtype.Text{String: "Scrap receipt from daily log", Valid: true},
		})
		if createErr != nil {
			return nil, fmt.Errorf("record scrap receipt transaction: %w", createErr)
		}
	}

	journalID, err := qtx.CreateJournal(ctx, db.CreateJournalParams{
		MovementGroupID: movementGroupID,
		SourceBatchID:   sourceBatchID,
		InputQty:        inputQty,
		FinishedQty:     finishedQty,
		ScrapQty:        scrapQty,
		LossReason:      pgtype.Text{String: lossReason, Valid: lossReason != ""},
		CreatedBy:       workerID,
	})
	if err != nil {
		return nil, fmt.Errorf("create production journal: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	result.JournalID = uuidString(journalID)
	return result, nil
}

func (s *ProductionService) getOrCreateScrapItem(ctx context.Context, qtx *db.Queries, itemService *ItemService) (db.Item, error) {
	items, err := qtx.ListActiveItemsByCategory(ctx, db.ListActiveItemsByCategoryParams{
		Category: db.ItemCategorySCRAP,
		Limit:    1,
		Offset:   0,
	})
	if err != nil {
		return db.Item{}, err
	}
	if len(items) > 0 {
		return items[0], nil
	}

	return itemService.FindOrCreateItem(ctx, models.CreateItemRequest{
		Name:     "Steel Scrap",
		Category: string(db.ItemCategorySCRAP),
		BaseUnit: string(db.BaseUnitTypeWEIGHT),
		Specs: models.SteelSpecs{
			Thickness:  1,
			Width:      1,
			Grade:      "SCRAP",
			CoilWeight: 1,
		},
		SKU: "",
	})
}

func numericFromSignedFloat(value float64) (pgtype.Numeric, bool) {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return pgtype.Numeric{}, false
	}

	var numeric pgtype.Numeric
	if err := numeric.Scan(strconv.FormatFloat(value, 'f', 4, 64)); err != nil {
		return pgtype.Numeric{}, false
	}
	return numeric, true
}

func numericToFloat64(value pgtype.Numeric) (float64, bool) {
	floatValue, err := value.Float64Value()
	if err != nil || !floatValue.Valid {
		return 0, false
	}

	if math.IsNaN(floatValue.Float64) || math.IsInf(floatValue.Float64, 0) {
		return 0, false
	}

	return floatValue.Float64, true
}
