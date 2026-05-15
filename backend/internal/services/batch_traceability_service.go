package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBatchNotFoundByCode = errors.New("batch not found")
)

// BatchTraceabilityService provides read-only batch traceability queries.
type BatchTraceabilityService struct {
	pool *pgxpool.Pool
}

func NewBatchTraceabilityService(pool *pgxpool.Pool) *BatchTraceabilityService {
	return &BatchTraceabilityService{pool: pool}
}

// ── Response DTOs ──────────────────────────────────────────────────────────

type BatchHeader struct {
	BatchID      string    `json:"batch_id"`
	BatchCode    string    `json:"batch_code"`
	ItemID       string    `json:"item_id"`
	BatchType    string    `json:"batch_type"`
	Status       string    `json:"status"`
	InitialQty   float64   `json:"initial_qty"`
	RemainingQty float64   `json:"remaining_qty"`
	ReservedQty  float64   `json:"reserved_qty"`
	CreatedAt    time.Time `json:"created_at"`
	ItemName     string    `json:"item_name"`
	ItemSKU      string    `json:"item_sku"`
	ItemCategory string    `json:"item_category"`
}

type BatchManufacturingSummary struct {
	ProductionRunID string  `json:"production_run_id"`
	RunSequence     int64   `json:"run_sequence"`
	InputQty        float64 `json:"input_qty"`
	OutputQty       float64 `json:"output_qty"`
	ScrapQty        float64 `json:"scrap_qty"`
	ShortlengthQty  float64 `json:"shortlength_qty"`
	ProcessLossQty  float64 `json:"process_loss_qty"`
	YieldPct        float64 `json:"yield_pct"`
	ProductionStage string  `json:"production_stage"`
	OperatorName    string  `json:"operator_name"`
	Status          string  `json:"status"`
	CreatedAt       string  `json:"created_at"`
}

type LineageNode struct {
	BatchID          string  `json:"batch_id"`
	BatchCode        string  `json:"batch_code"`
	BatchType        string  `json:"batch_type"`
	Status           string  `json:"status"`
	InitialQty       float64 `json:"initial_qty"`
	RemainingQty     float64 `json:"remaining_qty"`
	QuantityConsumed float64 `json:"quantity_consumed"`
	Depth            int32   `json:"depth"`
	CreatedAt        string  `json:"created_at"`
	ItemName         string  `json:"item_name"`
	ItemSKU          string  `json:"item_sku"`
}

type ConsumptionEvent struct {
	ID                   string  `json:"id"`
	ProductionRunID      string  `json:"production_run_id"`
	SourceBatchCode      string  `json:"source_batch_code"`
	SourceBatchType      string  `json:"source_batch_type"`
	TargetBatchCode      string  `json:"target_batch_code"`
	TargetBatchType      string  `json:"target_batch_type"`
	QuantityConsumed     float64 `json:"quantity_consumed"`
	BatchRemainingBefore float64 `json:"batch_remaining_before"`
	BatchRemainingAfter  float64 `json:"batch_remaining_after"`
	CreatedAt            string  `json:"created_at"`
}

type VendorTraceability struct {
	VendorName      string `json:"vendor_name"`
	PONumber        string `json:"po_number"`
	ProcurementDate string `json:"procurement_date"`
	RawBatchCode    string `json:"raw_batch_code"`
}

type BatchTraceabilityResponse struct {
	Header            BatchHeader                `json:"header"`
	Manufacturing     *BatchManufacturingSummary `json:"manufacturing"`
	UpstreamLineage   []LineageNode              `json:"upstream_lineage"`
	ConsumptionEvents []ConsumptionEvent         `json:"consumption_events"`
	VendorInfo        []VendorTraceability       `json:"vendor_info"`
}

// ── Query Method ──────────────────────────────────────────────────────────

