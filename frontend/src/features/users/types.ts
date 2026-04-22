export type UserRole = "ADMIN" | "MANAGER" | "STAFF";
export type UserFilter = "active" | "archived" | "all";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role_code: UserRole;
  role_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateUserPayload = {
  email: string;
  password: string;
  role_code: UserRole;
};

export type UpdateUserPayload = {
  role_code?: UserRole;
  is_active?: boolean;
};

export type ChangePasswordPayload = {
  password: string;
};
