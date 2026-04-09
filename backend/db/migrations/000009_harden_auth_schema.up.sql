-- Enforce case-insensitive uniqueness for emails.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
ON users (LOWER(email));

-- Restrict roles.code to an explicit allow-list.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'roles_code_allowed_check'
    ) THEN
        ALTER TABLE roles
        ADD CONSTRAINT roles_code_allowed_check
        CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER'));
    END IF;
END
$$;

-- Ensure roles table supports updated_at tracking.
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Shared trigger function for automatic updated_at updates.
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to users table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_users_updated_at'
    ) THEN
        CREATE TRIGGER set_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;

-- Apply updated_at trigger to roles table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_roles_updated_at'
    ) THEN
        CREATE TRIGGER set_roles_updated_at
        BEFORE UPDATE ON roles
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;
