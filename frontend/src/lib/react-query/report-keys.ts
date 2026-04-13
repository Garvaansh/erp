export const reportKeys = {
  all: ["reports"] as const,
  list: (type: string, filters: unknown) => ["reports", type, filters] as const,
};
