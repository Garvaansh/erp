DROP TRIGGER IF EXISTS set_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS set_users_updated_at ON users;

DROP FUNCTION IF EXISTS update_modified_column();

DROP INDEX IF EXISTS users_email_lower_unique_idx;

ALTER TABLE roles
DROP CONSTRAINT IF EXISTS roles_code_allowed_check;

ALTER TABLE roles
DROP COLUMN IF EXISTS updated_at;
