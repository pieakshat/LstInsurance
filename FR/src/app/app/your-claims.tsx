"use client";

import { useState, useEffect } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Protocol } from "@/lib/types";
import { formatWei } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

function parseU256RPC(felts: string[], offset = 0): bigint {
  return (BigInt(felts[offset + 1] ?? "0") << SHIFT_128) | BigInt(felts[offset] ?? "0");
}

// ClaimData felt layout from get_claim:
// 0-1: claim_id (u256)
// 2:   claimant (felt252/address)
// 3-4: token_id (u256)
// 5-6: protocol_id (u256)
// 7-8: coverage_amount (u256)
// 9:   status (felt252: 0=pending 1=approved 2=rejected)
// 10:  submitted_at (u64)
// 11:  resolved_at (u64)

type ClaimStatus = "pending" | "approved" | "rejected";

interface ClaimRow {
  claim_id: number;
  token_id: number;
  protocol_name: string;
  logo_url: string;
  coverage_amount: string;
  status: ClaimStatus;
  submitted_at: number;
  resolved_at: number | null;
  claims_manager: string;
}

function statusFromFelt(s: string): ClaimStatus {
  const n = Number(BigInt(s));
  if (n === 1) return "approved";
  if (n === 2) return "rejected";
  return "pending";
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusDescription(status: ClaimStatus): string {
  switch (status) {
    case "pending": return "Your claim is pending review by the protocol governor. This may take a few days.";
    case "approved": return "Your claim has been approved. The payout has been issued from the vault in BTC-LST.";
    case "rejected": return "Your claim was not approved. The coverage NFT remains valid if it has not expired.";
  }
}

const STATUS_STYLES: Record<ClaimStatus, { bg: string; text: string; label: string; dot: string }> = {
  pending:  { bg: "bg-[#60A5FA]/10", text: "text-[#60A5FA]", label: "Pending",  dot: "#60A5FA" },
  approved: { bg: "bg-[#34D399]/10", text: "text-[#34D399]", label: "Approved", dot: "#34D399" },
  rejected: { bg: "bg-red-500/10",   text: "text-red-400",   label: "Rejected", dot: "#f87171" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YourClaims() {
  const { address } = useAccount();
  const { provider } = useProvider();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !provider) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch("/api/protocols");
        const protocols: Protocol[] = res.ok ? await res.json() : [];

        const managed = protocols.filter(
          (p) => p.claims_manager_address && p.claims_manager_address !== "0x0"
        );

        const rows: ClaimRow[] = [];

        await Promise.all(
          managed.map(async (p) => {
            try {
              // get next_claim_id (u256 → 2 felts)
              const nextFelts = await provider.callContract({
                contractAddress: p.claims_manager_address,
                entrypoint: "next_claim_id",
                calldata: [],
              }, "latest");
              const nextId = Number(parseU256RPC(nextFelts, 0));
              if (nextId <= 1) return; // no claims yet (starts at 1)

              // iterate claim IDs 1..nextId-1
              await Promise.all(
                Array.from({ length: nextId - 1 }, (_, i) => i + 1).map(async (claimId) => {
                  try {
                    const felts = await provider.callContract({
                      contractAddress: p.claims_manager_address,
                      entrypoint: "get_claim",
                      calldata: [String(claimId), "0"],
                    }, "latest");

                    const claimant = BigInt(felts[2]);
                    if (claimant !== BigInt(address!)) return;

                    const tokenId = Number(parseU256RPC(felts, 3));
                    const coverageAmount = String(parseU256RPC(felts, 7));
                    const status = statusFromFelt(felts[9]);
                    const submittedAt = Number(BigInt(felts[10]));
                    const resolvedAtRaw = Number(BigInt(felts[11]));

                    rows.push({
                      claim_id: claimId,
                      token_id: tokenId,
                      protocol_name: p.protocol_name,
                      logo_url: p.logo_url,
                      coverage_amount: coverageAmount,
                      status,
                      submitted_at: submittedAt,
                      resolved_at: resolvedAtRaw > 0 ? resolvedAtRaw : null,
                      claims_manager: p.claims_manager_address,
                    });
                  } catch {
                    // claim doesn't exist or fetch failed — skip
                  }
                })
              );
            } catch (err) {
              console.error("Claims fetch failed for", p.claims_manager_address, err);
            }
          })
        );

        if (!cancelled) {
          rows.sort((a, b) => b.submitted_at - a.submitted_at);
          setClaims(rows);
        }
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
          <div key={i} className="gradient-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full skeleton" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-20 skeleton rounded" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => <div key={j} className="h-10 skeleton rounded" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No claims filed</p>
        <p className="text-sm text-neutral-600">
          If you experience a loss event, file a claim from your active coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const style = STATUS_STYLES[claim.status];
        const isExpanded = expandedId === claim.claim_id;

        return (
          <div key={`${claim.claims_manager}-${claim.claim_id}`} className="gradient-border rounded-xl transition-all duration-200">
            <button
              onClick={() => setExpandedId(isExpanded ? null : claim.claim_id)}
              className="w-full text-left p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {claim.logo_url
                    ? <img src={claim.logo_url} alt={claim.protocol_name} className="w-9 h-9 rounded-full bg-white/5" />
                    : <div className="w-9 h-9 rounded-full bg-white/5" />}
                  <div>
                    <p className="font-medium text-sm">{claim.protocol_name}</p>
                    <p className="text-xs text-neutral-500">
                      Claim #{claim.claim_id} &middot; Token #{claim.token_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <svg
                    className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Coverage Amount</p>
                  <p className="font-medium">{formatWei(claim.coverage_amount)} BTC-LST</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
                  <p className="font-medium">{formatDate(claim.submitted_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Resolved</p>
                  <p className="font-medium">{claim.resolved_at ? formatDate(claim.resolved_at) : "—"}</p>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 pt-0">
                <div className="border-t border-white/5 pt-4">
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 mb-2">Status Timeline</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium">Submitted</p>
                          <p className="text-xs text-neutral-500">{formatDateTime(claim.submitted_at)}</p>
                        </div>
                      </div>
                      {claim.resolved_at && (
                        <div className="flex items-start gap-3">
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: style.dot }}
                          />
                          <div>
                            <p className="text-xs font-medium" style={{ color: style.dot }}>
                              {claim.status === "approved" ? "Approved" : "Rejected"}
                            </p>
                            <p className="text-xs text-neutral-500">{formatDateTime(claim.resolved_at)}</p>
                          </div>
                        </div>
                      )}
                      {claim.status === "pending" && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] mt-1.5 shrink-0 animate-pulse" />
                          <div>
                            <p className="text-xs font-medium text-[#60A5FA]">Under Review</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mb-4">{statusDescription(claim.status)}</p>
                  <a
                    href={`https://sepolia.voyager.online/contract/${claim.claims_manager}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs px-4 py-2 border border-white/10 rounded-lg text-neutral-400 hover:text-white hover:border-white/20 transition-all"
                  >
                    View ClaimsManager &nearr;
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
