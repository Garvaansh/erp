import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersKeys } from "@/lib/react-query/keys";
import {
  changeUserPassword,
  createUser,
  updateUser,
} from "@/features/users/api";
import type {
  ChangePasswordPayload,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/features/users/types";

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      updateUser(userId, payload),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(vars.userId) });
    },
  });
}

export function useChangeUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: ChangePasswordPayload }) =>
      changeUserPassword(userId, payload),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(vars.userId) });
    },
  });
}
