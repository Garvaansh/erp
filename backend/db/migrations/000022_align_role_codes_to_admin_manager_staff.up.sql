-- Align auth role model to ADMIN/MANAGER/STAFF and remove legacy role codes.

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
DROP CONSTRAINT IF EXISTS roles_code_allowed_check;

ALTER TABLE roles
ADD CONSTRAINT roles_code_allowed_check
CHECK (code IN ('ADMIN', 'MANAGER', 'STAFF'));
