package dto

import (
	"github.com/google/uuid"
	"time"
)

type InvoiceSnapshot struct {
	Company      CompanySnapshot      `json:"company"`
	Customer     CustomerSnapshot     `json:"customer"`
	OrderLines   []OrderLineSnapshot  `json:"order_lines"`
	Taxes        TaxSnapshot          `json:"taxes"`
	Totals       TotalsSnapshot       `json:"totals"`
	PaymentTerms PaymentTermsSnapshot `json:"payment_terms"`
}

type CompanySnapshot struct {
	CompanyName string `json:"company_name"`
	GSTIN       string `json:"gstin"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Address     string `json:"address"`
	LogoURL     string `json:"logo_url"`
	BankDetails string `json:"bank_details"`
}

type CustomerSnapshot struct {
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	Address      string    `json:"address"`
	GSTIN        string    `json:"gstin"`
}

type OrderLineSnapshot struct {
	ItemID      uuid.UUID `json:"item_id"`
	ItemName    string    `json:"item_name"`
	SKU         string    `json:"sku"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	TotalAmount float64   `json:"total_amount"`
}

type TaxSnapshot struct {
	CGSTPercent float64 `json:"cgst_percent"`
	CGSTAmount  float64 `json:"cgst_amount"`
	SGSTPercent float64 `json:"sgst_percent"`
	SGSTAmount  float64 `json:"sgst_amount"`
	IGSTPercent float64 `json:"igst_percent"`
	IGSTAmount  float64 `json:"igst_amount"`
	TotalTax    float64 `json:"total_tax"`
}

type TotalsSnapshot struct {
	Subtotal   float64 `json:"subtotal"`
	TotalTax   float64 `json:"total_tax"`
	GrandTotal float64 `json:"grand_total"`
}

type PaymentTermsSnapshot struct {
	TermsDays       int    `json:"terms_days"`
	FooterNote      string `json:"footer_note"`
	DeclarationText string `json:"declaration_text"`
}

type InvoiceResponse struct {
	ID            uuid.UUID       `json:"id"`
	OrderID       uuid.UUID       `json:"order_id"`
	InvoiceNumber string          `json:"invoice_number"`
	Snapshot      InvoiceSnapshot `json:"snapshot"`
	GeneratedBy   *uuid.UUID      `json:"generated_by,omitempty"`
	GeneratedAt   time.Time       `json:"generated_at"`
}
