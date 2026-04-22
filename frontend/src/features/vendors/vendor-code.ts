export function sanitizeVendorCode(raw: string): string {
  const lettersOnly = raw.toUpperCase().replace(/[^A-Z]/g, "");
  return lettersOnly.slice(0, 5);
}

export function deriveVendorCodeFromName(name: string): string {
  const derived = sanitizeVendorCode(name);
  if (derived) {
    return derived;
  }
  return "VENDOR".slice(0, 5);
}
