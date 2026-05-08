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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidParentID     = errors.New("invalid parent_id")
	ErrInvalidItemPayload  = errors.New("invalid item payload")
	ErrInvalidItemCategory = errors.New("invalid item category")
	ErrDuplicateSKU        = errors.New("duplicate sku")
	ErrCreateItemFailed    = errors.New("unable to create item")
	ErrListItemsFailed     = errors.New("unable to list items")
	ErrListVariantsFailed  = errors.New("unable to list variants")
	ErrUpdateThresholdFail = errors.New("unable to update threshold")
	ErrItemNotFound        = errors.New("item not found")
)

type ItemService struct {
	queries *db.Queries
	pool    *pgxpool.Pool
}

type SelectableItemOption struct {
	ItemID   string `json:"item_id"`
	Label    string `json:"label"`
	Category string `json:"category"`
}

func NewItemService(queries *db.Queries, pool *pgxpool.Pool) *ItemService {
	return &ItemService{queries: queries, pool: pool}
}

func (s *ItemService) CreateItem(ctx context.Context, req models.CreateItemRequest) (db.Item, error) {
	return s.FindOrCreateItem(ctx, req)
}

func (s *ItemService) FindOrCreateItem(ctx context.Context, req models.CreateItemRequest) (db.Item, error) {
	var zero db.Item

	// Normalize specs to always use _mm keys for storage
	normalizedSpecs := req.Specs.ToNormalized()

	// For RAW items, always use transactional SKU generation when pool is available
	if strings.ToUpper(req.Category) == "RAW" && s.pool != nil {
		return s.createRawItemWithSKU(ctx, req, normalizedSpecs)
	}

	specsJSON, err := json.Marshal(normalizedSpecs)
	if err != nil {
		return zero, ErrInvalidItemPayload
	}

	parentID := parseOptionalParentID(req.ParentID)

	trimmedSKU := strings.TrimSpace(req.SKU)
	sku := pgtype.Text{String: trimmedSKU, Valid: trimmedSKU != ""}

	item, err := s.queries.CreateItem(ctx, db.CreateItemParams{
		ParentID:     parentID,
		Sku:          sku,
		Name:         strings.TrimSpace(req.Name),
		Category:     db.ItemCategory(req.Category),
		BaseUnit:     db.BaseUnitType(req.BaseUnit),
		Specs:        specsJSON,
		CategoryCode: pgtype.Text{},
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return zero, ErrDuplicateSKU
		}

		return zero, ErrCreateItemFailed
	}

	return item, nil
}

