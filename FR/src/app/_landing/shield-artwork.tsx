"use client";

import { useEffect, useRef } from "react";

const PROTOCOLS = [
  { name: "Aave v3",  amount: "$2.1M", color: "#60A5FA" },
  { name: "Uniswap",  amount: "$890K", color: "#A78BFA" },
  { name: "Curve",    amount: "$1.4M", color: "#34D399" },
];

export function ShieldArtwork() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = document.getElementById("hero-section");
    if (!hero || !wrapRef.current) return;

    const handleMouse = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 20;
      const y = ((e.clientY - rect.top)  / rect.height - 0.5) * 14;
      if (wrapRef.current) wrapRef.current.style.transform = `translate(${x}px, ${y}px)`;
    };
    const handleLeave = () => {
      if (wrapRef.current) wrapRef.current.style.transform = "translate(0px, 0px)";
    };

    hero.addEventListener("mousemove", handleMouse);
    hero.addEventListener("mouseleave", handleLeave);
    return () => {
      hero.removeEventListener("mousemove", handleMouse);
      hero.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center w-full h-[500px] select-none">

      {/* One single centered ambient glow — not competing blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(232,112,74,0.13) 0%, transparent 65%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(28px)",
        }}
      />

      {/* Parallax group — shield + coverage widget stacked */}
      <div
        ref={wrapRef}
        className="relative flex flex-col items-center gap-5"
        style={{ transition: "transform 0.45s cubic-bezier(0.23, 1, 0.32, 1)" }}
      >
        <ShieldSvg />
        <CoverageWidget />
      </div>
    </div>
  );
}

function ShieldSvg() {
  return (
    <svg
      width="148"
      height="165"
      viewBox="0 0 100 112"
      fill="none"
      style={{ filter: "drop-shadow(0 0 22px rgba(232,112,74,0.42))" }}
    >
      <defs>
        <linearGradient id="shieldFill" x1="50" y1="0" x2="50" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(232,112,74,0.30)" />
          <stop offset="100%" stopColor="rgba(232,112,74,0.07)" />
        </linearGradient>
        <linearGradient id="shieldStroke" x1="0" y1="0" x2="100" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(232,112,74,0.95)" />
          <stop offset="100%" stopColor="rgba(232,112,74,0.28)" />
        </linearGradient>
        <linearGradient id="shieldInner" x1="50" y1="10" x2="50" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.09)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
        </linearGradient>
      </defs>

      <path
        d="M50 4 L94 20 L94 63 C94 84 74 98 50 108 C26 98 6 84 6 63 L6 20 Z"
        fill="url(#shieldFill)"
        stroke="url(#shieldStroke)"
        strokeWidth="1.5"
      />
      <path
        d="M50 13 L87 26 L87 63 C87 80 70 92 50 100 C30 92 13 80 13 63 L13 26 Z"
        fill="url(#shieldInner)"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="0.8"
      />
      <text
        x="50" y="70" textAnchor="middle"
        fontSize="36" fontWeight="700" fill="white"
        style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.30))" }}
      >
        ₿
      </text>
    </svg>
  );
}

function CoverageWidget() {
  return (
    <div
      style={{
        background: "rgba(14,17,26,0.75)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        width: 252,
        padding: "14px 16px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.18em]">
          Live Coverage
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#34D399] shrink-0"
            style={{ animation: "dot-pulse 2.5s ease-in-out infinite" }}
          />
          <span className="text-[10px] text-[#34D399] font-medium">Active</span>
        </span>
      </div>

      <div className="h-px bg-white/[0.06] mb-3" />

      {/* Protocol rows */}
      <div className="flex flex-col gap-2.5">
        {PROTOCOLS.map((p) => (
          <div key={p.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color, boxShadow: `0 0 5px ${p.color}55` }}
              />
              <span className="text-xs text-neutral-300 font-medium">{p.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-white tabular-nums">{p.amount}</span>
              <span className="text-[10px] text-[#34D399] font-bold">✓</span>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-white/[0.06] mt-3 mb-2.5" />
      <p className="text-[10px] text-neutral-600 text-center tracking-wide">
        3 protocols · fully on-chain
      </p>
    </div>
  );
}
