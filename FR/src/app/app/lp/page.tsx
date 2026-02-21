"use client";

import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import { useEffect, useState } from "react";
import type { Protocol } from "@/lib/types";
import { formatWei, shortenAddress } from "@/lib/utils";

// Mock on-chain data per protocol (keyed by protocol_id)
const MOCK_VAULT_DATA: Record<
  number,
  {
    total_assets: string;
    locked_liquidity: string;
    available_liquidity: string;
    total_active_coverage: string;
    total_lp_shares: string;
    current_epoch: number;
  }
> = {
  1: {
    total_assets: "5000000000000000000",
    locked_liquidity: "1200000000000000000",
    available_liquidity: "3800000000000000000",
    total_active_coverage: "1200000000000000000",
    total_lp_shares: "4800000000000000000",
    current_epoch: 3,
  },
  2: {
    total_assets: "8500000000000000000",
    locked_liquidity: "3200000000000000000",
    available_liquidity: "5300000000000000000",
    total_active_coverage: "3200000000000000000",
    total_lp_shares: "8200000000000000000",
    current_epoch: 5,
  },
  3: {
    total_assets: "2000000000000000000",
    locked_liquidity: "400000000000000000",
    available_liquidity: "1600000000000000000",
    total_active_coverage: "400000000000000000",
    total_lp_shares: "1950000000000000000",
    current_epoch: 2,
  },
};

export default function LPPage() {
  const { status } = useAccount();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "connected") return;
    fetch("/api/protocols")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProtocols(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to get started</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Liquidity Pools</h2>
      <p className="text-neutral-400 mb-8">
        Active insurance vaults backing coverage policies. Provide liquidity to
        earn premiums.
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-neutral-800 rounded-xl p-6 animate-pulse"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-11 h-11 rounded-full bg-neutral-800" />
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-neutral-800 rounded" />
                  <div className="h-3 w-28 bg-neutral-800 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-14 bg-neutral-800 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : protocols.length === 0 ? (
        <p className="text-neutral-500">No active insurance pools.</p>
      ) : (
        <div className="space-y-4">
          {protocols.map((p) => {
            const vault = MOCK_VAULT_DATA[p.protocol_id];
            if (!vault) return null;

            const ratePercent = (p.premium_rate / 100).toFixed(1);
            const utilization =
              Number(vault.locked_liquidity) /
              Math.max(Number(vault.total_assets), 1);

            return (
              <div
                key={p._id}
                className="border border-neutral-800 rounded-xl p-6"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.logo_url}
                      alt={p.protocol_name}
                      className="w-11 h-11 rounded-full bg-neutral-800"
                    />
                    <div>
                      <h3 className="font-semibold">{p.protocol_name}</h3>
                      <p className="text-xs text-neutral-500">
                        {p.insurance_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300">
                      Epoch {vault.current_epoch}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300">
                      {p.chain}
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Total Assets</p>
                    <p className="text-sm font-semibold">
                      {formatWei(vault.total_assets)} BTC-LST
                    </p>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Locked Liquidity
                    </p>
                    <p className="text-sm font-semibold">
                      {formatWei(vault.locked_liquidity)} BTC-LST
                    </p>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Available Liquidity
                    </p>
                    <p className="text-sm font-semibold">
                      {formatWei(vault.available_liquidity)} BTC-LST
                    </p>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Active Coverage
                    </p>
                    <p className="text-sm font-semibold">
                      {formatWei(vault.total_active_coverage)} BTC-LST
                    </p>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">LP Shares</p>
                    <p className="text-sm font-semibold">
                      {formatWei(vault.total_lp_shares)}
                    </p>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">
                      Premium Rate
                    </p>
                    <p className="text-sm font-semibold">{ratePercent}%</p>
                  </div>
                </div>

                {/* Utilization bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-neutral-500">Utilization</span>
                    <span className="text-neutral-300">
                      {(utilization * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${utilization * 100}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>
                      Vault:{" "}
                      <span className="font-mono text-neutral-400">
                        {shortenAddress(p.vault_address)}
                      </span>
                    </span>
                    <span>
                      Cap: {formatWei(p.coverage_cap)} BTC-LST
                    </span>
                  </div>
                  <Link
                    href={`/app/lp/${p._id}`}
                    className="text-xs px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
