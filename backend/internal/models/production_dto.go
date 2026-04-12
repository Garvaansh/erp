package models

// DailyLogRequest is the API payload submitted by workers from the factory floor.
type DailyLogRequest struct {
	SourceBatchID   string     `json:"source_batch_id" validate:"required,uuid4"`
	OutputItemName  string     `json:"output_item_name" validate:"required,min=2,max=120"`
	OutputItemSpecs SteelSpecs `json:"output_item_specs" validate:"required"`
	InputQty        float64    `json:"input_qty" validate:"required,gt=0"`
	FinishedQty     float64    `json:"finished_qty" validate:"required,gte=0"`
	ScrapQty        float64    `json:"scrap_qty" validate:"gte=0"`
	LossReason      string     `json:"loss_reason,omitempty" validate:"omitempty,max=500"`
}

// ProcessDailyLogInput is the service input after auth context has been applied.
type ProcessDailyLogInput struct {
	SourceBatchID   string
	OutputItemName  string
	OutputItemSpecs SteelSpecs
	InputQty        float64
	FinishedQty     float64
	ScrapQty        float64
	LossReason      string
	WorkerID        string
	IdempotencyKey  string
}

// MoldingRequest captures the stage-1 WIP payload from shop-floor operators.
type MoldingRequest struct {
	SourceBatchID  string `json:"source_batch_id" validate:"required,uuid4"`
	InputWeight    string `json:"input_weight" validate:"required,max=32"`
	MoldedOutput   string `json:"molded_output" validate:"required,max=32"`
	ScrapQty       string `json:"scrap_qty" validate:"required,max=32"`
	ShortlengthQty string `json:"shortlength_qty" validate:"required,max=32"`
	ProcessLossQty string `json:"process_loss_qty" validate:"required,max=32"`
	Diameter       string `json:"diameter" validate:"required,max=32"`
	Note           string `json:"note,omitempty" validate:"omitempty,max=500"`
}

// PolishingRequest captures stage-2 WIP payload from polishing operations.
type PolishingRequest struct {
	SourceBatchID        string `json:"source_batch_id" validate:"required,uuid4"`
	MoldedInput          string `json:"molded_input" validate:"required,max=32"`
	FinishedOutput       string `json:"finished_output" validate:"required,max=32"`
	PolishingScrapQty    string `json:"polishing_scrap_qty" validate:"required,max=32"`
	PolishingShortlength string `json:"polishing_shortlength_qty" validate:"required,max=32"`
	FinalAdjustmentQty   string `json:"final_adjustment_qty" validate:"required,max=32"`
	Note                 string `json:"note,omitempty" validate:"omitempty,max=500"`
}

// ApproveProductionJournalRequest allows admins to annotate an approval action.
type ApproveProductionJournalRequest struct {
	Note string `json:"note,omitempty" validate:"omitempty,max=500"`
}

// RejectProductionJournalRequest allows admins to annotate a rejection action.
type RejectProductionJournalRequest struct {
	Note string `json:"note,omitempty" validate:"omitempty,max=500"`
}

// ProcessMoldingInput is the internal service input after auth/idempotency enrichment.
type ProcessMoldingInput struct {
	SourceBatchID  string
	InputWeight    string
	MoldedOutput   string
	ScrapQty       string
	ShortlengthQty string
	ProcessLossQty string
	Diameter       string
	Note           string
	PerformedBy    string
	IdempotencyKey string
}

// ProcessPolishingInput is the internal service input after auth/idempotency enrichment.
type ProcessPolishingInput struct {
	SourceBatchID        string
	MoldedInput          string
	FinishedOutput       string
	PolishingScrapQty    string
	PolishingShortlength string
	FinalAdjustmentQty   string
	Note                 string
	PerformedBy          string
	IdempotencyKey       string
}
