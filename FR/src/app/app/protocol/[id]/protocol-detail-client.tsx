"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Protocol } from "@/lib/types";
import { formatWei, shortenAddress } from "@/lib/utils";
import { BuyCoverForm } from "./buy-cover-form";
import { CoverDetails } from "./cover-details-modal";

export function ProtocolDetailClient({ protocolId }: { protocolId: string }) {
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/protocols/${protocolId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Protocol not found" : "Failed to load");
        return res.json();
      })
      .then((data) => setProtocol(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [protocolId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-5 w-40 skeleton rounded mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="gradient-border rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full skeleton" />
                <div className="space-y-2">
                  <div className="h-5 w-48 skeleton rounded" />
                  <div className="h-4 w-32 skeleton rounded" />
                </div>
              </div>
              <div className="h-4 w-full skeleton rounded mb-3" />
              <div className="h-4 w-3/4 skeleton rounded mb-6" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 skeleton rounded-lg" />
                ))}
              </div>
            </div>
            <div className="gradient-border rounded-xl p-5 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-3 w-24 skeleton rounded mb-2" />
                  <div className="h-3 w-full skeleton rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="gradient-border rounded-xl p-5">
              <div className="h-5 w-24 skeleton rounded mb-4" />
              <div className="h-10 skeleton rounded mb-4" />
              <div className="h-8 skeleton rounded mb-4" />
              <div className="h-32 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !protocol) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-neutral-400 mb-4">{error || "Protocol not found"}</p>
        <Link
          href="/app"
          className="text-sm text-white underline underline-offset-4 hover:text-neutral-300"
        >
          Back to protocols
        </Link>
      </div>
    );
  }

  const ratePercent = (protocol.premium_rate / 100).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors mb-6"
      >
        &larr; Back to protocols
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — protocol info + cover details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Protocol Header */}
          <div className="gradient-border rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <img
                src={protocol.logo_url}
                alt={protocol.protocol_name}
                className="w-14 h-14 rounded-full bg-white/5"
              />
              <div>
                <h1 className="text-xl font-bold">{protocol.protocol_name}</h1>
                <p className="text-sm text-neutral-400">{protocol.insurance_name}</p>
              </div>
              <span className="ml-auto text-xs text-neutral-500">
                {protocol.chain}
              </span>
            </div>

            <p className="text-sm text-neutral-400 mb-5">{protocol.description}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0f1117] rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Premium Rate</p>
                <p className="text-sm font-semibold text-white">{ratePercent}% / yr</p>
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Coverage Cap</p>
                <p className="text-sm font-semibold text-white">{formatWei(protocol.coverage_cap)} BTC-LST</p>
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Vault</p>
                <p className="text-sm font-semibold font-mono text-neutral-300">
                  {shortenAddress(protocol.vault_address)}
                </p>
              </div>
            </div>
          </div>

          {/* Cover Details — always visible */}
          <CoverDetails protocol={protocol} />
        </div>

        {/* Right column — buy form (sticky) */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-8">
            <BuyCoverForm protocol={protocol} />
          </div>
        </div>
      </div>
    </div>
  );
}
