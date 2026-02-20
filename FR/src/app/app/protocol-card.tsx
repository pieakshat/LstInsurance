"use client";

import Link from "next/link";
import type { Protocol } from "@/lib/types";

export function ProtocolCard({ protocol }: { protocol: Protocol }) {
  const ratePercent = (protocol.premium_rate / 100).toFixed(1);
  const capDisplay = formatCap(protocol.coverage_cap);

  return (
    <Link
      href={`/app/protocol/${protocol._id}`}
      className="block border border-neutral-800 rounded-xl p-5 hover:border-neutral-600 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-4">
        <img
          src={protocol.logo_url}
          alt={protocol.protocol_name}
          className="w-10 h-10 rounded-full bg-neutral-800"
        />
        <div>
          <h3 className="font-semibold leading-tight">
            {protocol.protocol_name}
          </h3>
          <p className="text-sm text-neutral-400">{protocol.insurance_name}</p>
        </div>
      </div>

      <p className="text-sm text-neutral-500 mb-4 line-clamp-2">
        {protocol.description}
      </p>

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-neutral-500">Premium</span>
          <p className="font-medium">{ratePercent}%</p>
        </div>
        <div className="text-right">
          <span className="text-neutral-500">Coverage Cap</span>
          <p className="font-medium">{capDisplay}</p>
        </div>
      </div>
    </Link>
  );
}

function formatCap(raw: string): string {
  try {
    const n = Number(raw) / 1e18;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toFixed(0);
  } catch {
    return raw;
  }
}
