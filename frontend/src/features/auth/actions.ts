"use server";

import { revalidatePath } from "next/cache";
import { login } from "@/features/auth/api";
import type { LoginActionState } from "@/features/auth/types";

const DEFAULT_ACTION_STATE: LoginActionState = {
  ok: false,
  message: "",
};

export async function loginAction(
  _previousState: LoginActionState = DEFAULT_ACTION_STATE,
  formData: FormData,
): Promise<LoginActionState> {
  try {
    await login({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    revalidatePath("/dashboard");

    return {
      ok: true,
      message: "Login successful.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Login failed.",
    };
  }
}
