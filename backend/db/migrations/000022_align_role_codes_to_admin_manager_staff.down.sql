-- Restore legacy auth role model SUPER_ADMIN/ADMIN/WORKER.

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
DROP CONSTRAINT IF EXISTS roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('SUPER_ADMIN', 'ADMIN', 'WORKER'));
