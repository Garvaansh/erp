export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  role_code: string;
};

export type LoginActionState = {
  ok: boolean;
  message: string;
};
