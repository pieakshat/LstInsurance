"use client";

import { Suspense, useEffect, useState } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { useSearchParams } from "next/navigation";
import { useTxStep } from "@/lib/hooks/use-tx-step";
import { CONTRACTS } from "@/lib/contracts";
import type { Protocol } from "@/lib/types";
import { formatWei } from "@/lib/utils";

const SHIFT_128 = 128n;
const U128_MASK = (1n << SHIFT_128) - 1n;

function parseU256RPC(felts: string[], offset = 0): bigint {
  return (BigInt(felts[offset + 1] ?? "0") << SHIFT_128) | BigInt(felts[offset] ?? "0");
}

function formatExpiry(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface CoverDetails {
  protocol_name: string;
  coverage_amount: string;
  end_time: number;
  claims_manager: string;
}

export default function SubmitClaimPage() {
  return (
    <Suspense>
      <SubmitClaimInner />
    </Suspense>
  );
}

function SubmitClaimInner() {
  const { address, status } = useAccount();
  const { provider } = useProvider();
  const searchParams = useSearchParams();
  const submitTx = useTxStep();

  const [tokenId, setTokenId] = useState(searchParams.get("tokenId") ?? "");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const [coverLoading, setCoverLoading] = useState(false);
  const [coverDetails, setCoverDetails] = useState<CoverDetails | null>(null);
  const [coverError, setCoverError] = useState("");

  // Fetch coverage + ClaimsManager whenever tokenId changes
  useEffect(() => {
    const raw = tokenId.trim();
    if (!raw || !provider) return;
    let id: bigint;
    try { id = BigInt(raw); } catch { return; }
    if (id === 0n) return;

    let cancelled = false;
    setCoverLoading(true);
    setCoverDetails(null);
    setCoverError("");

    async function load() {
      try {
        const [idLow, idHigh] = [String(id & U128_MASK), String(id >> SHIFT_128)];
        // get_coverage → protocol_id(2) coverage_amount(2) start_time(1) end_time(1) premium_paid(2)
        const felts = await provider!.callContract({
          contractAddress: CONTRACTS.coverageToken,
          entrypoint: "get_coverage",
          calldata: [idLow, idHigh],
        }, "latest");

        const protocolId = Number(parseU256RPC(felts, 0));
        const coverageAmount = String(parseU256RPC(felts, 2));
        const endTime = Number(BigInt(felts[5]));

        const res = await fetch("/api/protocols");
        const protocols: Protocol[] = res.ok ? await res.json() : [];
        const protocol = protocols.find((p) => p.protocol_id === protocolId);

        if (!protocol) throw new Error(`Protocol #${protocolId} not found in database`);
        const cm = protocol.claims_manager_address;
        if (!cm || cm === "0x0") throw new Error("ClaimsManager not deployed for this protocol yet");

        if (!cancelled) setCoverDetails({
          protocol_name: protocol.protocol_name,
          coverage_amount: coverageAmount,
          end_time: endTime,
          claims_manager: cm,
        });
      } catch (err) {
        if (!cancelled) setCoverError(err instanceof Error ? err.message : "Failed to load coverage details");
      } finally {
        if (!cancelled) setCoverLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tokenId, provider]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coverDetails) return;
    const id = BigInt(tokenId.trim());
    const [idLow, idHigh] = [String(id & U128_MASK), String(id >> SHIFT_128)];
    submitTx.execute([{
      contractAddress: coverDetails.claims_manager,
      entrypoint: "submit_claim",
      calldata: [idLow, idHigh],
    }]);
  }

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to get started</p>
      </div>
    );
  }

  const isExpired = coverDetails && Math.floor(Date.now() / 1000) >= coverDetails.end_time;
  const canSubmit = !!coverDetails && !isExpired && submitTx.status === "idle";

  if (submitTx.status === "done") {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Claim Submitted</h2>
        <p className="text-sm text-neutral-400 mb-2">
          Your claim for Token #{tokenId} has been submitted on-chain and is pending review.
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
          className="inline-block text-sm px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Submit a Claim</h2>
      <p className="text-neutral-400 mb-8">
        File a claim against your coverage NFT. The on-chain transaction proves ownership and initiates governor review.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Coverage Token ID */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Coverage Token ID <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 1"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Cover details card */}
        {coverLoading && (
          <div className="border border-neutral-800 rounded-xl p-4 animate-pulse">
            <div className="h-3 w-32 bg-neutral-800 rounded mb-2" />
            <div className="h-3 w-48 bg-neutral-800 rounded" />
          </div>
        )}
        {coverError && (
          <div className="border border-red-900/40 bg-red-500/5 rounded-xl p-4">
            <p className="text-sm text-red-400">{coverError}</p>
          </div>
        )}
        {coverDetails && (
          <div className={`border rounded-xl p-4 ${isExpired ? "border-red-900/40 bg-red-500/5" : "border-neutral-800 bg-neutral-900/50"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{coverDetails.protocol_name}</p>
              {isExpired
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Expired</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Active</span>
              }
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-neutral-500 mb-0.5">Coverage Amount</p>
                <p className="text-white font-medium">{formatWei(coverDetails.coverage_amount)} BTC-LST</p>
              </div>
              <div>
                <p className="text-neutral-500 mb-0.5">Expiry</p>
                <p className={`font-medium ${isExpired ? "text-red-400" : "text-white"}`}>{formatExpiry(coverDetails.end_time)}</p>
              </div>
            </div>
            {isExpired && (
              <p className="text-xs text-red-400 mt-2">This coverage has expired and cannot be claimed.</p>
            )}
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
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
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
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        {/* Summary */}
        <div className="bg-neutral-900 rounded-lg p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Wallet</span>
            <span className="font-mono">{shortAddr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Token ID</span>
            <span>{tokenId || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Coverage</span>
            <span>{coverDetails ? `${formatWei(coverDetails.coverage_amount)} BTC-LST` : "—"}</span>
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
          className="w-full py-3 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
