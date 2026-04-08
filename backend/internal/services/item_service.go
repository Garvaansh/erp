package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrInvalidParentID     = errors.New("invalid parent_id")
	ErrInvalidItemPayload  = errors.New("invalid item payload")
	ErrInvalidItemCategory = errors.New("invalid item category")
	ErrDuplicateSKU        = errors.New("duplicate sku")
	ErrCreateItemFailed    = errors.New("unable to create item")
	ErrListItemsFailed     = errors.New("unable to list items")
	ErrListVariantsFailed  = errors.New("unable to list variants")
)

type ItemService struct {
	queries *db.Queries
}

type SelectableItemOption struct {
	ItemID   string `json:"item_id"`
	Label    string `json:"label"`
	Category string `json:"category"`
}

func NewItemService(queries *db.Queries) *ItemService {
	return &ItemService{queries: queries}
}

func (s *ItemService) CreateItem(ctx context.Context, req models.CreateItemRequest) (db.Item, error) {
	return s.FindOrCreateItem(ctx, req)
}

func (s *ItemService) FindOrCreateItem(ctx context.Context, req models.CreateItemRequest) (db.Item, error) {
	var zero db.Item

	specsJSON, err := json.Marshal(req.Specs)
	if err != nil {
		return zero, ErrInvalidItemPayload
	}

	var parentID pgtype.UUID
	if req.ParentID != nil {
		trimmedParentID := strings.TrimSpace(*req.ParentID)
		if trimmedParentID != "" {
			parsedParentID, parseErr := uuid.Parse(trimmedParentID)
			if parseErr != nil {
				return zero, ErrInvalidParentID
			}
			parentID = pgtype.UUID{Bytes: [16]byte(parsedParentID), Valid: true}
		}
	}

	trimmedSKU := strings.TrimSpace(req.SKU)
	sku := pgtype.Text{String: trimmedSKU, Valid: trimmedSKU != ""}

	item, err := s.queries.CreateItem(ctx, db.CreateItemParams{
		ParentID: parentID,
		Sku:      sku,
		Name:     strings.TrimSpace(req.Name),
		Category: db.ItemCategory(req.Category),
		BaseUnit: db.BaseUnitType(req.BaseUnit),
		Specs:    specsJSON,
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
		specsLabel := compactSpecsForLabel(row.Specs)
		items = append(items, SelectableItemOption{
			ItemID:   uuidString(row.ID),
			Label:    fmt.Sprintf("%s (%s)", strings.TrimSpace(row.Name), specsLabel),
			Category: string(row.Category),
		})
	}

	return items, nil
}

func compactSpecsForLabel(specs []byte) string {
	trimmed := bytes.TrimSpace(specs)
	if len(trimmed) == 0 {
		return "{}"
	}

	var out bytes.Buffer
	if err := json.Compact(&out, trimmed); err != nil {
		return string(trimmed)
	}

	return out.String()
}
