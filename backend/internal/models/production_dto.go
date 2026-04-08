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
