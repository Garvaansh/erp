-- +goose Up
-- Align auth role model to ADMIN/MANAGER/STAFF and remove legacy role codes.
ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER', 'MANAGER', 'STAFF'));

-- Ensure target roles exist.
INSERT INTO roles (code, name)
VALUES
    ('ADMIN', 'Administrator'),
    ('MANAGER', 'Manager'),
    ('STAFF', 'Staff')
ON CONFLICT (code) DO NOTHING;

-- Repoint users from legacy WORKER role to STAFF.
UPDATE users AS u
SET role_id = staff_role.id
FROM roles AS old_role, roles AS staff_role
WHERE old_role.code = 'WORKER'
  AND staff_role.code = 'STAFF'
  AND u.role_id = old_role.id;

-- Repoint users from legacy SUPER_ADMIN role to ADMIN.
UPDATE users AS u
SET role_id = admin_role.id
FROM roles AS old_role, roles AS admin_role
WHERE old_role.code = 'SUPER_ADMIN'
  AND admin_role.code = 'ADMIN'
  AND u.role_id = old_role.id;

-- Remove legacy roles once users have been repointed.
DELETE FROM roles
WHERE code IN ('WORKER', 'SUPER_ADMIN');

-- Enforce allowed role codes.
ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('ADMIN', 'MANAGER', 'STAFF'));


-- +goose Down
-- Restore legacy auth role model SUPER_ADMIN/ADMIN/WORKER.
ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER', 'MANAGER', 'STAFF'));

-- Ensure legacy roles exist.
INSERT INTO roles (code, name)
VALUES
    ('SUPER_ADMIN', 'Super Administrator'),
    ('ADMIN', 'Administrator'),
    ('WORKER', 'Worker')
ON CONFLICT (code) DO NOTHING;

-- Repoint users from STAFF to WORKER.
UPDATE users AS u
SET role_id = worker_role.id
FROM roles AS staff_role, roles AS worker_role
WHERE staff_role.code = 'STAFF'
  AND worker_role.code = 'WORKER'
  AND u.role_id = staff_role.id;

-- Repoint users from ADMIN to SUPER_ADMIN.
UPDATE users AS u
SET role_id = super_role.id
FROM roles AS admin_role, roles AS super_role
WHERE admin_role.code = 'ADMIN'
  AND super_role.code = 'SUPER_ADMIN'
  AND u.role_id = admin_role.id;

-- Remove MANAGER and STAFF roles for legacy compatibility.
DELETE FROM roles
WHERE code IN ('MANAGER', 'STAFF');

-- Enforce legacy allowed role codes.
ALTER TABLE roles
DROP CONSTRAINT roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER'));
