import Link from "next/link";

const LP_STATS = [
  { value: "12%",   label: "Avg APY"         },
  { value: "$8.3M", label: "Liquidity Pooled" },
  { value: "3",     label: "Active Vaults"    },
];

export function ForLPs() {
  return (
    <section id="for-lps" className="py-28 px-6 lg:px-14 max-w-7xl mx-auto">
      <div
        className="rounded-3xl px-8 lg:px-16 py-14 overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(232,112,74,0.08) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(232,112,74,0.15)",
        }}
      >
        {/* Subtle radial glow top-right */}
        <div
          className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at top right, rgba(232,112,74,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <p className="text-xs text-[#E8704A] font-medium tracking-widest uppercase mb-4">For liquidity providers</p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
              Earn yield by backing coverage.
            </h2>
            <p className="text-neutral-400 leading-relaxed mb-8">
              Provide BTC-LST liquidity to insurance vaults and earn premium income from every policy sold. Your capital is the backbone of the protocol — and it earns for it.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/app/lp"
                className="px-6 py-2.5 rounded-lg bg-[#E8704A] text-white font-medium text-sm hover:bg-[#d4603a] transition-colors"
              >
                Explore Pools
              </Link>
              <a
                href="#how-it-works"
                className="px-6 py-2.5 rounded-lg border border-white/12 text-neutral-300 font-medium text-sm hover:border-white/25 hover:text-white transition-all"
              >
                Learn more
              </a>
            </div>
          </div>

          {/* Right — LP stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {LP_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl px-4 py-5 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-2xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
