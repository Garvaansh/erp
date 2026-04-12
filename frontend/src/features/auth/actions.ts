"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { authenticateWithBackend } from "@/lib/api/auth-server";
import type { LoginActionState } from "@/features/auth/types";

const DEFAULT_ACTION_STATE: LoginActionState = {
  ok: false,
  message: "",
};

export async function loginAction(
  _previousState: LoginActionState = DEFAULT_ACTION_STATE,
  formData: FormData,
): Promise<LoginActionState> {
  void _previousState;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      ok: false,
      message: "Email and password are required.",
    };
  }

  try {
    const result = await authenticateWithBackend(email, password);

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
      };
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: "session",
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: result.sessionMaxAge,
    });

    revalidatePath("/dashboard");

    return {
      ok: true,
      message: "Login successful.",
    };
  } catch (error) {
    return {
      ok: false,
      message: "Authentication service unavailable.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  revalidatePath("/");
}
