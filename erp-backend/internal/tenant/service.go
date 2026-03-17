package tenant

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/reva-erp/backend/internal/db"
	"github.com/reva-erp/backend/pkg/database"
)

// Document types for number series
const (
	DocTypePO   = "PO"
	DocTypeSO   = "SO"
	DocTypeINV  = "INV"
	DocTypeGRN  = "GRN"
	DocTypeWO   = "WO"
	DocTypeVINV = "VINV"
)

var defaultDocumentPrefixes = map[string]string{
	DocTypePO:   "PO-",
	DocTypeSO:   "SO-",
	DocTypeINV:  "INV-",
	DocTypeGRN:  "GRN-",
	DocTypeWO:   "WO-",
	DocTypeVINV: "VINV-",
}

// SeedTenantConfig seeds tenant_settings and document_number_series for a new tenant.
func SeedTenantConfig(ctx context.Context, tenantID pgtype.UUID, tenantName string) error {
	q := db.New(database.Pool)
	year := int32(time.Now().Year())
	flags := []byte("{}")

	_, err := q.UpsertTenantSettings(ctx, db.UpsertTenantSettingsParams{
		TenantID:             tenantID,
		DisplayName:          tenantName,
		FiscalYearStartMonth: 4,
		BaseCurrency:         "INR",
		Locale:               "en-IN",
		Timezone:             "Asia/Kolkata",
		FeatureFlags:         flags,
	})
	if err != nil {
		return err
	}

	for docType, prefix := range defaultDocumentPrefixes {
		_, err = q.UpsertDocumentNumberSeries(ctx, db.UpsertDocumentNumberSeriesParams{
			TenantID:     tenantID,
			DocumentType: docType,
			Year:         year,
			LastNumber:   0,
			Prefix:       prefix,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// SeedDefaultRoles creates Admin, Manager, Operator roles for the tenant.
func SeedDefaultRoles(ctx context.Context, tenantID pgtype.UUID) (adminRoleID pgtype.UUID, err error) {
	q := db.New(database.Pool)
	roles := []struct {
		name        string
		description string
	}{
		{"Admin", "Full access"},
		{"Manager", "Manage operations and reports"},
		{"Operator", "Daily transactions"},
	}
	for _, r := range roles {
		role, e := q.CreateRole(ctx, db.CreateRoleParams{
			TenantID:   tenantID,
			Name:       r.name,
			Description: pgtype.Text{String: r.description, Valid: true},
		})
		if e != nil {
			return pgtype.UUID{}, e
		}
		if r.name == "Admin" {
			adminRoleID = role.ID
		}
	}
	return adminRoleID, nil
}

// AssignUserToAdmin assigns the given user to the Admin role for the tenant.
func AssignUserToAdmin(ctx context.Context, tenantID, userID pgtype.UUID) error {
	q := db.New(database.Pool)
	admin, err := q.GetRoleByTenantAndName(ctx, db.GetRoleByTenantAndNameParams{
		TenantID: tenantID,
		Name:     "Admin",
	})
	if err != nil {
		return err
	}
	return q.AssignUserRole(ctx, db.AssignUserRoleParams{
		UserID:   userID,
		RoleID:   admin.ID,
		TenantID: tenantID,
	})
}

// OnboardTenant creates a tenant with settings, number series, default roles, and assigns the first user as Admin.
// Call after creating tenant and first user via auth.
func OnboardTenant(ctx context.Context, tenantID pgtype.UUID, tenantName string, firstUserID pgtype.UUID) error {
	if err := SeedTenantConfig(ctx, tenantID, tenantName); err != nil {
		return err
	}
	adminRoleID, err := SeedDefaultRoles(ctx, tenantID)
	if err != nil {
		return err
	}
	return db.New(database.Pool).AssignUserRole(ctx, db.AssignUserRoleParams{
		UserID:   firstUserID,
		RoleID:   adminRoleID,
		TenantID: tenantID,
	})
}

// FeatureFlags is a helper to parse tenant_settings feature_flags JSON.
func FeatureFlagsFromBytes(b []byte) (map[string]bool, error) {
	if len(b) == 0 {
		return map[string]bool{}, nil
	}
	var m map[string]bool
	err := json.Unmarshal(b, &m)
	return m, err
}
