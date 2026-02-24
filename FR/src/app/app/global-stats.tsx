"use client";

import { useState, useEffect } from "react";
import { useProvider } from "@starknet-react/core";
import type { Protocol } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;

// callContract returns raw felt252 strings; u256 is encoded as [low, high]
function parseU256RPC(felts: string[]): bigint {
  if (!felts || felts.length === 0) return 0n;
  const low = BigInt(felts[0]);
  const high = felts.length > 1 ? BigInt(felts[1]) : 0n;
  return (high << SHIFT_128) | low;
}

function fmtBtc(wei: bigint): string {
  if (wei === 0n) return "0";
  const val = Number(wei) / 1e18;
  if (val < 0.0001) return "<0.0001";
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlobalStats() {
  const { provider } = useProvider();
  const [stats, setStats] = useState({
    tvl: 0n,
    locked: 0n,
    payouts: 0n,
    vaultCount: 0,
    loading: true,
  });

  useEffect(() => {
    if (!provider) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/protocols");
        const protocols: Protocol[] = res.ok ? await res.json() : [];

        const vaults = protocols.filter(
          (p) => p.vault_address && p.vault_address !== "0x0"
        );

        let tvl = 0n;
        let locked = 0n;
        let payouts = 0n;

        await Promise.all(
          vaults.map(async (p) => {
            try {
              const [assetsRes, liqRes, payoutRes] = await Promise.all([
                provider.callContract({
                  contractAddress: p.vault_address,
                  entrypoint: "total_assets",
                  calldata: [],
                }, "latest"),
                provider.callContract({
                  contractAddress: p.vault_address,
                  entrypoint: "total_locked_liquidity",
                  calldata: [],
                }, "latest"),
                provider.callContract({
                  contractAddress: p.vault_address,
                  entrypoint: "total_payouts",
                  calldata: [],
                }, "latest"),
              ]);
              // callContract returns string[] of raw felts; u256 = [low, high]
              tvl += parseU256RPC(assetsRes);
              locked += parseU256RPC(liqRes);
              payouts += parseU256RPC(payoutRes);
            } catch (err) {
              console.error("Vault read failed for", p.vault_address, err);
            }
          })
        );

        if (!cancelled) {
          setStats({ tvl, locked, payouts, vaultCount: vaults.length, loading: false });
        }
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [provider]);

  const STATS = [
    {
      label: "Total TVL",
      value: stats.loading ? "—" : `${fmtBtc(stats.tvl)} BTC-LST`,
    },
    {
      label: "Active Coverage",
      value: stats.loading ? "—" : `${fmtBtc(stats.locked)} BTC-LST`,
    },
    {
      label: "Claims Paid",
      value: stats.loading ? "—" : `${fmtBtc(stats.payouts)} BTC-LST`,
    },
    {
      label: "Active Vaults",
      value: stats.loading ? "—" : stats.vaultCount.toString(),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3"
        >
          <p className="text-xs text-neutral-500 mb-0.5">{s.label}</p>
          <p className="text-sm font-semibold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
