import Link from "next/link";
import { ShieldArtwork } from "./shield-artwork";

export function Hero() {
  return (
    <section
      id="hero-section"
      className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden"
    >
      {/* Subtle warm ambient glow from the artwork side */}
      <div
        className="absolute right-0 top-0 h-full w-[60%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 80% 45%, rgba(232,112,74,0.07) 0%, transparent 65%)",
        }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-6 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-4 items-center">

          {/* ── Left: copy ─────────────────────────────────────────────────── */}
          <div className="flex flex-col items-start">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-[#E8704A]/25 bg-[#E8704A]/8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8704A]" style={{ animation: "dot-pulse 2s ease-in-out infinite" }} />
              <span className="text-xs font-medium text-[#E8704A] tracking-wide">On-chain Insurance · Starknet</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              Your BTC in DeFi,
              <br />
              <span className="text-[#E8704A]">protected.</span>
            </h1>

            {/* Subtext */}
            <p className="text-lg text-neutral-400 leading-relaxed mb-10 max-w-md">
              BitCover gives you on-chain coverage for your BTC positions across DeFi protocols.
              Buy in seconds, settle claims entirely on-chain. No custodians, no paperwork.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="px-7 py-3 rounded-lg bg-[#E8704A] text-white font-semibold text-sm hover:bg-[#d4603a] transition-colors"
              >
                Get Covered
              </Link>
              <a
                href="#how-it-works"
                className="px-7 py-3 rounded-lg border border-white/12 text-neutral-300 font-medium text-sm hover:border-white/25 hover:text-white transition-all"
              >
                How it works ↓
              </a>
            </div>

            {/* Social proof micro-line */}
            <p className="mt-8 text-xs text-neutral-600">
              Powered by Starknet · Audited · Non-custodial
            </p>
          </div>

          {/* ── Right: interactive shield artwork ────────────────────────── */}
          <div className="hidden lg:block">
            <ShieldArtwork />
          </div>
        </div>
      </div>
    </section>
  );
}
