"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import { getCurrentUser, login } from "@/lib/api/auth";
import { authKeys } from "@/lib/react-query/keys";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/components/theme-provider";

function readLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.message.trim()) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Authentication service unavailable.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const setAuthSession = useAuthStore((state) => state.setAuthSession);
  const queryClient = useQueryClient();

  // Look for ?next= in the URL and only allow safe in-app paths.
  const nextParam = searchParams.get("next") || "";
  const nextUrl =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      setAuthSession(user);
      queryClient.setQueryData(authKeys.me(), user);

      try {
        const currentUser = await queryClient.fetchQuery({
          queryKey: authKeys.me(),
          queryFn: getCurrentUser,
          staleTime: 0,
        });
        setAuthSession(currentUser);
      } catch {
        // Keep login responsive during temporary backend hiccups.
      }

      router.push(nextUrl);
      router.refresh();
    },
    onError: (error) => {
      setErrorMessage(readLoginErrorMessage(error));
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    setErrorMessage("");
    loginMutation.mutate({ email, password });
  }

  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-white mb-4 shadow-lg shadow-primary/20">
          <span className="text-lg font-bold">R</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Reva ERP
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Sign in to your workspace
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-[13px] font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground"
              >
                Password
              </label>
              <div className="flex items-center rounded-lg border border-border bg-transparent px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 transition-colors">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMessage ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                {errorMessage}
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loginMutation.isPending ? (
                <span>Signing in...</span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
