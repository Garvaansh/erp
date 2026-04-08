import { apiClient } from "@/lib/api-client";
import { loginCredentialsSchema } from "@/features/auth/schemas";
import type { AuthUser, LoginCredentials } from "@/features/auth/types";

type LoginResponse = { user?: AuthUser };
type CurrentUserResponse = { user?: AuthUser | null };

export async function login(
  credentials: LoginCredentials,
): Promise<AuthUser | null> {
  const parsed = loginCredentialsSchema.parse(credentials);
  const data = await apiClient<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(parsed),
  });

  return data.user ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const data = await apiClient<CurrentUserResponse>("/auth/me", {
    method: "GET",
  });

  return data.user ?? null;
}

export async function logout(): Promise<void> {
  await apiClient<null>("/auth/logout", {
    method: "POST",
  });
}
