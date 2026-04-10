"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "border border-slate-200 bg-white text-slate-900",
        },
      }}
    />
  );
}
