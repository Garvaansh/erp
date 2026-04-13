export type UserRole = "SUPER_ADMIN" | "ADMIN" | "WORKER";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role_code: UserRole;
  role_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role_code: UserRole;
  is_admin: boolean;
};

export type UpdateUserPayload = {
  name?: string;
  role_code?: UserRole;
  is_active?: boolean;
  is_admin?: boolean;
};
