"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Scroll-fade hook (shared pattern)
// ---------------------------------------------------------------------------

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: <ChainIcon />,
    title: "Fully on-chain",
    body: "Policies, claims, and payouts are executed entirely on Starknet. Transparent, verifiable, and free from off-chain intermediaries.",
    accent: "#E8704A",
  },
  {
    icon: <BTCIcon />,
    title: "Bitcoin-backed",
    body: "Coverage is secured by BTC-LST liquidity. Your protection is backed by the strongest asset in crypto.",
    accent: "#F7931A",
  },
  {
    icon: <LightningIcon />,
    title: "Fast settlement",
    body: "Once a claim is approved, payouts are executed directly from the vault to your wallet.",
    accent: "#60A5FA",
  },
  {
    icon: <LockOpenIcon />,
    title: "Permissionless",
    body: "No KYC, no paperwork. Connect your wallet and access insurance instantly.",
    accent: "#34D399",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Features() {
  const { ref, visible } = useInView();

  return (
    <section
      id="features"
      className="py-28 px-6 lg:px-14"
      style={{ background: "rgba(255,255,255,0.016)" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="mb-16">
          <p className="text-xs text-[#E8704A] font-medium tracking-widest uppercase mb-3">Why BitCover</p>
          <h2 className="text-4xl lg:text-5xl font-bold">Built different</h2>
        </div>

        {/* Grid — first card spans 2 cols (asymmetric) */}
        <div ref={ref} className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.1} visible={visible} primary={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Feature card with hover lift
// ---------------------------------------------------------------------------

function FeatureCard({
  icon, title, body, accent, delay, visible, primary = false,
}: {
  icon: React.ReactNode; title: string; body: string;
  accent: string; delay: number; visible: boolean; primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative rounded-2xl cursor-default overflow-hidden ${primary ? "sm:col-span-2 p-8" : "p-6"}`}
      style={{
        background: hovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
        transform: visible
          ? hovered ? "translateY(-3px)" : "translateY(0)"
          : "translateY(28px)",
        opacity: visible ? 1 : 0,
        transition: `opacity 0.5s ease ${delay}s, transform 0.4s ease ${delay}s, background 0.2s, border-color 0.2s`,
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.3)` : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent glow on hover */}
      {hovered && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accent}12 0%, transparent 65%)`,
          }}
        />
      )}

      {primary ? (
        /* Primary card: landscape layout */
        <div className="flex gap-6 items-start">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-xl mb-2">{title}</h3>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-md">{body}</p>
          </div>
        </div>
      ) : (
        /* Regular card: portrait layout */
        <>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-base mb-2">{title}</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">{body}</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8704A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function BTCIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L10.5 19.25m1.267-.161L9.5 8.183m0 0c-3.764-.665-4.98 6.228-.056 7.096M9.5 8.183 8.25 7.95M9.5 8.183l1.266.222M8.25 7.95l-1.25-.22M14.983 12.195c4.924.868 3.708 7.761-1.216 6.894" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 L4.5 13.5 H11 L11 22 L19.5 10.5 H13 Z" />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
