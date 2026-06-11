/**
 * Canonical license-plate normalization shared across agencies.
 * Strips whitespace and hyphens and upper-cases so that "LAG 501 MX",
 * "lag-501-mx", and "LAG501MX" all compare equal.
 */
export function normalizePlate(plate: string): string {
  return (plate ?? "").replace(/[\s-]/g, "").toUpperCase();
}
