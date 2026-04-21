package models

// CreatePurchaseOrderRequest defines payload for creating a procurement PO.
type CreatePurchaseOrderRequest struct {
	ItemID           string  `json:"item_id" validate:"required,uuid4"`
	VendorID         string  `json:"vendor_id" validate:"required,uuid4"`
	VendorName       string  `json:"vendor_name,omitempty"`
	OrderedQty       float64 `json:"ordered_qty" validate:"required,gt=0"`
	UnitPrice        float64 `json:"unit_price" validate:"required,gt=0"`
	VendorInvoiceRef string  `json:"vendor_invoice_ref,omitempty"`
	Notes            string  `json:"notes,omitempty"`
}

// ReceiveGoodsRequest defines payload for receiving goods against a PO.
type ReceiveGoodsRequest struct {
	Qty float64 `json:"qty" validate:"required,gt=0"`
}

// ReverseReceiptRequest defines payload for reversing a procurement receipt batch.
type ReverseReceiptRequest struct {
	BatchID  string   `json:"batch_id,omitempty" validate:"omitempty,uuid4"`
	BatchIDs []string `json:"batch_ids,omitempty" validate:"omitempty,dive,uuid4"`
	Reason   string   `json:"reason" validate:"required,min=3"`
}

// CloseProcurementOrderRequest defines payload for force-closing short-shipped PO.
type CloseProcurementOrderRequest struct {
	Reason string `json:"reason" validate:"required,min=3"`
}

// UpdatePurchaseOrderRequest defines editable fields for procurement PO updates.
type UpdatePurchaseOrderRequest struct {
	ItemID           *string  `json:"item_id,omitempty" validate:"omitempty,uuid4"`
	OrderedQty       *float64 `json:"ordered_qty,omitempty" validate:"omitempty,gt=0"`
	UnitPrice        *float64 `json:"unit_price,omitempty" validate:"omitempty,gt=0"`
	VendorInvoiceRef *string  `json:"vendor_invoice_ref,omitempty"`
	Notes            *string  `json:"notes,omitempty"`
	EditReason       string   `json:"edit_reason" validate:"required,min=3"`
}
