package models

// CreatePurchaseOrderRequest defines the payload for drafting procurement orders.
type CreatePurchaseOrderRequest struct {
	ItemID       string  `json:"item_id" validate:"required,uuid4"`
	SupplierName string  `json:"supplier_name" validate:"required,min=2"`
	OrderedQty   float64 `json:"ordered_qty" validate:"required,gt=0"`
	UnitPrice    float64 `json:"unit_price" validate:"required,gt=0"`
}

// ReceiveProcurementRequest defines the payload for physical goods receipt against a PO.
type ReceiveProcurementRequest struct {
	POID                 string  `json:"po_id" validate:"required,uuid4"`
	ActualWeightReceived float64 `json:"actual_weight_received" validate:"required,gt=0"`
}

// VoidProcurementReceiptRequest defines payload to rollback a mistaken goods receipt.
type VoidProcurementReceiptRequest struct {
	POID          string `json:"po_id" validate:"required,uuid4"`
	TransactionID string `json:"transaction_id" validate:"required,uuid4"`
}
