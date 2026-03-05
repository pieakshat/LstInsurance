"use client";

import { Suspense, useEffect, useState } from "react";
import { useAccount, useProvider, useReadContract } from "@starknet-react/core";
import { useSearchParams } from "next/navigation";
import type { Abi } from "starknet";
import { useTxStep } from "@/lib/hooks/use-tx-step";
import { CONTRACTS } from "@/lib/contracts";
import { COVERAGE_TOKEN_ABI } from "@/lib/abis/coverage-token";
import type { Protocol } from "@/lib/types";
import { formatWei, formatDuration } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers (same as YourCovers)
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

function parseU256RPC(felts: string[], offset = 0): bigint {
  return (BigInt(felts[offset + 1] ?? "0") << SHIFT_128) | BigInt(felts[offset] ?? "0");
}

function formatExpiry(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoverItem {
  token_id: number;
  protocol_id: number;
  protocol_name: string;
  logo_url: string;
  coverage_amount: string;
  start_time: number;
  end_time: number;
  premium_paid: string;
  claims_manager: string;
}

// ---------------------------------------------------------------------------
// Page wrapper
// ---------------------------------------------------------------------------

export default function SubmitClaimPage() {
  return (
    <Suspense>
      <SubmitClaimInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function SubmitClaimInner() {
  const { address, status } = useAccount();
  const { provider } = useProvider();
  const searchParams = useSearchParams();
  const submitTx = useTxStep();

  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [selectedCover, setSelectedCover] = useState<CoverItem | null>(null);

  // ── Fetch all token IDs (same hook as YourCovers) ────────────────────────
  const { data: tokenIdsRaw, isLoading: idsLoading } = useReadContract({
    abi: COVERAGE_TOKEN_ABI as Abi,
    address: CONTRACTS.coverageToken as `0x${string}`,
    functionName: "get_tokens_of",
    args: [address],
    enabled: !!address,
  });

  // ── Fetch full coverage details for each token (same pattern as YourCovers)
  const [covers, setCovers] = useState<CoverItem[]>([]);
  const [coverLoading, setCoverLoading] = useState(false);

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

        const items = await Promise.all(
          tokenIds.map(async (tokenId): Promise<CoverItem | null> => {
            try {
              const felts = await provider.callContract({
                contractAddress: CONTRACTS.coverageToken,
                entrypoint: "get_coverage",
                calldata: [String(tokenId & U128_MASK), String(tokenId >> SHIFT_128)],
              }, "latest");

              const protocolId = Number(parseU256RPC(felts, 0));
              const protocol = protocolMap.get(protocolId);
              const cm = protocol?.claims_manager_address ?? "";

              return {
                token_id: Number(tokenId),
                protocol_id: protocolId,
                protocol_name: protocol?.protocol_name ?? `Protocol #${protocolId}`,
                logo_url: protocol?.logo_url ?? "",
                coverage_amount: String(parseU256RPC(felts, 2)),
                start_time: Number(BigInt(felts[4])),
                end_time: Number(BigInt(felts[5])),
                premium_paid: String(parseU256RPC(felts, 6)),
                claims_manager: cm,
              };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          const valid = items.filter((c): c is CoverItem => c !== null);
          setCovers(valid);

          // Auto-select from ?tokenId= query param
          const paramId = searchParams.get("tokenId");
          if (paramId) {
            const match = valid.find((c) => String(c.token_id) === paramId);
            if (match) setSelectedCover(match);
          }
        }
      } finally {
        if (!cancelled) setCoverLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIdsRaw, provider]);

  // ── Submit handler ────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCover || !selectedCover.claims_manager || selectedCover.claims_manager === "0x0") return;
    const id = BigInt(selectedCover.token_id);
    const [idLow, idHigh] = [String(id & U128_MASK), String(id >> SHIFT_128)];
    submitTx.execute([{
      contractAddress: selectedCover.claims_manager,
      entrypoint: "submit_claim",
      calldata: [idLow, idHigh],
    }]);
  }

  // ── Not connected ─────────────────────────────────────────────────────────

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to get started</p>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitTx.status === "done") {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-[#34D399]/10 flex items-center justify-center mx-auto mb-5 border border-[#34D399]/20">
          <svg className="w-7 h-7 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Claim Submitted</h2>
        <p className="text-sm text-neutral-400 mb-2">
          Your claim for Token #{selectedCover?.token_id} has been submitted on-chain and is pending review.
        </p>
        {submitTx.txHash && (
          <a
            href={`https://sepolia.voyager.online/tx/${submitTx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-300 font-mono block mb-6 transition-colors"
          >
            {submitTx.txHash.slice(0, 14)}...{submitTx.txHash.slice(-8)} &nearr;
          </a>
        )}
        <p className="text-xs text-neutral-600 mb-6">
          Track its status in the &quot;Your Claims&quot; tab on the dashboard.
        </p>
        <a
          href="/app"
          className="btn-primary inline-block text-sm px-6 py-2.5 text-white rounded-lg font-medium"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const isExpired = selectedCover
    ? Math.floor(Date.now() / 1000) >= selectedCover.end_time
    : false;
  const hasValidCm = !!selectedCover?.claims_manager && selectedCover.claims_manager !== "0x0";
  const canSubmit = !!selectedCover && !isExpired && hasValidCm && submitTx.status === "idle";

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const loading = idsLoading || coverLoading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Submit a Claim</h2>
      <p className="text-neutral-400 mb-8">
        File a claim against your coverage. Select a cover below — the on-chain transaction proves ownership and initiates governor review.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Cover selector */}
        <div>
          <p className="text-sm text-neutral-400 mb-3">
            Select a cover <span className="text-red-400">*</span>
          </p>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="gradient-border rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full skeleton" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-32 skeleton rounded" />
                      <div className="h-3 w-20 skeleton rounded" />
                    </div>
                    <div className="h-8 w-20 skeleton rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : covers.length === 0 ? (
            <div className="gradient-border rounded-xl p-6 text-center">
              <p className="text-sm text-neutral-500 mb-1">No coverage NFTs found</p>
              <p className="text-xs text-neutral-600">
                Purchase cover from the Buy Cover tab first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {covers.map((cover) => {
                const active = Math.floor(Date.now() / 1000) < cover.end_time;
                const isSelected = selectedCover?.token_id === cover.token_id;

                return (
                  <button
                    key={cover.token_id}
                    type="button"
                    onClick={() => setSelectedCover(isSelected ? null : cover)}
                    disabled={!active}
                    className={`w-full text-left rounded-xl p-4 border transition-all duration-150 ${
                      isSelected
                        ? "border-[#E8704A]/60 bg-[#E8704A]/5"
                        : active
                        ? "border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/4"
                        : "border-white/5 bg-white/1 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Selection indicator */}
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? "border-[#E8704A] bg-[#E8704A]" : "border-white/20"
                        }`}>
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="2" />
                            </svg>
                          )}
                        </div>

                        {cover.logo_url
                          ? <img src={cover.logo_url} alt={cover.protocol_name} className="w-9 h-9 rounded-full bg-white/5" />
                          : <div className="w-9 h-9 rounded-full bg-white/5" />}
                        <div>
                          <p className="text-sm font-medium">{cover.protocol_name}</p>
                          <p className="text-xs text-neutral-500">Token #{cover.token_id}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium">{formatWei(cover.coverage_amount)} BTC-LST</p>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            active
                              ? "bg-[#E8704A]/12 text-[#E8704A]"
                              : "bg-white/5 text-neutral-500"
                          }`}>
                            {active ? "Active" : "Expired"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Inline details when selected */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-white/8 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-neutral-500 mb-0.5">Coverage</p>
                          <p className="font-medium">{formatWei(cover.coverage_amount)} BTC-LST</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-0.5">Duration</p>
                          <p className="font-medium">{formatDuration(cover.end_time - cover.start_time)}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500 mb-0.5">Expires</p>
                          <p className="font-medium">{formatExpiry(cover.end_time)}</p>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Warning if ClaimsManager not set */}
        {selectedCover && !hasValidCm && (
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
            <p className="text-sm text-amber-400">ClaimsManager not deployed for this protocol yet. Claims cannot be filed.</p>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Description of Loss Event
            <span className="text-neutral-600 ml-1">(for your records)</span>
          </label>
          <textarea
            rows={4}
            placeholder="Describe what happened, the nature of the exploit, and the amount lost..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#0f1117] border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#E8704A]/50 transition-colors resize-none"
          />
        </div>

        {/* Evidence link */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Evidence / Post-Mortem Link
            <span className="text-neutral-600 ml-1">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="https://..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            className="w-full bg-[#0f1117] border border-white/8 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#E8704A]/50 transition-colors"
          />
        </div>

        {/* Summary */}
        <div className="gradient-border rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Wallet</span>
            <span className="font-mono">{shortAddr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Token ID</span>
            <span>{selectedCover ? `#${selectedCover.token_id}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Coverage</span>
            <span>{selectedCover ? `${formatWei(selectedCover.coverage_amount)} BTC-LST` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Action</span>
            <span className="text-neutral-300">On-chain transaction (requires gas)</span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || submitTx.status === "pending" || submitTx.status === "confirming"}
          className="btn-primary w-full py-3 text-sm font-medium text-white rounded-lg"
        >
          {submitTx.status === "pending"
            ? "Sign in wallet..."
            : submitTx.status === "confirming"
              ? "Confirming..."
              : "Submit Claim"}
        </button>

        {submitTx.status === "error" && (
          <p className="text-xs text-red-400 text-center">Transaction failed. Check the console for details.</p>
        )}
      </form>
    </div>
  );
}
