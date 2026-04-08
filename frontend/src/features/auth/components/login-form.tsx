"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Look for ?next= in the URL and only allow safe in-app paths.
  const nextParam = searchParams.get("next") || "";
  const nextUrl =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include", // <-- This ensures the browser receives and stores the HttpOnly cookie
        body: JSON.stringify({
          email: String(formData.get("email") ?? "").trim(),
          password: String(formData.get("password") ?? ""),
        }),
      });

      let message = "Login failed.";
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload?.message?.trim()) {
          message = payload.message;
        }
      } catch {
        // Ignore JSON parse failures and use fallback message.
      }

      if (!response.ok) {
        setErrorMessage(message);
        return;
      }

      // Route the user back to their intended destination instead of a hardcoded dashboard
      router.push(nextUrl);
      router.refresh();
    } catch {
      setErrorMessage("Authentication service unavailable.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md pt-20">
      <Card>
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Sign in to continue to your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            {errorMessage ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
