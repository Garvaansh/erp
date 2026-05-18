/**
 * Converts a number to Indian rupee words.
 * Examples: 5000 → "Five Thousand Rupees Only"
 */
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function convertHundreds(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n] + " ";
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
  return ones[Math.floor(n / 100)] + " Hundred " + convertHundreds(n % 100);
}

export function amountToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  let result = "";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remainder = rupees % 1000;

  if (crore) result += convertHundreds(crore) + "Crore ";
  if (lakh) result += convertHundreds(lakh) + "Lakh ";
  if (thousand) result += convertHundreds(thousand) + "Thousand ";
  if (remainder) result += convertHundreds(remainder);

  result = result.trim() + " Rupees";

  if (paise > 0) {
    result += " and " + convertHundreds(paise).trim() + " Paise";
  }

  return result + " Only";
}

/**
 * Format a number as Indian currency string.
 * E.g. 95000 → "₹95,000.00"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format ISO date string as "DD MMM YYYY"
 */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Add N days to a date and return ISO string.
 */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
