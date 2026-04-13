import { apiClient } from "@/lib/api/api-client";
import type {
  UserListItem,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/features/users/types";

export async function getUsers(): Promise<UserListItem[]> {
  const data = await apiClient<UserListItem[]>("/users", {
    method: "GET",
  });
  return Array.isArray(data) ? data : [];
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<unknown> {
  return apiClient("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
): Promise<unknown> {
  return apiClient(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
