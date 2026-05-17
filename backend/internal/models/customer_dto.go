package models

type CreateCustomerRequest struct {
	DisplayName    string   `json:"display_name" validate:"required,min=2,max=255"`
	PhoneNumber    string   `json:"phone_number" validate:"max=30"`
	WhatsAppNumber string   `json:"whatsapp_number" validate:"max=30"`
	Email          string   `json:"email" validate:"max=255"`
	GSTNumber      string   `json:"gst_number" validate:"max=30"`
	CompanyName    string   `json:"company_name" validate:"max=255"`
	Notes          string   `json:"notes"`
	Aliases        []string `json:"aliases" validate:"max=20,dive,max=255"`
}

type CustomerReadModel struct {
	ID             string `json:"id"`
	DisplayName    string `json:"display_name"`
	CompanyName    string `json:"company_name"`
	PhoneNumber    string `json:"phone_number"`
	WhatsAppNumber string `json:"whatsapp_number"`
	Email          string `json:"email"`
	GSTNumber      string `json:"gst_number"`
	Notes          string `json:"notes"`
	IsActive       bool   `json:"is_active"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type CustomerConfidenceMetadata struct {
	Score  float64 `json:"score"`
	Level  string  `json:"level"`
	Reason string  `json:"reason"`
}

type CustomerSearchResult struct {
	ID           string                     `json:"id"`
	DisplayName  string                     `json:"display_name"`
	CompanyName  string                     `json:"company_name"`
	PhoneNumber  string                     `json:"phone_number"`
	MatchSource  string                     `json:"match_source"`
	MatchedValue string                     `json:"matched_value"`
	Confidence   CustomerConfidenceMetadata `json:"confidence"`
}

type CustomerSearchPage struct {
	Items    []CustomerSearchResult `json:"items"`
	Page     int32                  `json:"page"`
	PageSize int32                  `json:"page_size"`
	Total    int                    `json:"total"`
}

type CustomerCreateResponse struct {
	Resolution string                 `json:"resolution"`
	Customer   *CustomerReadModel     `json:"customer,omitempty"`
	Matches    []CustomerSearchResult `json:"matches,omitempty"`
}
