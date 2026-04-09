import { AppShell } from "@/components/layouts/app-shell";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api";
import { ApiClientError } from "@/lib/api-client";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect("/login?next=/dashboard");
    }

    // Keep workspace routes reachable during temporary backend outages.
    if (error instanceof ApiClientError && error.statusCode >= 500) {
      return <AppShell>{children}</AppShell>;
    }

    throw error;
  }

  return <AppShell>{children}</AppShell>;
}
