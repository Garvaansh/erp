package models

// CreateVendorCommandRequest is the payload for POST /vendors.
type CreateVendorCommandRequest struct {
	Name          string `json:"name" validate:"required,min=2,max=255"`
	Code          string `json:"code" validate:"required,min=3,max=20"`
	ContactPerson string `json:"contact_person" validate:"max=255"`
	Phone         string `json:"phone" validate:"max=50"`
	Email         string `json:"email" validate:"max=255"`
	GSTIN         string `json:"gstin" validate:"max=20"`
	Notes         string `json:"notes"`
}

// UpdateVendorCommandRequest is the payload for PATCH /vendors/:id.
type UpdateVendorCommandRequest struct {
	Name          *string `json:"name" validate:"omitempty,min=2,max=255"`
	Code          *string `json:"code"`
	ContactPerson *string `json:"contact_person" validate:"omitempty,max=255"`
	Phone         *string `json:"phone" validate:"omitempty,max=50"`
	Email         *string `json:"email" validate:"omitempty,max=255"`
	GSTIN         *string `json:"gstin" validate:"omitempty,max=20"`
	Notes         *string `json:"notes"`
	IsActive      *bool   `json:"is_active"`
}

type VendorReadModel struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Code          string `json:"code"`
	ContactPerson string `json:"contact_person"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	GSTIN         string `json:"gstin"`
	IsActive      bool   `json:"is_active"`
	Notes         string `json:"notes"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type VendorProfileSummary struct {
	TotalPurchased float64 `json:"total_purchased"`
	TotalPaid      float64 `json:"total_paid"`
	TotalDue       float64 `json:"total_due"`
}

type VendorProfilePO struct {
	ID        string `json:"id"`
	PONumber  string `json:"po_number"`
	CreatedAt string `json:"created_at"`
}

type VendorProfilePayment struct {
	TransactionID string  `json:"transaction_id"`
	Amount        float64 `json:"amount"`
	PaymentDate   string  `json:"payment_date"`
	PONumber      string  `json:"po_number"`
}

type VendorProfileResponse struct {
	Vendor         VendorReadModel        `json:"vendor"`
	Summary        VendorProfileSummary   `json:"summary"`
	RecentPOs      []VendorProfilePO      `json:"recent_pos"`
	RecentPayments []VendorProfilePayment `json:"recent_payments"`
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
