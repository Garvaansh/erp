export function calculateDifference(
  input: number,
  output: number,
  scrap: number,
  shortQty: number,
): number {
  return Math.abs(input - (output + scrap + shortQty));
}

export function calculateTolerance(input: number): number {
  if (input <= 0) {
    return 0;
  }

  const onePercent = input * 0.01;
  const fivePercentCap = input * 0.05;
  return Math.min(Math.max(2, onePercent), fivePercentCap);
}

export function isWithinTolerance(
  input: number,
  output: number,
  scrap: number,
  shortQty: number,
): boolean {
  const difference = calculateDifference(input, output, scrap, shortQty);
  const tolerance = calculateTolerance(input);
  return difference <= tolerance;
}
