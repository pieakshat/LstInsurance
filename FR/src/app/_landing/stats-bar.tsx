"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useCounter(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// Single stat item
// ---------------------------------------------------------------------------

function Stat({
  prefix, target, suffix, label, active, decimals = 0,
}: {
  prefix?: string; target: number; suffix: string; label: string;
  active: boolean; decimals?: number;
}) {
  const count = useCounter(target, 1600, active);
  const display = decimals > 0
    ? (count / Math.pow(10, decimals)).toFixed(1)
    : count.toLocaleString();

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
        {prefix}{display}{suffix}
      </span>
      <span className="text-xs text-neutral-500 tracking-wide">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

const STATS = [
  { prefix: "$", target: 124, suffix: "M+", label: "Total Value Locked",  decimals: 1 },
  { prefix: "",  target: 284, suffix: "",   label: "Active Policies"      },
  { prefix: "",  target: 8,   suffix: "",   label: "Protocols Covered"    },
  { prefix: "$", target: 0,   suffix: "",   label: "Missed Payouts"       },
];

export function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); obs.disconnect(); } },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="border-y border-white/[0.06] py-10"
      style={{ background: "rgba(255,255,255,0.018)" }}
    >
      <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <Stat key={s.label} {...s} active={active} />
        ))}
      </div>
    </div>
  );
}
