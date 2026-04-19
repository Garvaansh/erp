package models

// CreateVendorRequest is the payload for POST /vendors.
type CreateVendorRequest struct {
	Name          string `json:"name" validate:"required,min=2,max=255"`
	ContactPerson string `json:"contact_person" validate:"max=255"`
	Phone         string `json:"phone" validate:"max=50"`
	Email         string `json:"email" validate:"max=255"`
	Address       string `json:"address"`
	GSTIN         string `json:"gstin" validate:"max=20"`
	PaymentTerms  string `json:"payment_terms" validate:"max=100"`
}

// UpdateVendorRequest is the payload for PUT /vendors/:vendorId.
type UpdateVendorRequest struct {
	Name          *string `json:"name" validate:"omitempty,min=2,max=255"`
	ContactPerson *string `json:"contact_person" validate:"omitempty,max=255"`
	Phone         *string `json:"phone" validate:"omitempty,max=50"`
	Email         *string `json:"email" validate:"omitempty,max=255"`
	Address       *string `json:"address"`
	GSTIN         *string `json:"gstin" validate:"omitempty,max=20"`
	PaymentTerms  *string `json:"payment_terms" validate:"omitempty,max=100"`
	IsActive      *bool   `json:"is_active"`
}

// VendorListRow is the response row for vendor listing.
type VendorListRow struct {
	ID            string `json:"id"`
	VendorCode    string `json:"vendor_code"`
	Name          string `json:"name"`
	ContactPerson string `json:"contact_person"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Address       string `json:"address"`
	GSTIN         string `json:"gstin"`
	PaymentTerms  string `json:"payment_terms"`
	IsActive      bool   `json:"is_active"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// StockAdjustmentRequest is the payload for POST /inventory/adjust.
type StockAdjustmentRequest struct {
	ItemID    string  `json:"item_id" validate:"required"`
	BatchID   string  `json:"batch_id" validate:"required"`
	Direction string  `json:"direction" validate:"required,oneof=IN OUT"`
	Quantity  float64 `json:"quantity" validate:"required,gt=0"`
	Reason    string  `json:"reason" validate:"required,min=3,max=500"`
}

// LowStockAlertRow is a response row for items below minimum stock.
type LowStockAlertRow struct {
	ItemID     string  `json:"item_id"`
	SKU        string  `json:"sku"`
	Name       string  `json:"name"`
	Category   string  `json:"category"`
	CurrentQty float64 `json:"current_qty"`
	MinQty     float64 `json:"min_qty"`
	MaxQty     float64 `json:"max_qty"`
	DeficitQty float64 `json:"deficit_qty"`
}
