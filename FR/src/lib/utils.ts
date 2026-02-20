import { BASE_DURATION, RATE_DENOMINATOR } from "./constants";

/**
 * Format a stringified bigint (wei) to human-readable with commas.
 * e.g. "1000000000000000000000000" → "1,000,000"
 */
export function formatWei(raw: string, decimals = 18): string {
  try {
    const n = Number(raw) / 10 ** decimals;
    return n.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  } catch {
    return raw;
  }
}

/**
 * Format seconds to a human-readable duration.
 * e.g. 7776000 → "90 days"
 */
export function formatDuration(seconds: number): string {
  const days = Math.round(seconds / 86400);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

/**
 * Shorten a hex address for display.
 * e.g. "0x0123456789abcdef..." → "0x0123...cdef"
 */
export function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Client-side premium calculation (UI mockup).
 * Formula: (amount * rate * duration) / (RATE_DENOMINATOR * BASE_DURATION)
 * Returns a human-readable number.
 */
export function calculatePremium(
  amountHuman: number,
  premiumRate: number,
  durationSecs: number
): number {
  return (amountHuman * premiumRate * durationSecs) / (RATE_DENOMINATOR * BASE_DURATION);
}
