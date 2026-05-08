/**
 * Shared specification formatter for inventory and procurement views.
 * Converts JSONB specs into human-readable dimension strings.
 */
export function formatSpecification(
  specs: Record<string, unknown> | null | undefined,
): string {
  if (!specs || typeof specs !== "object") {
    return "";
  }

  const parts: string[] = [];

  const thickness = specNumber(specs, "thickness_mm", "thickness");
  const width = specNumber(specs, "width_mm", "width");
  const diameter = specNumber(specs, "diameter_mm", "diameter");

  if (thickness > 0 && width > 0) {
    parts.push(`${formatDim(thickness)} × ${formatDim(width)}`);
  } else if (thickness > 0) {
    parts.push(formatDim(thickness));
  } else if (width > 0) {
    parts.push(formatDim(width));
  }

  if (diameter > 0) {
    parts.push(`Ø${formatDim(diameter)}`);
  }

  return parts.join(" ") || "";
}

export function formatMaterialLabel(
  name: string,
  specification: string | null | undefined,
): string {
  const trimmedName = name.trim();
  const trimmedSpec = specification?.trim();

  if (!trimmedSpec) {
    return trimmedName;
  }

  return `${trimmedName} (${trimmedSpec})`;
}

/**
 * Computes the legacy stock status used by the generic inventory view.
 */
export function computeStockStatus(
  available: number,
  threshold: number,
): "OUT_OF_STOCK" | "LOW_STOCK" | "HEALTHY" {
  if (available <= 0) return "OUT_OF_STOCK";
  if (threshold > 0 && available <= threshold) return "LOW_STOCK";
  return "HEALTHY";
}

export function stockStatusLabel(
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "HEALTHY",
): string {
  switch (status) {
    case "OUT_OF_STOCK":
      return "Out of Stock";
    case "LOW_STOCK":
      return "Low Stock";
    case "HEALTHY":
      return "Healthy";
  }
}

export function stockStatusColor(
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "HEALTHY",
): string {
  switch (status) {
    case "OUT_OF_STOCK":
      return "text-red-600 dark:text-red-400";
    case "LOW_STOCK":
      return "text-amber-600 dark:text-amber-400";
    case "HEALTHY":
      return "text-emerald-600 dark:text-emerald-400";
  }
}

function formatDim(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}mm`;
  }
  return `${parseFloat(value.toFixed(4))}mm`;
}

function specNumber(
  specs: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const raw = specs[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      return raw;
    }
  }
  return 0;
}
