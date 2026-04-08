package services

import (
	"encoding/json"
	"log"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ItemResponse struct {
	ID        string            `json:"id"`
	ParentID  *string           `json:"parent_id,omitempty"`
	SKU       string            `json:"sku,omitempty"`
	Name      string            `json:"name"`
	Category  string            `json:"category"`
	BaseUnit  string            `json:"base_unit"`
	Specs     models.SteelSpecs `json:"specs"`
	IsActive  bool              `json:"is_active"`
	CreatedAt string            `json:"created_at,omitempty"`
	UpdatedAt string            `json:"updated_at,omitempty"`
}

func MapItemResponse(item db.Item) ItemResponse {
	response := ItemResponse{
		ID:       uuidString(item.ID),
		Name:     item.Name,
		Category: string(item.Category),
		BaseUnit: string(item.BaseUnit),
		IsActive: item.IsActive,
		Specs:    models.SteelSpecs{},
	}

	if item.ParentID.Valid {
		parentID := uuidString(item.ParentID)
		if parentID != "" {
			response.ParentID = &parentID
		}
	}

	if item.Sku.Valid {
		response.SKU = item.Sku.String
	}

	if item.CreatedAt.Valid {
		response.CreatedAt = item.CreatedAt.Time.UTC().Format(time.RFC3339)
	}

	if item.UpdatedAt.Valid {
		response.UpdatedAt = item.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}

	if len(item.Specs) > 0 {
		var specs models.SteelSpecs
		if err := json.Unmarshal(item.Specs, &specs); err != nil {
			log.Printf("WARN: item specs json parse failed item_id=%s: %v", response.ID, err)
			response.Specs = models.SteelSpecs{}
		} else {
			response.Specs = specs
		}
	}

	return response
}

func MapItemsResponse(items []db.Item) []ItemResponse {
	out := make([]ItemResponse, 0, len(items))
	for _, item := range items {
		out = append(out, MapItemResponse(item))
	}
	return out
}

func uuidString(value pgtype.UUID) string {
	if !value.Valid {
		return ""
	}
	return uuid.UUID(value.Bytes).String()
}