func (s *BatchTraceabilityService) GetBatchTraceability(ctx context.Context, batchCode string) (*BatchTraceabilityResponse, error) {
	batchCode = strings.TrimSpace(batchCode)
	if batchCode == "" {
		return nil, ErrBatchNotFoundByCode
	}

	q := db.New(s.pool)

	// 1. Get batch header
	batchRow, err := q.GetBatchByCode(ctx, batchCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBatchNotFoundByCode
		}
		return nil, err
	}

	initialQty, _ := numericToFloat64(batchRow.InitialQty)
	remainingQty, _ := numericToFloat64(batchRow.RemainingQty)
	reservedQty, _ := numericToFloat64(batchRow.ReservedQty)
	createdAt := time.Time{}
	if batchRow.CreatedAt.Valid {
		createdAt = batchRow.CreatedAt.Time
	}

	header := BatchHeader{
		BatchID:      uuidString(batchRow.ID),
		BatchCode:    batchRow.BatchCode,
		ItemID:       uuidString(batchRow.ItemID),
		BatchType:    string(batchRow.Type),
		Status:       string(batchRow.Status),
		InitialQty:   initialQty,
		RemainingQty: remainingQty,
		ReservedQty:  reservedQty,
		CreatedAt:    createdAt,
		ItemName:     batchRow.ItemName,
		ItemSKU:      batchRow.ItemSku,
		ItemCategory: string(batchRow.ItemCategory),
	}

	// 2. Get manufacturing summary (production run that created this batch)
	var manufacturing *BatchManufacturingSummary
	prRow, err := q.GetBatchProductionRun(ctx, batchRow.ID)
	if err == nil {
		inQty, _ := numericToFloat64(prRow.InputQty)
		outQty, _ := numericToFloat64(prRow.OutputQty)
		scrapQty, _ := numericToFloat64(prRow.ScrapQty)
		shortQty, _ := numericToFloat64(prRow.ShortlengthQty)
		lossQty, _ := numericToFloat64(prRow.ProcessLossQty)

		yieldPct := float64(0)
		if inQty > 0 {
			yieldPct = (outQty / inQty) * 100
		}

		stage := "UNKNOWN"
		if prRow.Workstation.Valid {
			stage = strings.TrimSpace(prRow.Workstation.String)
		}

		seq := int64(0)
		if prRow.RunSequence.Valid {
			seq = prRow.RunSequence.Int64
		}

		prCreatedAt := ""
		if prRow.CreatedAt.Valid {
			prCreatedAt = prRow.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		manufacturing = &BatchManufacturingSummary{
			ProductionRunID: uuidString(prRow.ProductionRunID),
			RunSequence:     seq,
			InputQty:        inQty,
			OutputQty:       outQty,
			ScrapQty:        scrapQty,
			ShortlengthQty:  shortQty,
			ProcessLossQty:  lossQty,
			YieldPct:        yieldPct,
			ProductionStage: stage,
			OperatorName:    strings.TrimSpace(prRow.OperatorName),
			Status:          prRow.Status,
			CreatedAt:       prCreatedAt,
		}
	}

	// 3. Get upstream lineage
	lineageRows, err := q.GetBatchUpstreamLineage(ctx, batchRow.ID)
	if err != nil {
		lineageRows = nil
	}

	upstreamLineage := make([]LineageNode, 0, len(lineageRows))
	for _, lr := range lineageRows {
		iQty, _ := numericToFloat64(lr.InitialQty)
		rQty, _ := numericToFloat64(lr.RemainingQty)
		cQty, _ := numericToFloat64(lr.QuantityConsumed)

		lCreatedAt := ""
		if lr.CreatedAt.Valid {
			lCreatedAt = lr.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		upstreamLineage = append(upstreamLineage, LineageNode{
			BatchID:          uuidString(lr.ID),
			BatchCode:        lr.BatchCode,
			BatchType:        string(lr.Type),
			Status:           string(lr.Status),
			InitialQty:       iQty,
			RemainingQty:     rQty,
			QuantityConsumed: cQty,
			Depth:            lr.Depth,
			CreatedAt:        lCreatedAt,
			ItemName:         lr.ItemName,
			ItemSKU:          lr.ItemSku,
		})
	}

	// 4. Get consumption events
	consumptionRows, err := q.GetBatchConsumptionEvents(ctx, batchRow.ID)
	if err != nil {
		consumptionRows = nil
	}

	consumptionEvents := make([]ConsumptionEvent, 0, len(consumptionRows))
	for _, cr := range consumptionRows {
		cQty, _ := numericToFloat64(cr.QuantityConsumed)
		bBefore, _ := numericToFloat64(cr.BatchRemainingBefore)
		bAfter, _ := numericToFloat64(cr.BatchRemainingAfter)

		ceCreatedAt := ""
		if cr.CreatedAt.Valid {
			ceCreatedAt = cr.CreatedAt.Time.UTC().Format(time.RFC3339)
		}

		targetBatchType := ""
		if tbt, ok := cr.TargetBatchType.(string); ok {
			targetBatchType = tbt
		}

		consumptionEvents = append(consumptionEvents, ConsumptionEvent{
			ID:                   uuidString(cr.ID),
			ProductionRunID:      uuidString(cr.ProductionRunID),
			SourceBatchCode:      cr.SourceBatchCode,
			SourceBatchType:      string(cr.SourceBatchType),
			TargetBatchCode:      cr.TargetBatchCode,
			TargetBatchType:      targetBatchType,
			QuantityConsumed:     cQty,
			BatchRemainingBefore: bBefore,
			BatchRemainingAfter:  bAfter,
			CreatedAt:            ceCreatedAt,
		})
	}

	// 5. Get vendor info from raw batches in the lineage
	vendorInfo := make([]VendorTraceability, 0)
	for _, lr := range lineageRows {
		if string(lr.Type) != "RAW" {
			continue
		}
		vi, err := q.GetBatchVendorInfo(ctx, lr.ID)
		if err != nil {
			continue
		}
		procDate := ""
		if vi.ProcurementDate.Valid {
			procDate = vi.ProcurementDate.Time.UTC().Format(time.RFC3339)
		}
		if vi.VendorName != "" || vi.PoNumber != "" {
			vendorInfo = append(vendorInfo, VendorTraceability{
				VendorName:      strings.TrimSpace(vi.VendorName),
				PONumber:        strings.TrimSpace(vi.PoNumber),
				ProcurementDate: procDate,
				RawBatchCode:    vi.RawBatchCode,
			})
		}
	}

	return &BatchTraceabilityResponse{
		Header:            header,
		Manufacturing:     manufacturing,
		UpstreamLineage:   upstreamLineage,
		ConsumptionEvents: consumptionEvents,
		VendorInfo:        vendorInfo,
	}, nil
}
