"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "@starknet-react/core";
import { useEffect, useState } from "react";
import type { Abi } from "starknet";
import type { Protocol } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";
import { VAULT_ABI } from "@/lib/abis/vault";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;

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

// ---------------------------------------------------------------------------
// VaultCard — reads on-chain data per vault
// ---------------------------------------------------------------------------

function VaultCard({ p }: { p: Protocol }) {
  const vaultAddr = p.vault_address ?? "";
  const enabled = !!vaultAddr && vaultAddr !== "0x0";

  const { data: totalAssetsRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_assets",
    args: [],
    enabled,
  });

  const { data: totalSupplyRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_supply",
    args: [],
    enabled,
  });

  const { data: lockedRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "total_locked_liquidity",
    args: [],
    enabled,
  });

  const { data: availableRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddr as `0x${string}`,
    functionName: "available_liquidity",
    args: [],
    enabled,
  });

  const totalAssets = parseU256(totalAssetsRaw);
  const totalSupply = parseU256(totalSupplyRaw);
  const locked = parseU256(lockedRaw);
  const available = parseU256(availableRaw);

  const utilization = totalAssets > 0n ? Number(locked) / Number(totalAssets) : 0;
  const ratePercent = (p.premium_rate / 100).toFixed(1);

  const dash = enabled ? "—" : "N/A";

  return (
    <div className="gradient-border rounded-xl p-6 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img
            src={p.logo_url}
            alt={p.protocol_name}
            className="w-11 h-11 rounded-full bg-white/5"
          />
          <div>
            <h3 className="font-semibold">{p.protocol_name}</h3>
            <p className="text-xs text-neutral-500">{p.insurance_name}</p>
          </div>
        </div>
        <span className="text-xs text-neutral-500">
          {p.chain}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Total Assets</p>
          <p className="text-sm font-semibold">
            {totalAssetsRaw !== undefined ? `${fmtBtc(totalAssets)} BTC-LST` : dash}
          </p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Locked</p>
          <p className="text-sm font-semibold text-white">
            {lockedRaw !== undefined ? `${fmtBtc(locked)} BTC-LST` : dash}
          </p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Available</p>
          <p className="text-sm font-semibold text-white">
            {availableRaw !== undefined ? `${fmtBtc(available)} BTC-LST` : dash}
          </p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">LP Shares</p>
          <p className="text-sm font-semibold text-white">
            {totalSupplyRaw !== undefined ? fmtBtc(totalSupply) : dash}
          </p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Premium Rate</p>
          <p className="text-sm font-semibold text-white">{ratePercent}% / yr</p>
        </div>
      </div>

      {/* Utilization bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-neutral-500">Utilization</span>
          <span className="text-neutral-300">
            {enabled ? `${(utilization * 100).toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(utilization * 100, 100)}%`,
              background: "#E8704A",
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>
            Vault:{" "}
            <span className="font-mono text-neutral-400">
              {shortenAddress(p.vault_address)}
            </span>
          </span>
          <span>Cap: {fmtBtc(BigInt(p.coverage_cap))} BTC-LST</span>
        </div>
        <Link
          href={`/app/lp/${p._id}`}
          className="btn-primary text-xs px-4 py-2 text-white rounded-lg font-medium"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LPPage() {
  const { status } = useAccount();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "connected") return;
    fetch("/api/protocols")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setProtocols(data); })
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
            <div key={i} className="gradient-border rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-11 h-11 rounded-full skeleton" />
                <div className="space-y-2">
                  <div className="h-5 w-40 skeleton rounded" />
                  <div className="h-3 w-28 skeleton rounded" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-14 skeleton rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : protocols.length === 0 ? (
        <p className="text-neutral-500">No active insurance pools.</p>
      ) : (
        <div className="space-y-4">
          {protocols.map((p) => (
            <VaultCard key={p._id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
