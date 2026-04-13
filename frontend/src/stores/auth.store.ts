import { create } from "zustand";
import type { AuthUser } from "@/features/auth/types";

type AuthRole = string | null;

type AuthStoreState = {
  user: AuthUser | null;
  role: AuthRole;
  setAuthSession: (user: AuthUser | null) => void;
  clearAuthSession: () => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  role: null,
  setAuthSession: (user) => {
    const role =
      typeof user?.role === "string"
        ? user.role
        : user?.is_admin
          ? "ADMIN"
          : null;

    set({ user, role });
  },
  clearAuthSession: () => {
    set({
      user: null,
      role: null,
    });
  },
}));
