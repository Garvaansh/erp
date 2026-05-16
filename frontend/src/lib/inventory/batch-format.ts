export function formatBatchQuantity(value: number): string {
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

export function formatBatchDate(value: string): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBatchDateShort(value: string): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function batchStatusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "HOLD":
      return "secondary" as const;
    case "EXHAUSTED":
      return "outline" as const;
    default:
      return "destructive" as const;
  }
}

export function batchTypeLabel(type: string): string {
  switch (type) {
    case "RAW":
      return "Raw Material Batch";
    case "MOLDED":
      return "Molded WIP Batch";
    case "FINISHED":
      return "Finished Bundle";
    default:
      return type;
  }
}
