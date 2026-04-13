"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Wifi,
  Server,
} from "lucide-react";
import { ApiClientError } from "@/lib/api/api-client";
import { getCurrentUser, login } from "@/lib/api/auth";
import { authKeys } from "@/lib/react-query/keys";
import { useAuthStore } from "@/stores/auth.store";

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--erp-bg-deep)] erp-grid-pattern relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--erp-accent)] opacity-[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500 opacity-[0.02] rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-8 erp-fade-in">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--erp-accent)] to-cyan-600 shadow-lg shadow-cyan-500/25 mb-4">
          <Zap className="size-7 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-[0.2em] uppercase text-[var(--erp-text-primary)]">
          Reva ERP
        </h1>
        <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-[var(--erp-text-muted)] mt-1">
          v2.4.0 Command Center
        </p>
      </div>

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 erp-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="erp-card-static p-6 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--erp-text-primary)]">
              System Access
            </h2>
            <p className="text-sm text-[var(--erp-text-muted)] mt-1">
              Authenticate to manage industrial assets.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="flex items-center gap-3 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Mail className="size-4 text-[var(--erp-text-muted)] shrink-0" />
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="Corporate Email"
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
            </div>

            {/* Password */}
            <div className="flex items-center gap-3 rounded-lg border border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] px-3 py-2.5 focus-within:border-[var(--erp-accent)] transition-colors">
              <Lock className="size-4 text-[var(--erp-text-muted)] shrink-0" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Security Key"
                className="flex-1 bg-transparent text-sm text-[var(--erp-text-primary)] placeholder:text-[var(--erp-text-muted)] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[var(--erp-text-muted)] hover:text-[var(--erp-text-secondary)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* Options row */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[var(--erp-text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-[var(--erp-border-default)] bg-[var(--erp-bg-surface)] accent-[var(--erp-accent)]"
                />
                Keep session active
              </label>
              <button
                type="button"
                className="text-[var(--erp-accent)] hover:text-[var(--erp-accent-bright)] font-medium uppercase tracking-wider text-[10px] transition-colors"
              >
                Forgot Key?
              </button>
            </div>

            {/* Error */}
            {errorMessage ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {errorMessage}
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--erp-accent)] to-cyan-500 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:from-[var(--erp-accent-bright)] hover:to-cyan-400 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
            >
              {loginMutation.isPending ? (
                <span className="animate-pulse">Authenticating...</span>
              ) : (
                <>
                  Access Command Center
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-[var(--erp-text-muted)] mt-5">
            By continuing you agree to Reva&apos;s industrial usage protocols.
          </p>
        </div>
      </div>

      {/* Footer status */}
      <div
        className="relative z-10 flex items-center gap-6 mt-8 erp-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--erp-text-muted)]">
          <Wifi className="size-3 text-[var(--erp-success)]" />
          <span className="uppercase tracking-wider font-medium">Latency</span>
          <span className="text-[var(--erp-text-secondary)]">9ms</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--erp-text-muted)]">
          <Shield className="size-3 text-[var(--erp-accent)]" />
          <span className="uppercase tracking-wider font-medium">Security</span>
          <span className="text-[var(--erp-text-secondary)]">AES-256</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--erp-text-muted)]">
          <Server className="size-3 text-[var(--erp-success)]" />
          <span className="uppercase tracking-wider font-medium">
            Encrypted
          </span>
          <span className="text-[var(--erp-text-secondary)]">✓</span>
        </div>
      </div>
    </div>
  );
}
