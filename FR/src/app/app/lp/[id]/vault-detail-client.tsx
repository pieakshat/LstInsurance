"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";
import type { Protocol } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";
import { VAULT_ABI } from "@/lib/abis/vault";
import { DepositWithdrawForm } from "./deposit-withdraw-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

function parseU256(raw: unknown): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  if (typeof raw === "string") return BigInt(raw);
  if (typeof raw === "object" && raw !== null && "low" in (raw as object)) {
    const r = raw as { low: unknown; high: unknown };
    return (BigInt(String(r.high)) << SHIFT_128) | BigInt(String(r.low));
  }
  return 0n;
}

function fmtBtc(wei: bigint): string {
  if (wei === 0n) return "0";
  const val = Number(wei) / 1e18;
  if (val < 0.0001) return "<0.0001";
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Encode bigint as {low, high} struct for useReadContract u256 args
function asU256(v: bigint): { low: bigint; high: bigint } {
  return { low: v & U128_MASK, high: v >> SHIFT_128 };
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 rounded-lg p-3">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VaultDetailClient({ protocolId }: { protocolId: string }) {
  const { address: userAddress } = useAccount();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch protocol from DB ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/protocols/${protocolId}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(res.status === 404 ? "Vault not found" : "Failed to load");
        return res.json();
      })
      .then((data) => setProtocol(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [protocolId]);

  const vaultAddr = protocol?.vault_address ?? "";
  const vaultEnabled = !!vaultAddr && vaultAddr !== "0x0";

  // ── On-chain reads ────────────────────────────────────────────────────────
  const { data: totalAssetsRaw, refetch: refetchAssets } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_assets",
    args: [],
    enabled: vaultEnabled,
  });

  const { data: totalSupplyRaw, refetch: refetchSupply } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_supply",
    args: [],
    enabled: vaultEnabled,
  });

  const { data: lockedRaw, refetch: refetchLocked } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_locked_liquidity",
    args: [],
    enabled: vaultEnabled,
  });

  const { data: availableRaw, refetch: refetchAvailable } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "available_liquidity",
    args: [],
    enabled: vaultEnabled,
  });

  const { data: depositLimitRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "get_deposit_limit",
    args: [],
    enabled: vaultEnabled,
  });

  const { data: totalPayoutsRaw, refetch: refetchPayouts } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_payouts",
    args: [],
    enabled: vaultEnabled,
  });

  // User's vault share balance
  const { data: userSharesRaw, refetch: refetchUserShares } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "balance_of",
    args: [userAddress],
    enabled: vaultEnabled && !!userAddress,
  });

  // ── Parse raw values ──────────────────────────────────────────────────────
  const totalAssets = parseU256(totalAssetsRaw);
  const totalSupply = parseU256(totalSupplyRaw);
  const locked = parseU256(lockedRaw);
  const available = parseU256(availableRaw);
  const depositLimit = parseU256(depositLimitRaw);
  const totalPayouts = parseU256(totalPayoutsRaw);
  const userShares = parseU256(userSharesRaw);

  // preview_redeem for user's current asset value
  const { data: userAssetsRaw, refetch: refetchUserAssets } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "preview_redeem",
    args: [asU256(userShares)],
    enabled: vaultEnabled && userShares > 0n,
  });
  const userAssets = parseU256(userAssetsRaw);

  // ── Computed ──────────────────────────────────────────────────────────────
  const utilization = totalAssets > 0n ? Number(locked) / Number(totalAssets) : 0;
  const sharePriceWei = totalSupply > 0n ? (totalAssets * BigInt(1e18)) / totalSupply : BigInt(1e18);
  const sharePriceFloat = Number(sharePriceWei) / 1e18;

  const MAX_U256 = (1n << 256n) - 1n;
  const depositLimitDisplay =
    depositLimit >= MAX_U256 / 2n ? "Unlimited" : `${fmtBtc(depositLimit)} BTC-LST`;

  function refetchPosition() {
    // Small delay to give the RPC node time to index the confirmed block
    setTimeout(() => {
      refetchAssets();
      refetchSupply();
      refetchLocked();
      refetchAvailable();
      refetchPayouts();
      refetchUserShares();
      refetchUserAssets();
    }, 1500);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading || (!protocol && !error)) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-5 w-32 bg-neutral-800 rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
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
        <Link href="/app/lp" className="text-sm text-white underline underline-offset-4 hover:text-neutral-300">
          Back to pools
        </Link>
      </div>
    );
  }

  const ratePercent = (protocol.premium_rate / 100).toFixed(1);

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
          <div className="border border-neutral-800 rounded-xl p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <img
                  src={protocol.logo_url}
                  alt={protocol.protocol_name}
                  className="w-12 h-12 rounded-full bg-neutral-800"
                />
                <div>
                  <h1 className="text-lg font-bold">{protocol.protocol_name} Vault</h1>
                  <p className="text-xs text-neutral-500">{protocol.insurance_name}</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-neutral-800 rounded-full text-neutral-300">
                {protocol.chain}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <Stat
                label="Total Assets"
                value={vaultEnabled ? `${fmtBtc(totalAssets)} BTC-LST` : "—"}
              />
              <Stat
                label="Locked Liquidity"
                value={vaultEnabled ? `${fmtBtc(locked)} BTC-LST` : "—"}
              />
              <Stat
                label="Available"
                value={vaultEnabled ? `${fmtBtc(available)} BTC-LST` : "—"}
              />
              <Stat
                label="Total LP Shares"
                value={vaultEnabled ? fmtBtc(totalSupply) : "—"}
              />
              <Stat
                label="Share Price"
                value={vaultEnabled ? `${sharePriceFloat.toFixed(4)} BTC-LST` : "—"}
              />
              <Stat
                label="Total Payouts"
                value={vaultEnabled ? `${fmtBtc(totalPayouts)} BTC-LST` : "—"}
              />
            </div>

            {/* Utilization bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-neutral-500">Utilization</span>
                <span className="text-neutral-300">{(utilization * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Extra info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-neutral-800">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Premium Rate</p>
                <p className="text-sm font-medium">{ratePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Coverage Cap</p>
                <p className="text-sm font-medium">{fmtBtc(BigInt(protocol.coverage_cap))} BTC-LST</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Deposit Limit</p>
                <p className="text-sm font-medium">{vaultEnabled ? depositLimitDisplay : "—"}</p>
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
          {userAddress && userShares > 0n && (
            <div className="border border-neutral-800 rounded-xl p-5">
              <h2 className="text-base font-semibold mb-4">Your Position</h2>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Your Shares" value={fmtBtc(userShares)} />
                <Stat label="Current Value" value={`${fmtBtc(userAssets)} BTC-LST`} />
                <Stat
                  label="Pool Share"
                  value={
                    totalSupply > 0n
                      ? `${((Number(userShares) / Number(totalSupply)) * 100).toFixed(2)}%`
                      : "0%"
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — Deposit / Withdraw form */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-8">
            <DepositWithdrawForm
              vaultAddress={vaultAddr}
              userAddress={userAddress}
              totalAssets={totalAssets}
              totalSupply={totalSupply}
              availableLiquidity={available}
              onTxSuccess={refetchPosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
