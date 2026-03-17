"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Loader2, Factory, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignUpPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/register", {
        tenant_name: tenantName,
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      router.push(`/?registered=1&tenant_id=${encodeURIComponent(data.tenant_id || "")}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
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
          <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-2">Create workspace</h2>
          <p className="text-sm text-muted-foreground">Register your organization and admin account</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleSignUp}>
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/20 border border-destructive/50 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Workspace / Company name</label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground ml-1">First name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                  placeholder="Admin"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground ml-1">Last name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                  placeholder="User"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="admin@company.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground ml-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
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
                <span>Create workspace</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have a workspace?{" "}
          <Link href="/" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
