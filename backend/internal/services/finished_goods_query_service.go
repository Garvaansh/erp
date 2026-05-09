package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/utils"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrFinishedGoodsQueryFailed  = errors.New("unable to get finished goods")
	ErrFinishedGoodNotFound      = errors.New("finished good not found")
	ErrFinishedGoodNotConfigured = errors.New("finished good is not configured for this raw material and diameter")
)

type FinishedGoodsQueryService struct {
	pool *pgxpool.Pool
}

type FinishedGoodMasterRow struct {
	ItemID       string  `json:"item_id"`
	SKU          string  `json:"sku"`
	Name         string  `json:"name"`
	Diameter     float64 `json:"diameter"`
	AvailableQty float64 `json:"available_qty"`
	ReservedQty  float64 `json:"reserved_qty"`
	Status       string  `json:"status"`
}

type FinishedGoodSummary struct {
	ItemID                string  `json:"item_id"`
	SKU                   string  `json:"sku"`
	Name                  string  `json:"name"`
	Diameter              float64 `json:"diameter"`
	TotalQty              float64 `json:"total_qty"`
	AvailableQty          float64 `json:"available_qty"`
	ReservedQty           float64 `json:"reserved_qty"`
	HoldQty               float64 `json:"hold_qty"`
	Status                string  `json:"status"`
	BatchCount            int32   `json:"batch_count"`
	LinkedRawMaterialID   string  `json:"linked_raw_material_id,omitempty"`
	LinkedRawMaterialSKU  string  `json:"linked_raw_material_sku,omitempty"`
	LinkedRawMaterialName string  `json:"linked_raw_material_name,omitempty"`
	LinkedRawMaterialSpec string  `json:"linked_raw_material_specification,omitempty"`
}

type FinishedGoodBatchRow struct {
	BatchID               string  `json:"batch_id"`
	BatchCode             string  `json:"batch_code"`
	CreatedAt             string  `json:"created_at"`
	InitialQty            float64 `json:"initial_qty"`
	RemainingQty          float64 `json:"remaining_qty"`
	ReservedQty           float64 `json:"reserved_qty"`
	AvailableQty          float64 `json:"available_qty"`
	Status                string  `json:"status"`
	SourceMoldedBatchID   string  `json:"source_molded_batch_id,omitempty"`
	SourceMoldedBatchCode string  `json:"source_molded_batch_code,omitempty"`
}

type FinishedGoodRecentPolishingRow struct {
	JournalID             string `json:"journal_id"`
	CreatedAt             string `json:"created_at"`
	FinishedBatchID       string `json:"finished_batch_id"`
	FinishedBatchCode     string `json:"finished_batch_code"`
	SourceMoldedBatchID   string `json:"source_molded_batch_id,omitempty"`
	SourceMoldedBatchCode string `json:"source_molded_batch_code,omitempty"`
	OutputQty             string `json:"output_qty"`
	ScrapQty              string `json:"scrap_qty"`
	ShortlengthQty        string `json:"shortlength_qty"`
	ProcessLossQty        string `json:"process_loss_qty"`
	OperatorName          string `json:"operator_name,omitempty"`
}

type FinishedGoodLineageBatchRow struct {
	BatchID      string  `json:"batch_id"`
	BatchCode    string  `json:"batch_code"`
	CreatedAt    string  `json:"created_at"`
	Status       string  `json:"status"`
	AvailableQty float64 `json:"available_qty"`
	ProducedQty  float64 `json:"produced_qty,omitempty"`
	LatestUsedAt string  `json:"latest_used_at,omitempty"`
	VendorName   string  `json:"vendor_name,omitempty"`
	PONumber     string  `json:"po_number,omitempty"`
}

type FinishedGoodDetail struct {
	Summary               FinishedGoodSummary              `json:"summary"`
	Batches               []FinishedGoodBatchRow           `json:"batches"`
	RecentPolishingOutput []FinishedGoodRecentPolishingRow `json:"recent_polishing_output"`
	SourceMoldedBatches   []FinishedGoodLineageBatchRow    `json:"source_molded_batches"`
	SourceRawBatches      []FinishedGoodLineageBatchRow    `json:"source_raw_batches"`
}

