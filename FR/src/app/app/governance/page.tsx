"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { useTxStep } from "@/lib/hooks/use-tx-step";
import { formatWei, shortenAddress } from "@/lib/utils";
import type { Protocol } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

function parseU256RPC(felts: string[], offset = 0): bigint {
  return (BigInt(felts[offset + 1] ?? "0") << SHIFT_128) | BigInt(felts[offset] ?? "0");
}

// claim_id as u256 calldata [low, high]
function claimIdCalldata(id: number): [string, string] {
  const n = BigInt(id);
  return [String(n & U128_MASK), String(n >> SHIFT_128)];
}

type ClaimStatus = "pending" | "approved" | "rejected";

function statusFromFelt(s: string): ClaimStatus {
  const n = Number(BigInt(s));
  if (n === 1) return "approved";
  if (n === 2) return "rejected";
  return "pending";
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaimRow {
  claim_id: number;
  claimant: string;
  token_id: number;
  protocol_id: number;
  protocol_name: string;
  logo_url: string;
  coverage_amount: string;
  status: ClaimStatus;
  submitted_at: number;
  resolved_at: number | null;
  claims_manager: string;
}

type FilterTab = "pending" | "approved" | "rejected" | "all";

// ---------------------------------------------------------------------------
// Status styles
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ClaimStatus, { bg: string; text: string; label: string }> = {
  pending:  { bg: "bg-[#60A5FA]/10", text: "text-[#60A5FA]", label: "Pending"  },
  approved: { bg: "bg-[#34D399]/10", text: "text-[#34D399]", label: "Approved" },
  rejected: { bg: "bg-red-500/10",   text: "text-red-400",   label: "Rejected" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GovernancePage() {
  const { address, status } = useAccount();
  const { provider } = useProvider();

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGovernor, setIsGovernor] = useState(false);
  const [governorChecked, setGovernorChecked] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-claim tx state — track which claim_id is being actioned
  const [actioningKey, setActioningKey] = useState<string | null>(null);
  const claimTx = useTxStep();

  // ── Load all claims across all protocols ─────────────────────────────────

  const loadClaims = useCallback(async () => {
    if (!provider) return;
    setLoading(true);

    try {
      const res = await fetch("/api/protocols");
      const protocols: Protocol[] = res.ok ? await res.json() : [];

      const managed = protocols.filter(
        (p) => p.claims_manager_address && p.claims_manager_address !== "0x0"
      );

      // Check governor role on all ClaimsManagers
      let govOnAny = false;
      if (address) {
        await Promise.all(
          managed.map(async (p) => {
            try {
              const felts = await provider.callContract({
                contractAddress: p.claims_manager_address,
                entrypoint: "is_governor",
                calldata: [address],
              }, "latest");
              // returns felt252 enum: 0 = False, 1 = True
              if (felts[0] === "1" || felts[0] === "0x1") govOnAny = true;
            } catch { /* not deployed yet */ }
          })
        );
      }
      setIsGovernor(govOnAny);
      setGovernorChecked(true);

      // Fetch all claims from all managers
      const rows: ClaimRow[] = [];

      await Promise.all(
        managed.map(async (p) => {
          try {
            const nextFelts = await provider.callContract({
              contractAddress: p.claims_manager_address,
              entrypoint: "next_claim_id",
              calldata: [],
            }, "latest");
            const nextId = Number(parseU256RPC(nextFelts, 0));
            if (nextId <= 1) return; // no claims yet

            await Promise.all(
              Array.from({ length: nextId - 1 }, (_, i) => i + 1).map(async (claimId) => {
                try {
                  const [low, high] = claimIdCalldata(claimId);
                  const felts = await provider.callContract({
                    contractAddress: p.claims_manager_address,
                    entrypoint: "get_claim",
                    calldata: [low, high],
                  }, "latest");

                  // felt layout: claim_id(2) claimant(1) token_id(2) protocol_id(2) coverage_amount(2) status(1) submitted_at(1) resolved_at(1)
                  const claimant = `0x${BigInt(felts[2]).toString(16)}`;
                  const tokenId = Number(parseU256RPC(felts, 3));
                  const coverageAmount = String(parseU256RPC(felts, 7));
                  const claimStatus = statusFromFelt(felts[9]);
                  const submittedAt = Number(BigInt(felts[10]));
                  const resolvedAtRaw = Number(BigInt(felts[11]));

                  rows.push({
                    claim_id: claimId,
                    claimant,
                    token_id: tokenId,
                    protocol_id: p.protocol_id,
                    protocol_name: p.protocol_name,
                    logo_url: p.logo_url,
                    coverage_amount: coverageAmount,
                    status: claimStatus,
                    submitted_at: submittedAt,
                    resolved_at: resolvedAtRaw > 0 ? resolvedAtRaw : null,
                    claims_manager: p.claims_manager_address,
                  });
                } catch { /* skip */ }
              })
            );
          } catch { /* skip */ }
        })
      );

      rows.sort((a, b) => {
        // Pending first, then by submitted_at desc
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return b.submitted_at - a.submitted_at;
      });

      setClaims(rows);
    } finally {
      setLoading(false);
    }
  }, [address, provider]);

  useEffect(() => {
    if (status !== "connected") return;
    loadClaims();
  }, [status, loadClaims]);

  // Refetch after a tx confirms
  useEffect(() => {
    if (claimTx.status === "done") {
      setActioningKey(null);
      claimTx.reset();
      // Small delay for RPC to index
      setTimeout(loadClaims, 1800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimTx.status]);

  // ── Tx handlers ───────────────────────────────────────────────────────────

  function handleApprove(claim: ClaimRow) {
    const key = `${claim.claims_manager}-${claim.claim_id}`;
    setActioningKey(key);
    const [low, high] = claimIdCalldata(claim.claim_id);
    claimTx.execute([{
      contractAddress: claim.claims_manager,
      entrypoint: "approve_claim",
      calldata: [low, high],
    }]);
  }

  function handleReject(claim: ClaimRow) {
    const key = `${claim.claims_manager}-${claim.claim_id}`;
    setActioningKey(key);
    const [low, high] = claimIdCalldata(claim.claim_id);
    claimTx.execute([{
      contractAddress: claim.claims_manager,
      entrypoint: "reject_claim",
      calldata: [low, high],
    }]);
  }

  // ── Filtered view ─────────────────────────────────────────────────────────

  const filtered = claims.filter((c) => filter === "all" || c.status === filter);

  const counts = {
    all: claims.length,
    pending: claims.filter((c) => c.status === "pending").length,
    approved: claims.filter((c) => c.status === "approved").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
  };

  // ── Not connected ─────────────────────────────────────────────────────────

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to access governance</p>
      </div>
    );
  }

  // ── Not a governor ────────────────────────────────────────────────────────

  if (governorChecked && !isGovernor) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/20">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-neutral-400 mb-1">
          Your wallet does not have <code className="text-neutral-300">GOVERNOR_ROLE</code> on any ClaimsManager.
        </p>
        <p className="text-xs text-neutral-600 mt-2 font-mono break-all">{address}</p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-7 w-48 skeleton rounded mb-2" />
        <div className="h-4 w-72 skeleton rounded mb-8" />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-24 skeleton rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="gradient-border rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-40 skeleton rounded" />
                  <div className="h-3 w-24 skeleton rounded" />
                </div>
                <div className="h-6 w-20 skeleton rounded-full" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((j) => <div key={j} className="h-10 skeleton rounded" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">Claims Review</h2>
          <p className="text-neutral-400 text-sm">
            Review, approve or reject insurance claims as a protocol governor.
          </p>
        </div>
        <button
          onClick={loadClaims}
          className="text-xs px-3 py-1.5 border border-white/10 rounded-lg text-neutral-400 hover:text-white hover:border-white/20 transition-all shrink-0"
        >
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(["all", "pending", "approved", "rejected"] as const).map((key) => (
          <div key={key} className="bg-[#0f1117] rounded-xl p-4">
            <p className="text-xs text-neutral-500 mb-1 capitalize">{key === "all" ? "Total" : key}</p>
            <p className={`text-2xl font-bold ${
              key === "pending"  ? "text-[#60A5FA]" :
              key === "approved" ? "text-[#34D399]" :
              key === "rejected" ? "text-red-400"   : "text-white"
            }`}>
              {counts[key]}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-white/3 rounded-xl p-1 w-fit">
        {(["pending", "all", "approved", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all capitalize ${
              filter === tab
                ? "bg-white/10 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab === "all" ? "All" : tab}
            {counts[tab] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === tab ? "bg-white/10" : "bg-white/5"
              }`}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 gradient-border rounded-xl">
          <p className="text-neutral-500 mb-1">
            {filter === "pending" ? "No pending claims" : `No ${filter} claims`}
          </p>
          <p className="text-xs text-neutral-600">
            {filter === "pending" ? "All claims have been reviewed." : "Nothing to show here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => {
            const style = STATUS_STYLES[claim.status];
            const key = `${claim.claims_manager}-${claim.claim_id}`;
            const isExpanded = expandedId === key;
            const isThisActioning = actioningKey === key;
            const txBusy = claimTx.status === "pending" || claimTx.status === "confirming";

            return (
              <div key={key} className="gradient-border rounded-xl overflow-hidden transition-all duration-200">
                {/* Clickable header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {claim.logo_url
                        ? <img src={claim.logo_url} alt={claim.protocol_name} className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />}
                      <div>
                        <p className="font-semibold text-sm">{claim.protocol_name}</p>
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
                        className={`w-4 h-4 text-neutral-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Coverage</p>
                      <p className="font-medium">{formatWei(claim.coverage_amount)} BTC-LST</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Claimant</p>
                      <p className="font-medium font-mono">{shortenAddress(claim.claimant)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
                      <p className="font-medium">{formatDateTime(claim.submitted_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">Resolved</p>
                      <p className="font-medium">{claim.resolved_at ? formatDateTime(claim.resolved_at) : "—"}</p>
                    </div>
                  </div>
                </button>

                {/* Expanded details + actions */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="border-t border-white/5 pt-4 space-y-4">
                      {/* Full claimant address */}
                      <div className="bg-[#0f1117] rounded-lg p-3 text-xs">
                        <p className="text-neutral-500 mb-1">Claimant address</p>
                        <p className="font-mono text-neutral-300 break-all">{claim.claimant}</p>
                      </div>

                      {/* ClaimsManager address */}
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          ClaimsManager:{" "}
                          <span className="font-mono text-neutral-400">{shortenAddress(claim.claims_manager)}</span>
                        </span>
                        <a
                          href={`https://sepolia.voyager.online/contract/${claim.claims_manager}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white transition-colors"
                        >
                          View on Explorer &nearr;
                        </a>
                      </div>

                      {/* Action buttons — only for pending */}
                      {claim.status === "pending" && (
                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleApprove(claim)}
                            disabled={txBusy}
                            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/20 hover:bg-[#34D399]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isThisActioning && claimTx.status === "pending"
                              ? "Signing..."
                              : isThisActioning && claimTx.status === "confirming"
                              ? "Confirming..."
                              : "Approve — Pay Out"}
                          </button>
                          <button
                            onClick={() => handleReject(claim)}
                            disabled={txBusy}
                            className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isThisActioning && claimTx.status === "pending"
                              ? "Signing..."
                              : isThisActioning && claimTx.status === "confirming"
                              ? "Confirming..."
                              : "Reject"}
                          </button>
                        </div>
                      )}

                      {isThisActioning && claimTx.status === "error" && (
                        <p className="text-xs text-red-400">Transaction failed. Check console for details.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
