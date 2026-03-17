import Link from "next/link";

export function ForLPs() {
  return (
    <section id="for-lps" className="py-28 px-6 lg:px-14 max-w-7xl mx-auto">
      <div
        className="rounded-3xl px-8 lg:px-16 py-14 overflow-hidden relative text-center"
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

        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs text-[#E8704A] font-medium tracking-widest uppercase mb-4">For liquidity providers</p>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
            Two yield streams on your BTC-LST.
          </h2>
          <p className="text-neutral-400 leading-relaxed mb-8">
            Deposit xyBTC into a BitCover vault and earn USDC premiums from every policy sold —
            on top of the staking yield already accruing on your BTC-LST. Each protocol has its
            own isolated vault, so you choose exactly which risk you&apos;re underwriting.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
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
      </div>
    </section>
  );
}