func (s *ItemService) createRawItemWithSKU(ctx context.Context, req models.CreateItemRequest, normalizedSpecs models.SteelSpecs) (db.Item, error) {
	var zero db.Item

	specsJSON, err := json.Marshal(normalizedSpecs)
	if err != nil {
		return zero, ErrInvalidItemPayload
	}

	parentID := parseOptionalParentID(req.ParentID)

	// Derive category code: use explicit value, or derive from material name
	categoryCode := strings.ToUpper(strings.TrimSpace(req.CategoryCode))
	if categoryCode == "" {
		categoryCode = deriveCategoryCode(req.Name)
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return zero, fmt.Errorf("begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	// Generate SKU if we have a valid category code
	var sku pgtype.Text
	if categoryCode != "" {
		generatedSKU, skuErr := utils.GenerateSKU(ctx, tx, categoryCode)
		if skuErr != nil {
			return zero, fmt.Errorf("generate SKU: %w", skuErr)
		}
		sku = pgtype.Text{String: generatedSKU, Valid: true}
	}

	qtx := db.New(tx)
	item, err := qtx.CreateItem(ctx, db.CreateItemParams{
		ParentID:     parentID,
		Sku:          sku,
		Name:         strings.TrimSpace(req.Name),
		Category:     db.ItemCategory(req.Category),
		BaseUnit:     db.BaseUnitType(req.BaseUnit),
		Specs:        specsJSON,
		CategoryCode: pgtype.Text{String: categoryCode, Valid: categoryCode != ""},
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return zero, ErrDuplicateSKU
		}
		return zero, ErrCreateItemFailed
	}

	// Persist low stock threshold if provided
	if req.LowStockThreshold > 0 {
		thresholdNumeric, ok := numericFromFloat(req.LowStockThreshold)
		if ok {
			if _, threshErr := qtx.UpdateItemThreshold(ctx, db.UpdateItemThresholdParams{
				ID:                item.ID,
				LowStockThreshold: thresholdNumeric,
			}); threshErr != nil {
				return zero, fmt.Errorf("persist threshold: %w", threshErr)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return zero, fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	return item, nil
}

// deriveCategoryCode generates a 2-char code from the material name.
// "Stainless Steel" → "SS", "Carbon Plate" → "CP", "Hot Rolled" → "HR"
func deriveCategoryCode(name string) string {
	words := strings.Fields(strings.TrimSpace(name))
	if len(words) == 0 {
		return "RM"
	}

	var code strings.Builder
	for _, word := range words {
		upper := strings.ToUpper(word)
		// Skip filler words
		switch upper {
		case "COIL", "SHEET", "PLATE", "STRIP", "BAR", "ROD", "PIPE", "TUBE":
			continue
		}
		if code.Len() < 2 && len(upper) > 0 {
			code.WriteByte(upper[0])
		}
		if code.Len() >= 2 {
			break
		}
	}

	result := code.String()
	if result == "" {
		return "RM"
	}
	if len(result) < 2 {
		return result + "M"
	}
	return result
}

func (s *ItemService) ListItemsByCategory(ctx context.Context, category string, limit, offset int32) ([]db.Item, error) {
	itemCategory := db.ItemCategory(strings.ToUpper(strings.TrimSpace(category)))
	switch itemCategory {
	case db.ItemCategoryRAW, db.ItemCategorySEMIFINISHED, db.ItemCategoryFINISHED, db.ItemCategorySCRAP:
	default:
		return nil, ErrInvalidItemCategory
	}

	items, err := s.queries.ListActiveItemsByCategory(ctx, db.ListActiveItemsByCategoryParams{
		Category: itemCategory,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, ErrListItemsFailed
	}

	return items, nil
}

func (s *ItemService) ListVariants(ctx context.Context, parentID string, limit, offset int32) ([]db.Item, error) {
	parsedParentID, err := uuid.Parse(strings.TrimSpace(parentID))
	if err != nil {
		return nil, ErrInvalidParentID
	}

	items, err := s.queries.ListVariantsByParent(ctx, db.ListVariantsByParentParams{
		ParentID: pgtype.UUID{Bytes: [16]byte(parsedParentID), Valid: true},
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, ErrListVariantsFailed
	}

	return items, nil
}

func (s *ItemService) GetSelectableItems(ctx context.Context) ([]SelectableItemOption, error) {
	rows, err := s.queries.GetSelectableItems(ctx)
	if err != nil {
		return nil, ErrListItemsFailed
	}

	items := make([]SelectableItemOption, 0, len(rows))
	for _, row := range rows {
		specsLabel := utils.FormatSpecification(row.Specs)
		if specsLabel == "" {
			specsLabel = compactSpecsForLabel(row.Specs)
		}

		items = append(items, SelectableItemOption{
			ItemID:   uuidString(row.ID),
			Label:    fmt.Sprintf("%s (%s)", strings.TrimSpace(row.Name), specsLabel),
			Category: string(row.Category),
		})
	}

	return items, nil
}

func (s *ItemService) UpdateThreshold(ctx context.Context, itemID string, threshold float64) (db.Item, error) {
	var zero db.Item

	parsedID, ok := parseUUID(itemID)
	if !ok {
		return zero, ErrItemNotFound
	}

	thresholdNumeric := zeroNumeric()
	if threshold > 0 {
		if parsed, ok := numericFromFloat(threshold); ok {
			thresholdNumeric = parsed
		}
	}

	if s.pool == nil {
		return zero, ErrUpdateThresholdFail
	}

	qtx := db.New(s.pool)
	item, err := qtx.UpdateItemThreshold(ctx, db.UpdateItemThresholdParams{
		ID:                parsedID,
		LowStockThreshold: thresholdNumeric,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return zero, ErrItemNotFound
		}
		return zero, ErrUpdateThresholdFail
	}

	return item, nil
}

func parseOptionalParentID(parentID *string) pgtype.UUID {
	if parentID == nil {
		return pgtype.UUID{}
	}
	trimmed := strings.TrimSpace(*parentID)
	if trimmed == "" {
		return pgtype.UUID{}
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: [16]byte(parsed), Valid: true}
}

func compactSpecsForLabel(specs []byte) string {
	trimmed := strings.TrimSpace(string(specs))
	if len(trimmed) == 0 || trimmed == "{}" {
		return "{}"
	}
	return trimmed
}
