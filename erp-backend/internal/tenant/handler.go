package tenant

import (
	"encoding/json"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
)

// GetTenantSettings returns the current tenant's settings (from JWT). Creates defaults if none exist.
func GetTenantSettings(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing tenant context"})
	}
	var tenantID pgtype.UUID
	if err := tenantID.Scan(tenantIDRaw); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid tenant ID"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	settings, err := q.GetTenantSettings(ctx, tenantID)
	if err != nil {
		tenant, getErr := q.GetTenant(ctx, tenantID)
		if getErr == nil {
			_ = SeedTenantConfig(ctx, tenantID, tenant.Name)
			settings, err = q.GetTenantSettings(ctx, tenantID)
		}
		if err != nil {
			log.Printf("GetTenantSettings: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load settings"})
		}
	}

	return c.JSON(fiber.Map{
		"tenant_id":               settings.TenantID,
		"display_name":            settings.DisplayName,
		"fiscal_year_start_month": settings.FiscalYearStartMonth,
		"base_currency":           settings.BaseCurrency,
		"locale":                   settings.Locale,
		"timezone":                 settings.Timezone,
		"feature_flags":            settings.FeatureFlags,
	})
}

// UpdateTenantSettingsRequest is the body for PUT /tenant/settings.
type UpdateTenantSettingsRequest struct {
	DisplayName          *string          `json:"display_name"`
	FiscalYearStartMonth *int32           `json:"fiscal_year_start_month"`
	BaseCurrency         *string          `json:"base_currency"`
	Locale               *string           `json:"locale"`
	Timezone             *string          `json:"timezone"`
	FeatureFlags         *json.RawMessage `json:"feature_flags"`
}

// UpdateTenantSettings updates the current tenant's settings.
func UpdateTenantSettings(c *fiber.Ctx) error {
	tenantIDRaw, ok := c.Locals("tenant_id").(string)
	if !ok || tenantIDRaw == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing tenant context"})
	}
	var tenantID pgtype.UUID
	if err := tenantID.Scan(tenantIDRaw); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid tenant ID"})
	}

	var req UpdateTenantSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	q := db.New(database.Pool)
	ctx := c.Context()
	existing, err := q.GetTenantSettings(ctx, tenantID)
	if err != nil {
		tenant, _ := q.GetTenant(ctx, tenantID)
		_ = SeedTenantConfig(ctx, tenantID, tenant.Name)
		existing, err = q.GetTenantSettings(ctx, tenantID)
		if err != nil {
			log.Printf("UpdateTenantSettings get: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load settings"})
		}
	}

	displayName := existing.DisplayName
	if req.DisplayName != nil {
		displayName = *req.DisplayName
	}
	fiscalMonth := existing.FiscalYearStartMonth
	if req.FiscalYearStartMonth != nil {
		fiscalMonth = *req.FiscalYearStartMonth
	}
	currency := existing.BaseCurrency
	if req.BaseCurrency != nil {
		currency = *req.BaseCurrency
	}
	locale := existing.Locale
	if req.Locale != nil {
		locale = *req.Locale
	}
	timezone := existing.Timezone
	if req.Timezone != nil {
		timezone = *req.Timezone
	}
	flags := existing.FeatureFlags
	if req.FeatureFlags != nil {
		flags = []byte(*req.FeatureFlags)
	}

	updated, err := q.UpsertTenantSettings(ctx, db.UpsertTenantSettingsParams{
		TenantID:             tenantID,
		DisplayName:          displayName,
		FiscalYearStartMonth: fiscalMonth,
		BaseCurrency:         currency,
		Locale:               locale,
		Timezone:             timezone,
		FeatureFlags:         flags,
	})
	if err != nil {
		log.Printf("UpdateTenantSettings upsert: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update settings"})
	}

	return c.JSON(fiber.Map{
		"tenant_id":               updated.TenantID,
		"display_name":            updated.DisplayName,
		"fiscal_year_start_month": updated.FiscalYearStartMonth,
		"base_currency":           updated.BaseCurrency,
		"locale":                   updated.Locale,
		"timezone":                 updated.Timezone,
		"feature_flags":            updated.FeatureFlags,
	})
}
