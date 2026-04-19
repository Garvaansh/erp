package models

// CreatePaymentRequest defines payload for recording a payment against a purchase order.
type CreatePaymentRequest struct {
	POID        string  `json:"po_id" validate:"required,uuid4"`
	Amount      float64 `json:"amount" validate:"required,gt=0"`
	PaymentDate string  `json:"payment_date,omitempty"`
	Note        string  `json:"note,omitempty" validate:"omitempty,max=500"`
}

// PaymentListFilter defines supported query params for payment listing.
type PaymentListFilter struct {
	POID string `json:"po_id,omitempty" validate:"omitempty,uuid4"`
}
