import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize API id (string or pgtype-style object) to string for links and comparison */
export function toId(val: unknown): string {
  if (typeof val === "string") return val;
  if (val != null && typeof val === "object") {
    const o = val as Record<string, unknown>;
    if (typeof o.String === "string") return o.String;
    if (typeof o.value === "string") return o.value;
  }
  return String(val);
}
