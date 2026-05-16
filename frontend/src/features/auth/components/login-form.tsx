"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Hero band */}
        <section className="hero-band relative flex flex-col justify-between px-6 py-10 text-white lg:px-12 lg:py-16">
          <div className="max-w-xl">
            <p className="text-code-sm tracking-[0.32em] uppercase text-white/70">
              Replicate
            </p>
            <h1 className="text-display-xl mt-6">
              Run production like a studio.
            </h1>
            <p className="text-body-lg mt-4 text-white/80">
              Reva ERP keeps inventory, procurement, and production in one
              calm workspace so your floor moves with confidence.
            </p>
          </div>

          <div className="mt-10">
            <div className="code-well p-6">
              <div className="flex items-center gap-2 text-code-sm">
                <span className="code-tab">POST</span>
                <span className="code-tab">/api/v1/auth/login</span>
              </div>
              <pre className="text-code-md mt-4 text-white/90">
{`{
  "email": "studio@reva.com",
  "password": "********"
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Login surface */}
        <section className="flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <div className="inline-flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                  <span className="text-sm font-semibold">R</span>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground uppercase tracking-[0.2em]">
                    Reva ERP
                  </p>
                  <h2 className="text-display-md mt-1">Sign in</h2>
                </div>
              </div>
              <p className="text-body-sm mt-4 text-muted-foreground">
                Use your workspace credentials to continue.
              </p>
            </div>

            <div className="rounded-[16px] border border-border bg-card p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-body-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    className="h-11 w-full rounded-full border border-border bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition-colors"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-body-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <div className="flex h-11 items-center rounded-full border border-border bg-card px-4 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 transition-colors">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="ml-3 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
                  <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-body-sm text-destructive">
                    {errorMessage}
                  </div>
                ) : null}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="h-11 w-full rounded-full bg-primary text-button-md text-primary-foreground hover:bg-[#c01f00] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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

            <p className="text-caption mt-6 text-muted-foreground">
              Need access? Contact your workspace admin.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
