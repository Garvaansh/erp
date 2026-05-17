package handlers

import (
	"bytes"
	"context"
	"net/http/httptest"
	"testing"

	"github.com/erp/backend/internal/models"
	"github.com/erp/backend/internal/services"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type fakeSalesOrderCommandService struct {
	result *services.SalesOrderMutationResult
	err    error
}

func (f fakeSalesOrderCommandService) CreateSalesOrder(_ context.Context, _ models.CreateSalesOrderRequest, _ string) (*services.SalesOrderMutationResult, error) {
	return f.result, f.err
}

func (f fakeSalesOrderCommandService) DispatchSalesOrder(_ context.Context, _ string, _ models.DispatchSalesOrderRequest, _ string) (*services.SalesOrderMutationResult, error) {
	return f.result, f.err
}

func (f fakeSalesOrderCommandService) CancelSalesOrder(_ context.Context, _ string, _ string, _ string) (*services.SalesOrderMutationResult, error) {
	return f.result, f.err
}

type fakeSalesOrderQueryService struct {
	listResult                 *services.SalesOrderListPage
	detailResult               *services.SalesOrderDetail
	allocationsResult          []services.SalesOrderAllocationView
	finishedReservationsResult *services.FinishedGoodReservationVisibility
	batchReservationsResult    *services.BatchReservationDrillDown
	err                        error
}

func (f fakeSalesOrderQueryService) ListSalesOrders(_ context.Context, _ string, _ int32, _ int32) (*services.SalesOrderListPage, error) {
	return f.listResult, f.err
}

func (f fakeSalesOrderQueryService) GetSalesOrderDetail(_ context.Context, _ string) (*services.SalesOrderDetail, error) {
	return f.detailResult, f.err
}

func (f fakeSalesOrderQueryService) GetOrderAllocations(_ context.Context, _ string) ([]services.SalesOrderAllocationView, error) {
	return f.allocationsResult, f.err
}

func (f fakeSalesOrderQueryService) GetFinishedGoodReservations(_ context.Context, _ string) (*services.FinishedGoodReservationVisibility, error) {
	return f.finishedReservationsResult, f.err
}

func (f fakeSalesOrderQueryService) GetBatchReservations(_ context.Context, _ string) (*services.BatchReservationDrillDown, error) {
	return f.batchReservationsResult, f.err
}

func TestOrderHandlerCreateSalesOrder(t *testing.T) {
	userID := uuid.NewString()
	customerID := uuid.NewString()
	itemID := uuid.NewString()

	handler := NewOrderHandler(
		fakeSalesOrderCommandService{
			result: &services.SalesOrderMutationResult{
				Order: &services.SalesOrderDetail{ID: uuid.NewString(), Status: "RESERVED"},
			},
		},
		fakeSalesOrderQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/orders", func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return handler.CreateSalesOrder(c)
	})

	body := []byte(`{"customer_id":"` + customerID + `","lines":[{"finished_good_item_id":"` + itemID + `","ordered_qty":10}]}`)
	req := httptest.NewRequest("POST", "/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
}

func TestOrderHandlerDispatchConflict(t *testing.T) {
	orderID := uuid.NewString()
	lineID := uuid.NewString()
	userID := uuid.NewString()

	handler := NewOrderHandler(
		fakeSalesOrderCommandService{err: services.ErrSalesOrderStateConflict},
		fakeSalesOrderQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/orders/:id/dispatch", func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return handler.DispatchSalesOrder(c)
	})

	body := []byte(`{"lines":[{"sales_order_line_id":"` + lineID + `","dispatch_qty":10}]}`)
	req := httptest.NewRequest("POST", "/orders/"+orderID+"/dispatch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
}

func TestOrderHandlerListSalesOrders(t *testing.T) {
	handler := NewOrderHandler(
		fakeSalesOrderCommandService{},
		fakeSalesOrderQueryService{
			listResult: &services.SalesOrderListPage{
				Items: []services.SalesOrderListRow{{ID: uuid.NewString(), OrderNumber: "SO-260517-001"}},
				Page:  1,
			},
		},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Get("/orders", handler.ListSalesOrders)

	req := httptest.NewRequest("GET", "/orders?page=1&page_size=20", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestOrderHandlerGetFinishedGoodReservations(t *testing.T) {
	itemID := uuid.NewString()

	handler := NewOrderHandler(
		fakeSalesOrderCommandService{},
		fakeSalesOrderQueryService{
			finishedReservationsResult: &services.FinishedGoodReservationVisibility{
				ItemID:        itemID,
				TotalReserved: 10,
			},
		},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Get("/inventory/finished-goods/:itemId/reservations", handler.GetFinishedGoodReservations)

	req := httptest.NewRequest("GET", "/inventory/finished-goods/"+itemID+"/reservations", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestOrderHandlerCancelSalesOrder(t *testing.T) {
	orderID := uuid.NewString()
	userID := uuid.NewString()

	handler := NewOrderHandler(
		fakeSalesOrderCommandService{
			result: &services.SalesOrderMutationResult{
				Order: &services.SalesOrderDetail{ID: orderID, Status: "CANCELLED"},
			},
		},
		fakeSalesOrderQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/orders/:id/cancel", func(c *fiber.Ctx) error {
		c.Locals("userID", userID)
		return handler.CancelSalesOrder(c)
	})

	body := []byte(`{"reason":"customer requested cancellation"}`)
	req := httptest.NewRequest("POST", "/orders/"+orderID+"/cancel", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestOrderHandlerGetBatchReservations(t *testing.T) {
	handler := NewOrderHandler(
		fakeSalesOrderCommandService{},
		fakeSalesOrderQueryService{
			batchReservationsResult: &services.BatchReservationDrillDown{
				BatchCode: "BNDL-260517-001",
			},
		},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Get("/inventory/batches/:code/reservations", handler.GetBatchReservations)

	req := httptest.NewRequest("GET", "/inventory/batches/BNDL-260517-001/reservations", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
