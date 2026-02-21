"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Protocol } from "@/lib/types";
import { formatWei, shortenAddress } from "@/lib/utils";
import { DepositWithdrawForm } from "./deposit-withdraw-form";

// Same mock vault data — in production this comes from on-chain reads
const MOCK_VAULT_DATA: Record<
  number,
  {
    total_assets: string;
    locked_liquidity: string;
    available_liquidity: string;
    total_active_coverage: string;
    total_lp_shares: string;
    total_payouts: string;
    deposit_limit: string;
    current_epoch: number;
  }
> = {
  1: {
    total_assets: "5000000000000000000",
    locked_liquidity: "1200000000000000000",
    available_liquidity: "3800000000000000000",
    total_active_coverage: "1200000000000000000",
    total_lp_shares: "4800000000000000000",
    total_payouts: "150000000000000000",
    deposit_limit: "10000000000000000000",
    current_epoch: 3,
  },
  2: {
    total_assets: "8500000000000000000",
    locked_liquidity: "3200000000000000000",
    available_liquidity: "5300000000000000000",
    total_active_coverage: "3200000000000000000",
    total_lp_shares: "8200000000000000000",
    total_payouts: "500000000000000000",
    deposit_limit: "15000000000000000000",
    current_epoch: 5,
  },
  3: {
    total_assets: "2000000000000000000",
    locked_liquidity: "400000000000000000",
    available_liquidity: "1600000000000000000",
    total_active_coverage: "400000000000000000",
    total_lp_shares: "1950000000000000000",
    total_payouts: "0",
    deposit_limit: "5000000000000000000",
    current_epoch: 2,
  },
};

// Mock user position in this vault
const MOCK_USER_SHARES: Record<number, { shares: string; assets: string }> = {
  1: { shares: "480000000000000000", assets: "500000000000000000" },
  2: { shares: "820000000000000000", assets: "850000000000000000" },
  3: { shares: "0", assets: "0" },
};

export function VaultDetailClient({ protocolId }: { protocolId: string }) {
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/protocols/${protocolId}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 404 ? "Vault not found" : "Failed to load"
          );
        return res.json();
      })
      .then((data) => setProtocol(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [protocolId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-5 w-32 bg-neutral-800 rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="border border-neutral-800 rounded-xl p-6 animate-pulse space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-800" />
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-neutral-800 rounded" />
                  <div className="h-3 w-24 bg-neutral-800 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-14 bg-neutral-800 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="border border-neutral-800 rounded-xl p-5 animate-pulse space-y-4">
              <div className="h-5 w-24 bg-neutral-800 rounded" />
              <div className="h-10 bg-neutral-800 rounded" />
              <div className="h-32 bg-neutral-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !protocol) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-neutral-400 mb-4">{error || "Vault not found"}</p>
        <Link
          href="/app/lp"
          className="text-sm text-white underline underline-offset-4 hover:text-neutral-300"
        >
          Back to pools
        </Link>
      </div>
    );
  }

  const vault = MOCK_VAULT_DATA[protocol.protocol_id];
  const userPos = MOCK_USER_SHARES[protocol.protocol_id];
  if (!vault) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <p className="text-neutral-400 mb-4">No vault data available</p>
        <Link
          href="/app/lp"
          className="text-sm text-white underline underline-offset-4 hover:text-neutral-300"
        >
          Back to pools
        </Link>
      </div>
    );
  }

  const ratePercent = (protocol.premium_rate / 100).toFixed(1);
  const utilization =
    Number(vault.locked_liquidity) / Math.max(Number(vault.total_assets), 1);
  const sharePrice =
    Number(vault.total_assets) / Math.max(Number(vault.total_lp_shares), 1);

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/app/lp"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors mb-6"
      >
        &larr; Back to pools
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Vault info */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div className="border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <img
                  src={protocol.logo_url}
                  alt={protocol.protocol_name}
                  className="w-12 h-12 rounded-full bg-neutral-800"
                />
                <div>
                  <h1 className="text-lg font-bold">
                    {protocol.protocol_name} Vault
                  </h1>
                  <p className="text-xs text-neutral-500">
                    {protocol.insurance_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300">
                  Epoch {vault.current_epoch}
                </span>
                <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300">
                  {protocol.chain}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Total Assets</p>
                <p className="text-sm font-semibold">
                  {formatWei(vault.total_assets)} BTC-LST
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Locked Liquidity</p>
                <p className="text-sm font-semibold">
                  {formatWei(vault.locked_liquidity)} BTC-LST
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Available</p>
                <p className="text-sm font-semibold">
                  {formatWei(vault.available_liquidity)} BTC-LST
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Active Coverage</p>
                <p className="text-sm font-semibold">
                  {formatWei(vault.total_active_coverage)} BTC-LST
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Total LP Shares</p>
                <p className="text-sm font-semibold">
                  {formatWei(vault.total_lp_shares)}
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-500 mb-1">Share Price</p>
                <p className="text-sm font-semibold">
                  {sharePrice.toFixed(4)} BTC-LST
                </p>
              </div>
            </div>

            {/* Utilization */}
            <div className="mb-4">
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

            {/* Extra info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-neutral-800">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Premium Rate</p>
                <p className="text-sm font-medium">{ratePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Coverage Cap</p>
                <p className="text-sm font-medium">
                  {formatWei(protocol.coverage_cap)} BTC-LST
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Deposit Limit</p>
                <p className="text-sm font-medium">
                  {formatWei(vault.deposit_limit)} BTC-LST
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Total Payouts</p>
                <p className="text-sm font-medium">
                  {formatWei(vault.total_payouts)} BTC-LST
                </p>
              </div>
            </div>

            {/* Addresses */}
            <div className="flex items-center gap-6 pt-4 mt-4 border-t border-neutral-800 text-xs text-neutral-500">
              <span>
                Vault:{" "}
                <span className="font-mono text-neutral-400">
                  {shortenAddress(protocol.vault_address)}
                </span>
              </span>
              <span>
                Premium Module:{" "}
                <span className="font-mono text-neutral-400">
                  {shortenAddress(protocol.premium_module_address)}
                </span>
              </span>
            </div>
          </div>

          {/* Your Position */}
          {userPos && Number(userPos.shares) > 0 && (
            <div className="border border-neutral-800 rounded-xl p-5">
              <h2 className="text-base font-semibold mb-4">Your Position</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 mb-1">Your Shares</p>
                  <p className="text-sm font-semibold">
                    {formatWei(userPos.shares)}
                  </p>
                </div>
                <div className="bg-neutral-900 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 mb-1">Current Value</p>
                  <p className="text-sm font-semibold">
                    {formatWei(userPos.assets)} BTC-LST
                  </p>
                </div>
                <div className="bg-neutral-900 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 mb-1">Pool Share</p>
                  <p className="text-sm font-semibold">
                    {(
                      (Number(userPos.shares) /
                        Math.max(Number(vault.total_lp_shares), 1)) *
                      100
                    ).toFixed(2)}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Deposit / Withdraw form */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-8">
            <DepositWithdrawForm
              protocol={protocol}
              sharePrice={sharePrice}
              availableLiquidity={vault.available_liquidity}
              userShares={userPos?.shares ?? "0"}
              userAssets={userPos?.assets ?? "0"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
