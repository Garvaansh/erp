package models

type CreateFinishedGoodRequest struct {
	Name                string  `json:"name" validate:"required,min=2,max=120"`
	LinkedRawMaterialID string  `json:"linked_raw_material_id" validate:"required,uuid4"`
	Diameter            float64 `json:"diameter" validate:"required,gt=0"`
	LowStockThreshold   float64 `json:"low_stock_threshold,omitempty" validate:"omitempty,gte=0"`
}
