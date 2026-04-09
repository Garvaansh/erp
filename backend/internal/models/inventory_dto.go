package models

// ReceiveStockRequest is the validated API payload for stock receipts.
type ReceiveStockRequest struct {
	ItemID   string  `json:"item_id" validate:"required,uuid4"`
	Quantity float64 `json:"quantity" validate:"required,gt=0"`
}
