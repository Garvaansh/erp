"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { MoveRight, Loader2, Factory } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const tid = searchParams.get("tenant_id");
    if (tid) setTenantId(tid);
    if (searchParams.get("registered") === "1") setRegistered(true);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", {
        tenant_id: tenantId,
        email,
        password,
      });
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute top-0 right-0 p-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"></div>

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center items-center mb-6">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center border border-border shadow-lg">
              <Factory className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-2">ERP Workspace</h2>
          <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleLogin}>
            {registered && (
              <div className="p-3 text-sm text-green-700 dark:text-green-400 bg-green-500/20 border border-green-500/50 rounded-lg">
                Workspace created. Sign in with your email and Workspace ID below.
              </div>
            )}
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/20 border border-destructive/50 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Workspace ID (Tenant UID)</label>
              <input
                type="text"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="e.g. 123e4567-e89b-12d3..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full relative h-12 flex justify-center items-center px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden mt-6 shadow-lg"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-primary-foreground/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Access Portal
                  <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Don&apos;t have a workspace?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create one
          </Link>
          . Otherwise contact your workspace admin for a tenant ID and account.
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute top-0 right-0 p-4 z-20">
        <ThemeToggle />
      </div>
      <div className="z-10 w-full max-w-md flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
