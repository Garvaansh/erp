import { apiClient } from "@/lib/api/api-client";
import type {
  UserListItem,
  CreateUserPayload,
  UpdateUserPayload,
  ChangePasswordPayload,
  UserFilter,
} from "@/features/users/types";

export async function getUsers(
  filter: UserFilter = "active",
  search = "",
): Promise<UserListItem[]> {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (search.trim()) {
    params.set("search", search.trim());
  }
  const data = await apiClient<UserListItem[]>(`/users?${params.toString()}`, {
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
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changeUserPassword(
  userId: string,
  payload: ChangePasswordPayload,
): Promise<unknown> {
  return apiClient(`/users/${userId}/password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
