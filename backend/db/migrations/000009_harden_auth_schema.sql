-- +goose Up
-- Restrict roles.code to an explicit allow-list.
ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER'));

-- Shared trigger function for automatic updated_at updates.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- Apply updated_at trigger to users table.
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Apply updated_at trigger to roles table.
CREATE TRIGGER set_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- +goose Down
DROP TRIGGER IF EXISTS set_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS set_users_updated_at ON users;

DROP FUNCTION IF EXISTS update_modified_column();

ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('ADMIN', 'MANAGER', 'STAFF'));
