"use client";

// Mock global protocol stats — in production, aggregate from on-chain reads
const STATS = [
  { label: "Total TVL", value: "15.5 BTC-LST" },
  { label: "Active Coverage", value: "4.8 BTC-LST" },
  { label: "Claims Paid", value: "0.65 BTC-LST" },
  { label: "Active Policies", value: "24" },
];

export function GlobalStats() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3"
        >
          <p className="text-xs text-neutral-500 mb-0.5">{s.label}</p>
          <p className="text-sm font-semibold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
