package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/erp/backend/internal/db"
	"github.com/erp/backend/internal/settings/dto"
	"github.com/erp/backend/internal/settings/repository"
	"github.com/erp/backend/internal/settings/validators"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type SettingsService interface {
	GetBusinessSettings(ctx context.Context) (*dto.BusinessSettings, error)
	UpdateBusinessSettings(ctx context.Context, settings *dto.BusinessSettings, updatedBy uuid.UUID) error

	GetInvoiceSettings(ctx context.Context) (*dto.InvoiceSettings, error)
	UpdateInvoiceSettings(ctx context.Context, settings *dto.InvoiceSettings, updatedBy uuid.UUID) error

	GetWhatsappSettings(ctx context.Context) (*dto.WhatsappSettings, error)
	UpdateWhatsappSettings(ctx context.Context, settings *dto.WhatsappSettings, updatedBy uuid.UUID) error
}

type settingsService struct {
	repo repository.SettingsRepository
}

func NewSettingsService(repo repository.SettingsRepository) SettingsService {
	return &settingsService{repo: repo}
}

func (s *settingsService) getCategorySettings(ctx context.Context, category string, target interface{}) error {
	settings, err := s.repo.GetSettingsByCategory(ctx, category)
	if err != nil {
		return err
	}

	// Create a map to hold the combined JSON
	combined := make(map[string]interface{})
	for _, setting := range settings {
		var val interface{}
		if err := json.Unmarshal(setting.Value, &val); err != nil {
			continue
		}
		combined[setting.Key] = val
	}

	// If empty, return nil (or initialize defaults if needed)
	if len(combined) == 0 {
		return nil
	}

	bytes, err := json.Marshal(combined)
	if err != nil {
		return err
	}

	return json.Unmarshal(bytes, target)
}

func (s *settingsService) updateCategorySettings(ctx context.Context, category string, source interface{}, updatedBy uuid.UUID) error {
	if err := validators.Validate.Struct(source); err != nil {
		return fmt.Errorf("validation error: %w", err)
	}

	bytes, err := json.Marshal(source)
	if err != nil {
		return err
	}

	var data map[string]interface{}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}

	for key, val := range data {
		valBytes, _ := json.Marshal(val)

		arg := db.UpsertSettingParams{
			Category: category,
			Key:      key,
			Value:    valBytes,
		}
		if updatedBy != uuid.Nil {
			arg.UpdatedBy = pgtype.UUID{Bytes: updatedBy, Valid: true}
		}

		_, err := s.repo.UpsertSetting(ctx, arg)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *settingsService) GetBusinessSettings(ctx context.Context) (*dto.BusinessSettings, error) {
	settings := &dto.BusinessSettings{}
	if err := s.getCategorySettings(ctx, "business", settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (s *settingsService) UpdateBusinessSettings(ctx context.Context, settings *dto.BusinessSettings, updatedBy uuid.UUID) error {
	settings.GSTIN = strings.ToUpper(strings.TrimSpace(settings.GSTIN))
	return s.updateCategorySettings(ctx, "business", settings, updatedBy)
}

func (s *settingsService) GetInvoiceSettings(ctx context.Context) (*dto.InvoiceSettings, error) {
	settings := &dto.InvoiceSettings{}
	if err := s.getCategorySettings(ctx, "invoice", settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (s *settingsService) UpdateInvoiceSettings(ctx context.Context, settings *dto.InvoiceSettings, updatedBy uuid.UUID) error {
	return s.updateCategorySettings(ctx, "invoice", settings, updatedBy)
}

func (s *settingsService) GetWhatsappSettings(ctx context.Context) (*dto.WhatsappSettings, error) {
	settings := &dto.WhatsappSettings{}
	if err := s.getCategorySettings(ctx, "whatsapp", settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (s *settingsService) UpdateWhatsappSettings(ctx context.Context, settings *dto.WhatsappSettings, updatedBy uuid.UUID) error {
	return s.updateCategorySettings(ctx, "whatsapp", settings, updatedBy)
}
