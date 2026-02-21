"use client";

import { Suspense } from "react";
import { useAccount } from "@starknet-react/core";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "../toast";

export default function SubmitClaimPage() {
  return (
    <Suspense>
      <SubmitClaimInner />
    </Suspense>
  );
}

function SubmitClaimInner() {
  const { address, status } = useAccount();

  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [tokenId, setTokenId] = useState(searchParams.get("tokenId") ?? "");
  const [txHash, setTxHash] = useState("");
  const [description, setDescription] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to get started</p>
      </div>
    );
  }

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  function handleSign() {
    setSigning(true);
    // Mock signing delay
    setTimeout(() => {
      setSigning(false);
      setSigned(true);
    }, 1500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!tokenId || !txHash || !description) {
      toast("Please fill in all required fields", "error");
      return;
    }
    if (!signed) {
      toast("Please verify wallet ownership first", "error");
      return;
    }

    setSubmitted(true);
    toast("Claim submitted successfully", "success");
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-7 h-7 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Claim Submitted</h2>
        <p className="text-sm text-neutral-400 mb-6">
          Your claim for Token #{tokenId} has been submitted and is pending
          review. You can track its status in the &quot;Your Claims&quot; tab on
          the dashboard.
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

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Submit a Claim</h2>
      <p className="text-neutral-400 mb-8">
        File a claim against your coverage NFT. Provide evidence of the loss
        event for review.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Wallet Verification */}
        <div className="border border-neutral-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Wallet Verification</h3>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">
                Connected Address
              </p>
              <p className="text-sm font-mono">{shortAddr}</p>
            </div>
            {signed ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSign}
                disabled={signing}
                className="text-xs px-4 py-2 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors disabled:opacity-50"
              >
                {signing ? "Signing..." : "Sign to Verify"}
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-600">
            Sign a message to prove you own this wallet. This does not cost gas.
          </p>
        </div>

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
          <p className="text-xs text-neutral-600 mt-1">
            The NFT token ID of your coverage position.
          </p>
        </div>

        {/* Transaction Hash */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Loss Event Transaction Hash <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors font-mono"
          />
          <p className="text-xs text-neutral-600 mt-1">
            The on-chain transaction hash where the loss event occurred.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Description of Loss Event <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={4}
            placeholder="Describe what happened, include relevant details such as the protocol involved, the nature of the exploit, and the amount lost..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
          />
        </div>

        {/* Additional Evidence (optional) */}
        <div>
          <label className="text-sm text-neutral-400 mb-1.5 block">
            Additional Evidence Links{" "}
            <span className="text-neutral-600">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="https://..."
            className="w-full bg-transparent border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
          />
          <p className="text-xs text-neutral-600 mt-1">
            Links to post-mortem reports, explorer pages, or other supporting
            evidence.
          </p>
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
            <span className="text-neutral-500">Tx Hash</span>
            <span className="font-mono">
              {txHash
                ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Wallet Verified</span>
            <span className={signed ? "text-emerald-400" : "text-amber-400"}>
              {signed ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
        >
          Submit Claim
        </button>
      </form>
    </div>
  );
}
