import { cookies } from "next/headers";
import { apiSuccess } from "@/app/api/_shared/http";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  return apiSuccess("Logged out successfully", null, 200);
}
