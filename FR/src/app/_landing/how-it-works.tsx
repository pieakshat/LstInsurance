"use client";

import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.2) {
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

const STEPS = [
  {
    number: "01",
    title: "Choose a protocol",
    body: "Browse registered DeFi protocols. Each has its own isolated vault with a transparent coverage cap and premium rate set by governance.",
  },
  {
    number: "02",
    title: "Buy coverage",
    body: "Pick an amount and duration (30–180 days), pay a USDC premium, and receive a Coverage NFT to your wallet. Coverage is active immediately.",
  },
  {
    number: "03",
    title: "Get paid if it fails",
    body: "If the protocol is exploited, submit your claim on-chain. Once governors approve, BTC-LST is sent directly to your wallet and your NFT is burned — automatic, no intermediaries.",
  },
];

export function HowItWorks() {
  const { ref, visible } = useInView();

  return (
    <section id="how-it-works" className="py-28 px-6 lg:px-14 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="mb-16">
        <p className="text-xs text-[#E8704A] font-medium tracking-widest uppercase mb-3">How it works</p>
        <h2 className="text-4xl lg:text-5xl font-bold">Coverage in three steps</h2>
      </div>

      {/* Steps */}
      <div ref={ref} className="grid md:grid-cols-3 gap-10 lg:gap-14">
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            className="flex flex-col"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: `opacity 0.55s ease ${i * 0.12}s, transform 0.55s ease ${i * 0.12}s`,
            }}
          >
            {/* Step line */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold text-[#E8704A] tracking-[0.2em] shrink-0">
                {step.number}
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: "linear-gradient(90deg, rgba(232,112,74,0.4), transparent)",
                }}
              />
            </div>

            <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
