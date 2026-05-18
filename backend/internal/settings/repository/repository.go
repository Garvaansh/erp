package repository

import (
	"context"

	"github.com/erp/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsRepository interface {
	GetSetting(ctx context.Context, category, key string) (db.SystemSetting, error)
	GetSettingsByCategory(ctx context.Context, category string) ([]db.SystemSetting, error)
	UpsertSetting(ctx context.Context, arg db.UpsertSettingParams) (db.SystemSetting, error)
}

type settingsRepository struct {
	q  *db.Queries
	db *pgxpool.Pool
}

func NewSettingsRepository(pool *pgxpool.Pool) SettingsRepository {
	return &settingsRepository{
		q:  db.New(pool),
		db: pool,
	}
}

func (r *settingsRepository) GetSetting(ctx context.Context, category, key string) (db.SystemSetting, error) {
	return r.q.GetSetting(ctx, db.GetSettingParams{
		Category: category,
		Key:      key,
	})
}

func (r *settingsRepository) GetSettingsByCategory(ctx context.Context, category string) ([]db.SystemSetting, error) {
	return r.q.GetSettingsByCategory(ctx, category)
}

func (r *settingsRepository) UpsertSetting(ctx context.Context, arg db.UpsertSettingParams) (db.SystemSetting, error) {
	return r.q.UpsertSetting(ctx, arg)
}
