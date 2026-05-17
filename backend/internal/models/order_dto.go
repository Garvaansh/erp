package models

type CreateSalesOrderLineRequest struct {
	FinishedGoodItemID string   `json:"finished_good_item_id" validate:"required,uuid4"`
	OrderedQty         float64  `json:"ordered_qty" validate:"required,gt=0"`
	UnitPrice          *float64 `json:"unit_price,omitempty" validate:"omitempty,gte=0"`
}

type CreateSalesOrderRequest struct {
	CustomerID string                        `json:"customer_id" validate:"required,uuid4"`
	Notes      string                        `json:"notes,omitempty"`
	Lines      []CreateSalesOrderLineRequest `json:"lines" validate:"required,min=1,dive"`
}

type DispatchSalesOrderLineRequest struct {
	SalesOrderLineID string  `json:"sales_order_line_id" validate:"required,uuid4"`
	DispatchQty      float64 `json:"dispatch_qty" validate:"required,gt=0"`
}

type DispatchSalesOrderRequest struct {
	Notes string                          `json:"notes,omitempty"`
	Lines []DispatchSalesOrderLineRequest `json:"lines" validate:"required,min=1,dive"`
}

type CancelSalesOrderRequest struct {
	Reason string `json:"reason" validate:"required,min=3,max=500"`
}
