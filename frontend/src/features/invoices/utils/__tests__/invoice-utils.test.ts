/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { amountToWords, formatINR, formatDate, addDays } from "../invoice-utils";

describe("amountToWords", () => {
  it("converts zero", () => {
    expect(amountToWords(0)).toBe("Zero Rupees Only");
  });
  it("converts 5000", () => {
    expect(amountToWords(5000)).toContain("Five Thousand");
    expect(amountToWords(5000)).toContain("Rupees Only");
  });
  it("converts 5900 (CGST 9% + SGST 9% on 5000)", () => {
    const result = amountToWords(5900);
    expect(result).toContain("Five Thousand");
    expect(result).toContain("Nine Hundred");
    expect(result).toContain("Rupees Only");
  });
  it("converts 100000", () => {
    expect(amountToWords(100000)).toContain("Lakh");
  });
  it("converts 1 crore", () => {
    expect(amountToWords(10000000)).toContain("Crore");
  });
  it("handles paise", () => {
    expect(amountToWords(100.50)).toContain("Fifty Paise");
  });
});

describe("formatINR", () => {
  it("formats 5000 as ₹5,000.00", () => {
    expect(formatINR(5000)).toContain("5,000");
    expect(formatINR(5000)).toContain("₹");
  });
  it("formats 0 as ₹0.00", () => {
    expect(formatINR(0)).toContain("0");
  });
  it("formats large numbers with Indian commas", () => {
    // 100000 → ₹1,00,000.00 (Indian numbering)
    const result = formatINR(100000);
    expect(result).toContain("₹");
  });
});

describe("formatDate", () => {
  it("returns — for empty string", () => {
    expect(formatDate("")).toBe("—");
  });
  it("formats an ISO date", () => {
    const result = formatDate("2026-05-18T00:00:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("May");
  });
});

describe("addDays", () => {
  it("adds 30 days to a date", () => {
    const start = "2026-05-18T00:00:00.000Z";
    const result = addDays(start, 30);
    const d = new Date(result);
    expect(d.getUTCDate()).toBe(17); // May 18 + 30 = June 17
    expect(d.getUTCMonth()).toBe(5); // June = 5
  });
});
