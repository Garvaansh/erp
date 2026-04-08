package models

// SteelSpecs defines the strict JSONB structure accepted for steel item dimensions.
type SteelSpecs struct {
	Thickness  float64 `json:"thickness" validate:"required,gt=0"`
	Width      float64 `json:"width" validate:"required,gt=0"`
	Grade      string  `json:"grade" validate:"required,min=2,max=40,printascii"`
	CoilWeight float64 `json:"coil_weight" validate:"required,gt=0"`
}

// CreateItemRequest is the validated API payload for item creation.
type CreateItemRequest struct {
	ParentID *string    `json:"parent_id,omitempty" validate:"omitempty,uuid4"`
	SKU      string     `json:"sku" validate:"required,min=2,max=64,printascii"`
	Name     string     `json:"name" validate:"required,min=2,max=120"`
	Category string     `json:"category" validate:"required,oneof=RAW SEMI_FINISHED FINISHED SCRAP"`
	BaseUnit string     `json:"base_unit" validate:"required,oneof=WEIGHT COUNT LENGTH"`
	Specs    SteelSpecs `json:"specs" validate:"required"`
}