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
)

type fakeCustomerCommandService struct {
	result *models.CustomerCreateResponse
	err    error
}

func (f fakeCustomerCommandService) CreateCustomer(_ context.Context, _ models.CreateCustomerRequest) (*models.CustomerCreateResponse, error) {
	return f.result, f.err
}

type fakeCustomerQueryService struct {
	result *models.CustomerSearchPage
	err    error
}

func (f fakeCustomerQueryService) SearchCustomers(_ context.Context, _ string, _ int32, _ int32) (*models.CustomerSearchPage, error) {
	return f.result, f.err
}

func TestCustomerHandlerCreateCustomerCreated(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{
			result: &models.CustomerCreateResponse{
				Resolution: "create_new_customer",
				Customer: &models.CustomerReadModel{
					ID:          "11111111-1111-1111-1111-111111111111",
					DisplayName: "Acme Traders",
				},
			},
		},
		fakeCustomerQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/customers", handler.CreateCustomer)

	body := []byte(`{"display_name":"Acme Traders","phone_number":"9876543210"}`)
	req := httptest.NewRequest("POST", "/customers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
}

func TestCustomerHandlerCreateCustomerReusesExisting(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{
			result: &models.CustomerCreateResponse{
				Resolution: "exact_existing_customer",
				Customer: &models.CustomerReadModel{
					ID:          "11111111-1111-1111-1111-111111111111",
					DisplayName: "Acme Traders",
				},
			},
		},
		fakeCustomerQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/customers", handler.CreateCustomer)

	body := []byte(`{"display_name":"Acme Traders","phone_number":"9876543210"}`)
	req := httptest.NewRequest("POST", "/customers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestCustomerHandlerCreateCustomerConflict(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{
			result: &models.CustomerCreateResponse{
				Resolution: "probable_matches",
				Matches: []models.CustomerSearchResult{
					{ID: "11111111-1111-1111-1111-111111111111", DisplayName: "Acme Traders"},
				},
			},
		},
		fakeCustomerQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/customers", handler.CreateCustomer)

	body := []byte(`{"display_name":"Acme Trdaers"}`)
	req := httptest.NewRequest("POST", "/customers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
}

func TestCustomerHandlerSearchCustomers(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{},
		fakeCustomerQueryService{
			result: &models.CustomerSearchPage{
				Items: []models.CustomerSearchResult{
					{ID: "11111111-1111-1111-1111-111111111111", DisplayName: "Acme Traders"},
				},
				Page:     1,
				PageSize: 20,
				Total:    1,
			},
		},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Get("/customers/search", handler.SearchCustomers)

	req := httptest.NewRequest("GET", "/customers/search?q=acme", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestCustomerHandlerSearchCustomersInvalidQuery(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{},
		fakeCustomerQueryService{err: services.ErrInvalidCustomerSearchQuery},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Get("/customers/search", handler.SearchCustomers)

	req := httptest.NewRequest("GET", "/customers/search?q=", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCustomerHandlerCreateCustomerMapsServiceError(t *testing.T) {
	handler := NewCustomerHandler(
		fakeCustomerCommandService{err: services.ErrInvalidCustomerPayload},
		fakeCustomerQueryService{},
		validator.New(validator.WithRequiredStructEnabled()),
	)
	app := fiber.New()
	app.Post("/customers", handler.CreateCustomer)

	body := []byte(`{"display_name":"Acme Traders","phone_number":"bad-number"}`)
	req := httptest.NewRequest("POST", "/customers", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}
