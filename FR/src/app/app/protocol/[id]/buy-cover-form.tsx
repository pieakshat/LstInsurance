"use client";

import { useState } from "react";
import type { Protocol } from "@/lib/types";
import { DURATION_OPTIONS } from "@/lib/constants";
import { calculatePremium, formatDuration } from "@/lib/utils";
import { useToast } from "../../toast";

const MOCK_BTC_LST_PRICE_USD = 60_000;
const MOCK_USDC_BALANCE = "12,500.00";

export function BuyCoverForm({ protocol }: { protocol: Protocol }) {
  const { toast } = useToast();
  const [coverageAmount, setCoverageAmount] = useState("");
  const [duration, setDuration] = useState(DURATION_OPTIONS[2].value); // default 90 days

  const amountNum = parseFloat(coverageAmount) || 0;
  const premiumBtcLst = calculatePremium(amountNum, protocol.premium_rate, duration);
  const premiumUsdc = premiumBtcLst * MOCK_BTC_LST_PRICE_USD;
  const ratePercent = (protocol.premium_rate / 100).toFixed(1);

  function handleBuy() {
    if (amountNum <= 0) {
      toast("Please enter a coverage amount", "error");
      return;
    }
    toast(
      `Cover purchased: ${coverageAmount} BTC-LST for ${formatDuration(duration)} — premium: ${premiumUsdc.toFixed(2)} USDC`,
      "success"
    );
  }

  return (
    <div className="border border-neutral-800 rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4">Buy Cover</h2>

      {/* Coverage Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-neutral-400">Coverage Amount</label>
          <span className="text-xs text-neutral-500">
            Bal: {MOCK_USDC_BALANCE} USDC
          </span>
        </div>
        <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden focus-within:border-neutral-500 transition-colors">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={coverageAmount}
            onChange={(e) => setCoverageAmount(e.target.value)}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="px-3 text-xs text-neutral-400 border-l border-neutral-700">
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
              className={`py-1.5 text-xs rounded-lg border transition-colors ${
                duration === opt.value
                  ? "border-white text-white bg-neutral-800"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div className="bg-neutral-900 rounded-lg p-3 mb-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Portfolio Value</span>
          <span>{amountNum > 0 ? `${amountNum} BTC-LST` : "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Period</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Epoch</span>
          <span className="text-neutral-500">—</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-neutral-400">Premium Rate</span>
          <span>{ratePercent}%</span>
        </div>
        <div className="border-t border-neutral-800 pt-2 flex justify-between text-xs font-medium">
          <span className="text-neutral-400">Premium Cost</span>
          <div className="text-right">
            <p>{premiumUsdc > 0 ? `${premiumUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : "—"}</p>
            {premiumUsdc > 0 && (
              <p className="text-[11px] text-neutral-500">
                &asymp; {premiumBtcLst.toFixed(6)} BTC-LST
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleBuy}
        className="w-full py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
      >
        Buy Cover
      </button>
    </div>
  );
}
