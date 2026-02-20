export const BASE_DURATION = 7_776_000; // 90 days in seconds
export const RATE_DENOMINATOR = 10_000;

export const DURATION_OPTIONS = [
  { label: "30 days", value: 30 * 86400 },
  { label: "60 days", value: 60 * 86400 },
  { label: "90 days", value: 90 * 86400 },
  { label: "180 days", value: 180 * 86400 },
] as const;
