import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthUser } from "@/features/auth/types";

type AuthRole = string | null;

type AuthStoreState = {
  user: AuthUser | null;
  role: AuthRole;
  token: string | null;
  isHydrated: boolean;
  setAuthSession: (params: {
    user: AuthUser | null;
    token?: string | null;
  }) => void;
  clearAuthSession: () => void;
  setHydrated: (value: boolean) => void;
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      token: null,
      isHydrated: false,
      setHydrated: (value: boolean) => {
        set({ isHydrated: value });
      },
      setAuthSession: ({ user, token }) => {
        const role =
          typeof user?.role === "string"
            ? user.role
            : user?.is_admin
              ? "ADMIN"
              : null;

        set({
          user,
          role,
          token: token?.trim() || null,
        });
      },
      clearAuthSession: () => {
        set({
          user: null,
          role: null,
          token: null,
        });
      },
    }),
    {
      name: "erp-auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
