package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/utils"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrFinishedGoodCreateFailed  = errors.New("unable to create finished good")
	ErrFinishedGoodAlreadyExists = errors.New("finished good already exists")
	ErrFinishedGoodInvalidRecipe = errors.New("linked raw material must reference an active raw item")
)

type FinishedGoodsCommandService struct {
	pool *pgxpool.Pool
}

func NewFinishedGoodsCommandService(pool *pgxpool.Pool) *FinishedGoodsCommandService {
	return &FinishedGoodsCommandService{pool: pool}
}

func (s *FinishedGoodsCommandService) CreateFinishedGood(ctx context.Context, req models.CreateFinishedGoodRequest) (db.Item, error) {
	if s == nil || s.pool == nil {
		return db.Item{}, ErrFinishedGoodCreateFailed
	}

	rawItemID, ok := parseUUID(req.LinkedRawMaterialID)
	if !ok {
		return db.Item{}, ErrFinishedGoodInvalidRecipe
	}

	diameterNumeric, ok := numericFromFloat(req.Diameter)
	if !ok {
		return db.Item{}, ErrFinishedGoodCreateFailed
	}

	specsJSON, err := json.Marshal(models.SteelSpecs{Diameter: req.Diameter}.ToNormalized())
	if err != nil {
		return db.Item{}, ErrFinishedGoodCreateFailed
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return db.Item{}, fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	qtx := db.New(tx)
	rawItem, err := qtx.GetItem(ctx, rawItemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Item{}, ErrFinishedGoodInvalidRecipe
		}
		return db.Item{}, ErrFinishedGoodCreateFailed
	}
	if rawItem.Category != db.ItemCategoryRAW || !rawItem.IsActive {
		return db.Item{}, ErrFinishedGoodInvalidRecipe
	}

	sku, err := utils.GenerateFinishedGoodSKU(ctx, tx)
	if err != nil {
		return db.Item{}, fmt.Errorf("generate finished goods sku: %w", err)
	}

	item, err := qtx.CreateItem(ctx, db.CreateItemParams{
		ParentID:            pgtype.UUID{},
		Sku:                 pgtype.Text{String: sku, Valid: true},
		Name:                strings.TrimSpace(req.Name),
		Category:            db.ItemCategoryFINISHED,
		BaseUnit:            db.BaseUnitTypeWEIGHT,
		Specs:               specsJSON,
		CategoryCode:        pgtype.Text{String: "FGP", Valid: true},
		LowStockThreshold:   thresholdNumericOrZero(req.LowStockThreshold),
		LinkedRawMaterialID: rawItemID,
		Diameter:            diameterNumeric,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if pgErr.ConstraintName == "idx_items_finished_recipe_unique" {
				return db.Item{}, ErrFinishedGoodAlreadyExists
			}
			return db.Item{}, ErrDuplicateSKU
		}
		return db.Item{}, ErrFinishedGoodCreateFailed
	}

	if err := tx.Commit(ctx); err != nil {
		return db.Item{}, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return item, nil
}
