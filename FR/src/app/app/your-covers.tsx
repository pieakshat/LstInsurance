"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount, useProvider, useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";
import type { CoveragePosition, Protocol } from "@/lib/types";
import { formatWei, formatDuration } from "@/lib/utils";
import { COVERAGE_TOKEN_ABI } from "@/lib/abis/coverage-token";
import { CONTRACTS } from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

// For useReadContract results (bigint | {low,high} | string)
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

// For provider.callContract results (raw felt strings — u256 = [low, high])
function parseU256RPC(felts: string[], offset = 0): bigint {
  const low = BigInt(felts[offset] ?? "0");
  const high = BigInt(felts[offset + 1] ?? "0");
  return (high << SHIFT_128) | low;
}

function getStatus(cover: CoveragePosition): "active" | "expired" {
  return Math.floor(Date.now() / 1000) < cover.end_time ? "active" : "expired";
}

function timeRemaining(endTime: number): string {
  const diff = endTime - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Expired";
  return `${formatDuration(diff)} left`;
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YourCovers() {
  const { address } = useAccount();
  const { provider } = useProvider();
  const [covers, setCovers] = useState<CoveragePosition[]>([]);
  const [coverLoading, setCoverLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Single contract call — returns all token IDs owned by this address
  const { data: tokenIdsRaw, isLoading: idsLoading } = useReadContract({
    abi: COVERAGE_TOKEN_ABI as Abi,
    address: CONTRACTS.coverageToken as `0x${string}`,
    functionName: "get_tokens_of",
    args: [address],
    enabled: !!address,
  });

  // Whenever the token ID list changes, fetch full coverage data for each token
  useEffect(() => {
    if (!tokenIdsRaw || !provider) return;

    const tokenIds = (tokenIdsRaw as unknown[]).map((id) => parseU256(id));
    if (tokenIds.length === 0) { setCovers([]); return; }

    let cancelled = false;
    setCoverLoading(true);

    async function load() {
      try {
        const protocolsRes = await fetch("/api/protocols");
        const protocols: Protocol[] = protocolsRes.ok ? await protocolsRes.json() : [];
        const protocolMap = new Map(protocols.map((p) => [p.protocol_id, p]));

        const positions = await Promise.all(
          tokenIds.map(async (tokenId): Promise<CoveragePosition | null> => {
            try {
              // Encode tokenId as u256 calldata [low, high]
              const felts = await provider.callContract({
                contractAddress: CONTRACTS.coverageToken,
                entrypoint: "get_coverage",
                calldata: [String(tokenId & U128_MASK), String(tokenId >> SHIFT_128)],
              }, "latest");
              // CoveragePosition layout: protocol_id(2) coverage_amount(2) start_time(1) end_time(1) premium_paid(2)
              const protocolId = Number(parseU256RPC(felts, 0));
              const protocol = protocolMap.get(protocolId);
              return {
                token_id: Number(tokenId),
                protocol_id: protocolId,
                protocol_name: protocol?.protocol_name ?? `Protocol #${protocolId}`,
                logo_url: protocol?.logo_url ?? "",
                coverage_amount: String(parseU256RPC(felts, 2)),
                start_time: Number(BigInt(felts[4])),
                end_time: Number(BigInt(felts[5])),
                premium_paid: String(parseU256RPC(felts, 6)),
              };
            } catch (err) {
              console.error("get_coverage failed for token", tokenId, err);
              return null;
            }
          }),
        );

        if (!cancelled) setCovers(positions.filter((p): p is CoveragePosition => p !== null));
      } finally {
        if (!cancelled) setCoverLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenIdsRaw, provider]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (idsLoading || coverLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="gradient-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full skeleton" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-20 skeleton rounded" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((j) => <div key={j} className="h-10 skeleton rounded" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (covers.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No coverage positions yet</p>
        <p className="text-sm text-neutral-600">Purchase cover from the Buy Cover tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {covers.map((cover) => {
        const status = getStatus(cover);
        const isActive = status === "active";
        const isExpanded = expandedId === cover.token_id;

        return (
          <div
            key={cover.token_id}
            className={`gradient-border rounded-xl transition-all duration-200 ${!isActive ? "opacity-50" : ""}`}
          >
            <button onClick={() => setExpandedId(isExpanded ? null : cover.token_id)} className="w-full text-left p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {cover.logo_url
                    ? <img src={cover.logo_url} alt={cover.protocol_name} className="w-9 h-9 rounded-full bg-white/5" />
                    : <div className="w-9 h-9 rounded-full bg-white/5" />}
                  <div>
                    <p className="font-medium text-sm">{cover.protocol_name}</p>
                    <p className="text-xs text-neutral-500">Token #{cover.token_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isActive ? "bg-[#E8704A]/12 text-[#E8704A]" : "bg-white/5 text-neutral-500"}`}>
                    {isActive ? "Active" : "Expired"}
                  </span>
                  <svg className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Coverage</p>
                  <p className="font-medium">{formatWei(cover.coverage_amount)} BTC-LST</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Premium Paid</p>
                  <p className="font-medium">{formatWei(cover.premium_paid)} USDC</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Duration</p>
                  <p className="font-medium">{formatDuration(cover.end_time - cover.start_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Time Left</p>
                  <p className={`font-medium ${!isActive ? "text-neutral-500" : ""}`}>{timeRemaining(cover.end_time)}</p>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 pt-0">
                <div className="border-t border-white/5 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Start Date</p>
                      <p className="font-medium">{formatDateTime(cover.start_time)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">End Date</p>
                      <p className="font-medium">{formatDateTime(cover.end_time)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Protocol ID</p>
                      <p className="font-medium">{cover.protocol_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isActive && (
                      <Link href={`/app/submit-claim?tokenId=${cover.token_id}`} className="btn-primary text-xs px-4 py-2 text-white rounded-lg font-medium">
                        File a Claim
                      </Link>
                    )}
                    <a href={`https://sepolia.voyager.online/contract/${CONTRACTS.coverageToken}`} target="_blank" rel="noopener noreferrer" className="text-xs px-4 py-2 border border-white/10 rounded-lg text-neutral-400 hover:text-white hover:border-white/20 transition-all">
                      View on Explorer &nearr;
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
