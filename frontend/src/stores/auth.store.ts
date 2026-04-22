import { create } from "zustand";
import type { AuthUser } from "@/features/auth/types";

type AuthStoreState = {
  user: AuthUser | null;
  setAuthSession: (user: AuthUser | null) => void;
  clearAuthSession: () => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  setAuthSession: (user) => {
    set({ user });
  },
  clearAuthSession: () => {
    set({
      user: null,
    });
  },
}));
