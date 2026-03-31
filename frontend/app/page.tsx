import { redirect } from "next/navigation";

export default function Home() {
  // Instantly push traffic to the dashboard.
  // The middleware.ts file will intercept this and secure it.
  redirect("/dashboard");
}
