package services

import (
	"context"
	"strings"
	"testing"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type fakeCustomerIdentityReader struct {
	gstRows      map[string]db.Customer
	phoneRows    map[string]db.Customer
	whatsAppRows map[string]db.Customer
	aliasRows    map[string][]db.Customer
	fuzzyRows    []db.ListCustomerFuzzyCandidatesRow
}

func (f fakeCustomerIdentityReader) GetCustomerByNormalizedGST(_ context.Context, normalizedGst pgtype.Text) (db.Customer, error) {
	if row, ok := f.gstRows[normalizedGst.String]; ok {
		return row, nil
	}
	return db.Customer{}, pgx.ErrNoRows
}

func (f fakeCustomerIdentityReader) GetCustomerByNormalizedPhone(_ context.Context, normalizedPhone pgtype.Text) (db.Customer, error) {
	if row, ok := f.phoneRows[normalizedPhone.String]; ok {
		return row, nil
	}
	return db.Customer{}, pgx.ErrNoRows
}

func (f fakeCustomerIdentityReader) GetCustomerByNormalizedWhatsApp(_ context.Context, normalizedWhatsapp pgtype.Text) (db.Customer, error) {
	if row, ok := f.whatsAppRows[normalizedWhatsapp.String]; ok {
		return row, nil
	}
	return db.Customer{}, pgx.ErrNoRows
}

func (f fakeCustomerIdentityReader) ListCustomersByNormalizedAlias(_ context.Context, normalizedAlias string) ([]db.Customer, error) {
	return f.aliasRows[normalizedAlias], nil
}

func (f fakeCustomerIdentityReader) ListCustomerFuzzyCandidates(_ context.Context, _ db.ListCustomerFuzzyCandidatesParams) ([]db.ListCustomerFuzzyCandidatesRow, error) {
	return f.fuzzyRows, nil
}

func TestResolveCustomerIdentityExactPhoneMatch(t *testing.T) {
	reader := fakeCustomerIdentityReader{
		phoneRows: map[string]db.Customer{
			"+919876543210": makeTestCustomer(t, "11111111-1111-1111-1111-111111111111", "Acme Traders"),
		},
	}
	service := NewCustomerResolutionService()

	result, err := service.ResolveCustomerIdentity(context.Background(), reader, normalizedCustomerIdentityInput{
		DisplayName:     "Acme Traders",
		NormalizedName:  "acme traders",
		PhoneNumber:     "9876543210",
		NormalizedPhone: "+919876543210",
	})
	if err != nil {
		t.Fatalf("ResolveCustomerIdentity() error = %v", err)
	}
	if result.Outcome != customerResolutionExactExisting {
		t.Fatalf("expected exact existing outcome, got %q", result.Outcome)
	}
	if len(result.Matches) != 1 || result.Matches[0].MatchSource != customerMatchSourcePhone {
		t.Fatalf("expected exact phone match, got %+v", result.Matches)
	}
}

func TestResolveCustomerIdentityGSTConflictReturnsProbableMatches(t *testing.T) {
	reader := fakeCustomerIdentityReader{
		gstRows: map[string]db.Customer{
			"29ABCDE1234F2Z5": makeTestCustomer(t, "11111111-1111-1111-1111-111111111111", "Acme Traders"),
		},
		phoneRows: map[string]db.Customer{
			"+919876543210": makeTestCustomer(t, "22222222-2222-2222-2222-222222222222", "Acme Trading"),
		},
	}
	service := NewCustomerResolutionService()

	result, err := service.ResolveCustomerIdentity(context.Background(), reader, normalizedCustomerIdentityInput{
		DisplayName:     "Acme Traders",
		NormalizedName:  "acme traders",
		PhoneNumber:     "9876543210",
		NormalizedPhone: "+919876543210",
		GSTNumber:       "29ABCDE1234F2Z5",
		NormalizedGST:   "29ABCDE1234F2Z5",
	})
	if err != nil {
		t.Fatalf("ResolveCustomerIdentity() error = %v", err)
	}
	if result.Outcome != customerResolutionProbable {
		t.Fatalf("expected probable match outcome, got %q", result.Outcome)
	}
	if len(result.Matches) != 2 {
		t.Fatalf("expected 2 conflicting exact matches, got %d", len(result.Matches))
	}
}

func TestResolveCustomerIdentityAliasMatch(t *testing.T) {
	customer := makeTestCustomer(t, "33333333-3333-3333-3333-333333333333", "Shree Balaji Tubes")
	reader := fakeCustomerIdentityReader{
		aliasRows: map[string][]db.Customer{
			"balaji tubes": {customer},
		},
	}
	service := NewCustomerResolutionService()

	result, err := service.ResolveCustomerIdentity(context.Background(), reader, normalizedCustomerIdentityInput{
		DisplayName:    "Balaji Tubes",
		NormalizedName: "balaji tubes",
	})
	if err != nil {
		t.Fatalf("ResolveCustomerIdentity() error = %v", err)
	}
	if result.Outcome != customerResolutionExactExisting {
		t.Fatalf("expected alias reuse outcome, got %q", result.Outcome)
	}
	if result.Matches[0].MatchSource != customerMatchSourceAlias {
		t.Fatalf("expected alias source, got %q", result.Matches[0].MatchSource)
	}
}

func TestResolveCustomerIdentityFuzzySuggestion(t *testing.T) {
	customer := makeTestCustomer(t, "44444444-4444-4444-4444-444444444444", "Acme Traders")
	reader := fakeCustomerIdentityReader{
		fuzzyRows: []db.ListCustomerFuzzyCandidatesRow{
			{Customer: customer},
		},
	}
	service := NewCustomerResolutionService()

	result, err := service.ResolveCustomerIdentity(context.Background(), reader, normalizedCustomerIdentityInput{
		DisplayName:    "Acme Trdaers",
		NormalizedName: "acme trdaers",
	})
	if err != nil {
		t.Fatalf("ResolveCustomerIdentity() error = %v", err)
	}
	if result.Outcome != customerResolutionProbable {
		t.Fatalf("expected probable fuzzy outcome, got %q", result.Outcome)
	}
	if len(result.Matches) != 1 || result.Matches[0].MatchSource != customerMatchSourceFuzzy {
		t.Fatalf("expected fuzzy suggestion, got %+v", result.Matches)
	}
}

func TestResolveCustomerIdentityCreateNew(t *testing.T) {
	service := NewCustomerResolutionService()

	result, err := service.ResolveCustomerIdentity(context.Background(), fakeCustomerIdentityReader{}, normalizedCustomerIdentityInput{
		DisplayName:    "Fresh Customer",
		NormalizedName: "fresh customer",
	})
	if err != nil {
		t.Fatalf("ResolveCustomerIdentity() error = %v", err)
	}
	if result.Outcome != customerResolutionCreateNew {
		t.Fatalf("expected create new outcome, got %q", result.Outcome)
	}
}

func makeTestCustomer(t *testing.T, rawID string, displayName string) db.Customer {
	t.Helper()
	parsed, ok := parseUUID(rawID)
	if !ok {
		t.Fatalf("parseUUID(%q) failed", rawID)
	}
	return db.Customer{
		ID:             parsed,
		DisplayName:    displayName,
		NormalizedName: strings.ToLower(displayName),
	}
}