func NewFinishedGoodsQueryService(pool *pgxpool.Pool) *FinishedGoodsQueryService {
	return &FinishedGoodsQueryService{pool: pool}
}

func (s *FinishedGoodsQueryService) ListFinishedGoods(ctx context.Context) ([]FinishedGoodMasterRow, error) {
	if s == nil || s.pool == nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	rows, err := db.New(s.pool).GetFinishedGoodsMaster(ctx)
	if err != nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	out := make([]FinishedGoodMasterRow, 0, len(rows))
	for _, row := range rows {
		availableQty, _ := numericToFloat64(row.AvailableQty)
		reservedQty, _ := numericToFloat64(row.ReservedQty)
		diameter, _ := numericToFloat64(row.Diameter)
		threshold, _ := numericToFloat64(row.LowStockThreshold)

		out = append(out, FinishedGoodMasterRow{
			ItemID:       uuidString(row.ItemID),
			SKU:          row.Sku,
			Name:         row.Name,
			Diameter:     diameter,
			AvailableQty: availableQty,
			ReservedQty:  reservedQty,
			Status:       computeFinishedGoodsStatus(availableQty, threshold),
		})
	}

	return out, nil
}

func (s *FinishedGoodsQueryService) GetFinishedGoodDetail(ctx context.Context, productID string) (*FinishedGoodDetail, error) {
	if s == nil || s.pool == nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	parsedID, ok := parseUUID(productID)
	if !ok {
		return nil, ErrFinishedGoodNotFound
	}

	queries := db.New(s.pool)
	summaryRow, err := queries.GetFinishedGoodSummary(ctx, parsedID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFinishedGoodNotFound
		}
		return nil, ErrFinishedGoodsQueryFailed
	}

	batchesRows, err := queries.GetFinishedGoodBatches(ctx, parsedID)
	if err != nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	recentRows, err := queries.GetFinishedGoodRecentPolishingOutput(ctx, db.GetFinishedGoodRecentPolishingOutputParams{
		ItemID:    parsedID,
		PageLimit: 10,
	})
	if err != nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	sourceMoldedRows, err := queries.GetFinishedGoodSourceMoldedBatches(ctx, parsedID)
	if err != nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	sourceRawRows, err := queries.GetFinishedGoodSourceRawBatches(ctx, parsedID)
	if err != nil {
		return nil, ErrFinishedGoodsQueryFailed
	}

	totalQty, _ := numericToFloat64(summaryRow.TotalQty)
	availableQty, _ := numericToFloat64(summaryRow.AvailableQty)
	reservedQty, _ := numericToFloat64(summaryRow.ReservedQty)
	holdQty, _ := numericToFloat64(summaryRow.HoldQty)
	diameter, _ := numericToFloat64(summaryRow.Diameter)
	threshold, _ := numericToFloat64(summaryRow.LowStockThreshold)

	detail := &FinishedGoodDetail{
		Summary: FinishedGoodSummary{
			ItemID:                uuidString(summaryRow.ItemID),
			SKU:                   summaryRow.Sku,
			Name:                  summaryRow.Name,
			Diameter:              diameter,
			TotalQty:              totalQty,
			AvailableQty:          availableQty,
			ReservedQty:           reservedQty,
			HoldQty:               holdQty,
			Status:                computeFinishedGoodsStatus(availableQty, threshold),
			BatchCount:            summaryRow.BatchCount,
			LinkedRawMaterialID:   uuidString(summaryRow.LinkedRawMaterialID),
			LinkedRawMaterialSKU:  strings.TrimSpace(summaryRow.LinkedRawMaterialSku),
			LinkedRawMaterialName: strings.TrimSpace(summaryRow.LinkedRawMaterialName),
			LinkedRawMaterialSpec: utils.FormatSpecification(summaryRow.LinkedRawMaterialSpecs),
		},
		Batches:               make([]FinishedGoodBatchRow, 0, len(batchesRows)),
		RecentPolishingOutput: make([]FinishedGoodRecentPolishingRow, 0, len(recentRows)),
		SourceMoldedBatches:   make([]FinishedGoodLineageBatchRow, 0, len(sourceMoldedRows)),
		SourceRawBatches:      make([]FinishedGoodLineageBatchRow, 0, len(sourceRawRows)),
	}

	for _, row := range batchesRows {
		initialQty, _ := numericToFloat64(row.InitialQty)
		remainingQty, _ := numericToFloat64(row.RemainingQty)
		reservedQty, _ := numericToFloat64(row.ReservedQty)
		availableQty, _ := numericToFloat64(row.AvailableQty)

		detail.Batches = append(detail.Batches, FinishedGoodBatchRow{
			BatchID:               uuidString(row.ID),
			BatchCode:             row.BatchCode,
			CreatedAt:             fgTimestampValue(row.CreatedAt),
			InitialQty:            initialQty,
			RemainingQty:          remainingQty,
			ReservedQty:           reservedQty,
			AvailableQty:          availableQty,
			Status:                string(row.Status),
			SourceMoldedBatchID:   uuidString(row.ParentBatchID),
			SourceMoldedBatchCode: strings.TrimSpace(row.SourceMoldedBatchCode),
		})
	}

	for _, row := range recentRows {
		detail.RecentPolishingOutput = append(detail.RecentPolishingOutput, FinishedGoodRecentPolishingRow{
			JournalID:             uuidString(row.JournalID),
			CreatedAt:             fgTimestampValue(row.CreatedAt),
			FinishedBatchID:       uuidString(row.FinishedBatchID),
			FinishedBatchCode:     row.FinishedBatchCode,
			SourceMoldedBatchID:   uuidString(row.SourceMoldedBatchID),
			SourceMoldedBatchCode: strings.TrimSpace(row.SourceMoldedBatchCode),
			OutputQty:             numericToDecimalString(row.FinishedQty),
			ScrapQty:              numericToDecimalString(row.ScrapQty),
			ShortlengthQty:        numericToDecimalString(row.ShortlengthQty),
			ProcessLossQty:        numericToDecimalString(row.ProcessLossQty),
			OperatorName:          strings.TrimSpace(row.OperatorName),
		})
	}

	for _, row := range sourceMoldedRows {
		availableQty, _ := numericToFloat64(row.AvailableQty)
		producedQty, _ := numericToFloat64(row.ProducedQty)

		detail.SourceMoldedBatches = append(detail.SourceMoldedBatches, FinishedGoodLineageBatchRow{
			BatchID:      uuidString(row.ID),
			BatchCode:    row.BatchCode,
			CreatedAt:    fgTimestampValue(row.CreatedAt),
			Status:       string(row.Status),
			AvailableQty: availableQty,
			ProducedQty:  producedQty,
			LatestUsedAt: fgTimestampAny(row.LatestPolishedAt),
		})
	}

	for _, row := range sourceRawRows {
		availableQty, _ := numericToFloat64(row.AvailableQty)

		detail.SourceRawBatches = append(detail.SourceRawBatches, FinishedGoodLineageBatchRow{
			BatchID:      uuidString(row.ID),
			BatchCode:    row.BatchCode,
			CreatedAt:    fgTimestampValue(row.CreatedAt),
			Status:       string(row.Status),
			AvailableQty: availableQty,
			LatestUsedAt: fgTimestampAny(row.LatestUsedAt),
			VendorName:   strings.TrimSpace(row.VendorName),
			PONumber:     strings.TrimSpace(row.PoNumber),
		})
	}

	return detail, nil
}

func computeFinishedGoodsStatus(available float64, threshold float64) string {
	if available <= 0 {
		return "OUT"
	}
	if threshold > 0 && available <= threshold {
		return "LOW"
	}
	return "OK"
}

func numericToDecimalString(value pgtype.Numeric) string {
	if scaled, ok := scaledFromNumericApprox(value); ok {
		return scaledToDecimalString(scaled)
	}
	return "0.0000"
}

func fgTimestampValue(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}

func fgTimestampAny(value any) string {
	switch typed := value.(type) {
	case time.Time:
		return typed.UTC().Format(time.RFC3339)
	case pgtype.Timestamptz:
		return fgTimestampValue(typed)
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}
