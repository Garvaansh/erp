"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/api-client";
import { authKeys } from "@/lib/react-query/keys";
import { useAuthStore } from "@/stores/auth.store";

const PUBLIC_PATH_PREFIXES = ["/login"];

export function AuthSessionBootstrap() {
  const pathname = usePathname();
  const router = useRouter();
  const setAuthSession = useAuthStore((state) => state.setAuthSession);
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);
  const handledAuthFailureRef = useRef(false);

  const isPublicPath = PUBLIC_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  const nextPath = useMemo(() => pathname || "/dashboard", [pathname]);

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: getCurrentUser,
    enabled: !isPublicPath,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Sync successful auth data to Zustand
  useEffect(() => {
    if (isPublicPath) {
      handledAuthFailureRef.current = false;
      clearAuthSession();
      return;
    }

    if (meQuery.data === undefined || meQuery.isPending) {
      return;
    }

    // Fail closed: null user payload means unauthenticated
    if (meQuery.data === null && !handledAuthFailureRef.current) {
      handledAuthFailureRef.current = true;
      clearAuthSession();
      const encodedNext = encodeURIComponent(nextPath);
      router.replace(`/login?next=${encodedNext}`);
      return;
    }

    setAuthSession(meQuery.data);
  }, [
    clearAuthSession,
    isPublicPath,
    meQuery.data,
    meQuery.isPending,
    nextPath,
    router,
    setAuthSession,
  ]);

  // Handle authentication errors
  useEffect(() => {
    // Only act on errors when not on a public path
    if (isPublicPath || !meQuery.error) {
      return;
    }

    // Only redirect on explicit 401 Unauthorized
    if (
      meQuery.error instanceof ApiClientError &&
      meQuery.error.statusCode === 401 &&
      !handledAuthFailureRef.current
    ) {
      handledAuthFailureRef.current = true;
      clearAuthSession();
      const encodedNext = encodeURIComponent(nextPath);
      router.replace(`/login?next=${encodedNext}`);
      return;
    }

    // For any other error (network, 500, etc.), DO NOT clear auth state.
    // The cookie remains valid; the UI can show a temporary error but stay logged in.
    // The query will remain in error state and can be retried manually or via navigation.
  }, [clearAuthSession, isPublicPath, meQuery.error, nextPath, router]);

  return null;
}
