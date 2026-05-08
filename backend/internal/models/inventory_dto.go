package models

// ReceiveStockRequest is the validated API payload for stock receipts.
type ReceiveStockRequest struct {
	ItemID   string  `json:"item_id" validate:"required,uuid4"`
	Quantity float64 `json:"quantity" validate:"required,gt=0"`
}

// UpdateBatchStatusRequest is the payload for toggling batch status (HOLD/ACTIVE).
type UpdateBatchStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=HOLD ACTIVE"`
	Reason string `json:"reason"`
}
