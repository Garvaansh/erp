export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthUser = {
  id?: string;
  email?: string;
  role?: string;
  is_admin?: boolean;
};

export type LoginActionState = {
  ok: boolean;
  message: string;
};
