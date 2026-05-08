package models

// SteelSpecs defines the strict JSONB structure accepted for steel item dimensions.
// Accepts both legacy keys (thickness, width) and normalized keys (thickness_mm, width_mm).
// Backend always stores normalized keys.
type SteelSpecs struct {
	Thickness   float64 `json:"thickness,omitempty" validate:"omitempty,gt=0"`
	ThicknessMM float64 `json:"thickness_mm,omitempty" validate:"omitempty,gt=0"`
	Width       float64 `json:"width,omitempty" validate:"omitempty,gt=0"`
	WidthMM     float64 `json:"width_mm,omitempty" validate:"omitempty,gt=0"`
	Grade       string  `json:"grade,omitempty" validate:"omitempty,max=32"`
	Diameter    float64 `json:"diameter,omitempty" validate:"omitempty,gt=0"`
}

// NormalizedThickness returns thickness_mm if set, else thickness.
func (s SteelSpecs) NormalizedThickness() float64 {
	if s.ThicknessMM > 0 {
		return s.ThicknessMM
	}
	return s.Thickness
}

// NormalizedWidth returns width_mm if set, else width.
func (s SteelSpecs) NormalizedWidth() float64 {
	if s.WidthMM > 0 {
		return s.WidthMM
	}
	return s.Width
}

// ToNormalized returns a new SteelSpecs with only _mm keys set.
func (s SteelSpecs) ToNormalized() SteelSpecs {
	return SteelSpecs{
		ThicknessMM: s.NormalizedThickness(),
		WidthMM:     s.NormalizedWidth(),
		Grade:       s.Grade,
		Diameter:    s.Diameter,
	}
}

// IsValid returns true if at least one dimension is set.
func (s SteelSpecs) IsValid() bool {
	return s.NormalizedThickness() > 0 || s.NormalizedWidth() > 0 || s.Diameter > 0
}

// CreateItemRequest is the validated API payload for item creation.
type CreateItemRequest struct {
	ParentID          *string    `json:"parent_id,omitempty" validate:"omitempty,uuid4"`
	SKU               string     `json:"sku,omitempty" validate:"omitempty,min=2,max=64,printascii"`
	Name              string     `json:"name" validate:"required,min=2,max=120"`
	Category          string     `json:"category" validate:"required,oneof=RAW SEMI_FINISHED FINISHED SCRAP"`
	CategoryCode      string     `json:"category_code,omitempty" validate:"omitempty,min=1,max=4"`
	BaseUnit          string     `json:"base_unit" validate:"required,oneof=WEIGHT COUNT LENGTH"`
	Specs             SteelSpecs `json:"specs"`
	LowStockThreshold float64    `json:"low_stock_threshold,omitempty" validate:"omitempty,gte=0"`
}
