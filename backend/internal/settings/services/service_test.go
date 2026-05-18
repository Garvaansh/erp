package services_test

import (
	"context"
	"os"
	"testing"

	"github.com/erp/backend/internal/settings/dto"
	"github.com/erp/backend/internal/settings/repository"
	"github.com/erp/backend/internal/settings/services"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func settingsTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping settings integration tests")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestBusinessSettingsValidation(t *testing.T) {
	pool := settingsTestPool(t)
	repo := repository.NewSettingsRepository(pool)
	svc := services.NewSettingsService(repo)
	operatorID := uuid.New()

	err := svc.UpdateBusinessSettings(context.Background(), &dto.BusinessSettings{
		CompanyName: "", // invalid, required
		GSTIN:       "29ABCDE1234F1Z5",
	}, operatorID)

	if err == nil {
		t.Errorf("Expected validation error for missing company name")
	}

	err = svc.UpdateBusinessSettings(context.Background(), &dto.BusinessSettings{
		CompanyName: "Valid Company",
		GSTIN:       "INVALID_GSTIN", // invalid format
	}, operatorID)

	if err == nil {
		t.Errorf("Expected validation error for invalid GSTIN")
	}

	err = svc.UpdateBusinessSettings(context.Background(), &dto.BusinessSettings{
		CompanyName: "Valid Company",
		GSTIN:       "29ABCDE1234F1Z5",
		Phone:       "123", // invalid, min=10
	}, operatorID)

	if err == nil {
		t.Errorf("Expected validation error for invalid phone")
	}
}

func TestBusinessSettingsGSTINValidation(t *testing.T) {
	pool := settingsTestPool(t)
	repo := repository.NewSettingsRepository(pool)
	svc := services.NewSettingsService(repo)
	operatorID := uuid.New()

	tests := []struct {
		name    string
		gstin   string
		isValid bool
	}{
		{"Valid GSTIN", "27ABCDE1234F1Z5", true},
		{"Lowercase GSTIN", "27abcde1234f1z5", true},
		{"Whitespace Padded GSTIN", "  27ABCDE1234F1Z5  ", true},
		{"Invalid Structure", "27ABCDE1234F12", false},
		{"Invalid Checksum Position", "27ABCDE1234F1AZ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settings := &dto.BusinessSettings{
				CompanyName: "Valid Company",
				GSTIN:       tt.gstin,
			}
			err := svc.UpdateBusinessSettings(context.Background(), settings, operatorID)

			if tt.isValid && err != nil {
				t.Errorf("Expected valid GSTIN but got error: %v", err)
			} else if !tt.isValid && err == nil {
				t.Errorf("Expected invalid GSTIN but got no error")
			}

			if tt.isValid {
				if settings.GSTIN != "27ABCDE1234F1Z5" {
					t.Errorf("Expected GSTIN to be normalized, got: %s", settings.GSTIN)
				}
			}
		})
	}
}

func TestInvoiceSettingsValidation(t *testing.T) {
	pool := settingsTestPool(t)
	repo := repository.NewSettingsRepository(pool)
	svc := services.NewSettingsService(repo)
	operatorID := uuid.New()

	err := svc.UpdateInvoiceSettings(context.Background(), &dto.InvoiceSettings{
		InvoicePrefix:           "", // invalid, min=1
		DefaultPaymentTermsDays: 30,
		DefaultCGSTPercent:      9,
		DefaultSGSTPercent:      9,
	}, operatorID)

	if err == nil {
		t.Errorf("Expected validation error for empty prefix")
	}
}
