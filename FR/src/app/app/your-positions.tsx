"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Protocol } from "@/lib/types";
import { shortenAddress } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

function parseU256RPC(felts: string[], offset = 0): bigint {
  const low = BigInt(felts[offset] ?? "0");
  const high = BigInt(felts[offset + 1] ?? "0");
  return (high << SHIFT_128) | low;
}

function fmtBtc(wei: bigint): string {
  if (wei === 0n) return "0";
  const val = Number(wei) / 1e18;
  if (val < 0.0001) return "<0.0001";
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionRow {
  _id: string;
  protocol_id: number;
  protocol_name: string;
  logo_url: string;
  vault_address: string;
  shares: bigint;
  assetsValue: bigint;
  totalSupply: bigint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YourPositions() {
  const { address } = useAccount();
  const { provider } = useProvider();
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !provider) return;

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch("/api/protocols");
        const protocols: Protocol[] = res.ok ? await res.json() : [];

        const vaults = protocols.filter(
          (p) => p.vault_address && p.vault_address !== "0x0"
        );

        const rows: PositionRow[] = [];

        await Promise.all(
          vaults.map(async (p) => {
            try {
              // balance_of(address) → u256
              const balFelts = await provider.callContract({
                contractAddress: p.vault_address,
                entrypoint: "balance_of",
                calldata: [address!],
              }, "latest");
              const shares = parseU256RPC(balFelts, 0);
              if (shares === 0n) return;

              // preview_redeem(shares) → u256 assets
              const [low, high] = [String(shares & U128_MASK), String(shares >> SHIFT_128)];
              const [redeemFelts, supplyFelts] = await Promise.all([
                provider.callContract({
                  contractAddress: p.vault_address,
                  entrypoint: "preview_redeem",
                  calldata: [low, high],
                }, "latest"),
                provider.callContract({
                  contractAddress: p.vault_address,
                  entrypoint: "total_supply",
                  calldata: [],
                }, "latest"),
              ]);

              rows.push({
                _id: p._id,
                protocol_id: p.protocol_id,
                protocol_name: p.protocol_name,
                logo_url: p.logo_url,
                vault_address: p.vault_address,
                shares,
                assetsValue: parseU256RPC(redeemFelts, 0),
                totalSupply: parseU256RPC(supplyFelts, 0),
              });
            } catch (err) {
              console.error("Position fetch failed for", p.vault_address, err);
            }
          })
        );

        if (!cancelled) setPositions(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [address, provider]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="border border-neutral-800 rounded-xl p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-neutral-800" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-neutral-800 rounded" />
                <div className="h-3 w-20 bg-neutral-800 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((j) => <div key={j} className="h-10 bg-neutral-800 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No LP positions yet</p>
        <p className="text-sm text-neutral-600 mb-4">
          Deposit into a vault to start earning premiums.
        </p>
        <Link
          href="/app/lp"
          className="inline-block text-sm px-5 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
        >
          View Pools
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((pos) => {
        const poolShare = pos.totalSupply > 0n
          ? ((Number(pos.shares) / Number(pos.totalSupply)) * 100).toFixed(2)
          : "0.00";

        return (
          <div key={pos.protocol_id} className="border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {pos.logo_url
                  ? <img src={pos.logo_url} alt={pos.protocol_name} className="w-9 h-9 rounded-full bg-neutral-800" />
                  : <div className="w-9 h-9 rounded-full bg-neutral-800" />}
                <div>
                  <p className="font-medium text-sm">{pos.protocol_name}</p>
                  <p className="text-xs text-neutral-500">
                    Vault: <span className="font-mono">{shortenAddress(pos.vault_address)}</span>
                  </p>
                </div>
              </div>
              <Link
                href={`/app/lp/${pos._id}`}
                className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Manage
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Your Shares</p>
                <p className="font-medium">{fmtBtc(pos.shares)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Current Value</p>
                <p className="font-medium">{fmtBtc(pos.assetsValue)} BTC-LST</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Pool Share</p>
                <p className="font-medium">{poolShare}%</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
