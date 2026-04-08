package models

// ReceiveStockRequest is the validated API payload for stock receipts.
type ReceiveStockRequest struct {
	ItemID         string             `json:"item_id,omitempty" validate:"omitempty,uuid4"`
	Item           *CreateItemRequest `json:"item,omitempty" validate:"omitempty"`
	BatchCode      string             `json:"batch_code" validate:"required,min=2,max=64,printascii"`
	Quantity       float64            `json:"quantity" validate:"required,gt=0"`
	UnitCost       float64            `json:"unit_cost" validate:"required,gt=0"`
	ReferenceType  string             `json:"reference_type" validate:"required,oneof=PURCHASE_RECEIPT PRODUCTION_JOURNAL TRANSFER ADJUSTMENT"`
	ReferenceID    string             `json:"reference_id" validate:"required,uuid4"`
	IdempotencyKey string             `json:"idempotency_key" validate:"required,uuid4"`
	Notes          string             `json:"notes,omitempty" validate:"omitempty,max=500"`
}
