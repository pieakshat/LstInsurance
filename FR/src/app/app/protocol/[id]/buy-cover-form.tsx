"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import type { Protocol } from "@/lib/types";
import { DURATION_OPTIONS } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import { useToast } from "../../toast";
import { useBuyCoverage } from "@/lib/hooks/use-buy-coverage";

export function BuyCoverForm({ protocol }: { protocol: Protocol }) {
  const { toast } = useToast();
  const { status: accountStatus } = useAccount();
  const [coverageAmount, setCoverageAmount] = useState("");
  const [duration, setDuration] = useState(DURATION_OPTIONS[2].value); // default 90 days

  const amountNum = parseFloat(coverageAmount) || 0;
  const coverageAmountWei = BigInt(Math.floor(amountNum * 1e18));

  const {
    execute,
    status,
    premiumWei,
    isPreviewLoading,
    balanceWei,
    availableLiquidityWei,
    hasEnoughLiquidity,
    reset,
  } = useBuyCoverage({
    premiumModuleAddress: protocol.premium_module_address,
    vaultAddress: protocol.vault_address,
    coverageAmountWei,
    durationSecs: duration,
  });

  const ratePercent = (protocol.premium_rate / 100).toFixed(1);

  const premiumHuman =
    premiumWei > 0n
      ? (Number(premiumWei) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
      : null;

  // USDC typically uses 6 decimals on mainnet but our MockUSDC uses 18 — keep 18 here
  const balanceHuman = (Number(balanceWei) / 1e18).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });

  const isBusy = status === "pending" || status === "confirming";
  const isDone = status === "done";

  function handleBuy() {
    if (accountStatus !== "connected") {
      toast("Connect your wallet first", "error");
      return;
    }
    if (amountNum <= 0) {
      toast("Please enter a coverage amount", "error");
      return;
    }
    if (!hasEnoughLiquidity && coverageAmountWei > 0n) {
      toast("Not enough liquidity in the vault — LPs must deposit first", "error");
      return;
    }
    if (premiumWei <= 0n && !isPreviewLoading) {
      toast("Could not fetch premium cost — try again", "error");
      return;
    }
    execute();
  }

  const buttonLabel =
    status === "pending"
      ? "Sign in wallet..."
      : status === "confirming"
        ? "Confirming..."
        : status === "done"
          ? "Purchased!"
          : status === "error"
            ? "Try Again"
            : "Buy Cover";

  return (
    <div className="gradient-border rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4">Buy Cover</h2>

      {/* Coverage Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-neutral-400">Coverage Amount</label>
          <span className="text-xs text-neutral-500">Bal: {balanceHuman} USDC</span>
        </div>
        <div className="flex items-center bg-[#0f1117] border border-white/8 rounded-lg overflow-hidden focus-within:border-[#E8704A]/50 transition-colors">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={coverageAmount}
            onChange={(e) => {
              setCoverageAmount(e.target.value);
              if (status === "done" || status === "error") reset();
            }}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="px-3 text-xs text-neutral-400 border-l border-white/8">
            BTC-LST
          </span>
        </div>
      </div>

      {/* Duration Selector */}
      <div className="mb-4">
        <label className="text-xs text-neutral-400 mb-1.5 block">Duration</label>
        <div className="grid grid-cols-4 gap-1.5">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              className={`py-1.5 text-xs rounded-lg border transition-all ${
                duration === opt.value
                  ? "border-[#E8704A]/60 text-white bg-[#E8704A]/10"
                  : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div className="bg-[#0f1117] rounded-xl p-3 mb-4 space-y-2 border border-white/6">
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Coverage</span>
          <span>{amountNum > 0 ? `${amountNum} BTC-LST` : "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Period</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Premium Rate</span>
          <span>{ratePercent}%</span>
        </div>
        <div className="border-t border-white/5 pt-2 flex justify-between text-xs font-medium">
          <span className="text-neutral-400">Premium Cost</span>
          <span className="text-white">
            {isPreviewLoading && amountNum > 0
              ? "Loading..."
              : premiumHuman
                ? `${premiumHuman} USDC`
                : "—"}
          </span>
        </div>
      </div>

      {/* Vault liquidity warning */}
      {coverageAmountWei > 0n && !hasEnoughLiquidity && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          Vault has insufficient liquidity for this coverage amount. LPs must deposit BTC-LST into the vault first.{" "}
          <span className="text-amber-500">
            Available: {(Number(availableLiquidityWei) / 1e18).toFixed(4)} BTC-LST
          </span>
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={isBusy || isDone || (coverageAmountWei > 0n && !hasEnoughLiquidity)}
        className="btn-primary w-full py-2.5 text-sm font-medium text-white rounded-lg"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
