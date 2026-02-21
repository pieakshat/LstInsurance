"use client";

import { useState } from "react";
import type { Protocol } from "@/lib/types";
import { formatWei } from "@/lib/utils";
import { useToast } from "../../toast";

const MOCK_WALLET_BALANCE = "2.5000";

type Tab = "deposit" | "withdraw";

export function DepositWithdrawForm({
  protocol,
  sharePrice,
  availableLiquidity,
  userShares,
  userAssets,
}: {
  protocol: Protocol;
  sharePrice: number;
  availableLiquidity: string;
  userShares: string;
  userAssets: string;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const hasPosition = Number(userShares) > 0;

  // Deposit: user enters BTC-LST amount, receives shares
  const sharesToReceive = sharePrice > 0 ? amountNum / sharePrice : 0;

  // Withdraw: user enters share amount, receives BTC-LST
  const assetsToReceive = amountNum * sharePrice;
  const maxRedeemableShares = Number(userShares) / 1e18;
  const maxWithdrawableAssets = Number(availableLiquidity) / 1e18;

  function handleDeposit() {
    if (amountNum <= 0) {
      toast("Please enter an amount", "error");
      return;
    }
    toast(
      `Deposited ${amountNum} BTC-LST → ~${sharesToReceive.toFixed(4)} shares`,
      "success"
    );
    setAmount("");
  }

  function handleWithdraw() {
    if (amountNum <= 0) {
      toast("Please enter a share amount", "error");
      return;
    }
    if (amountNum > maxRedeemableShares) {
      toast("Exceeds your share balance", "error");
      return;
    }
    toast(
      `Redeemed ${amountNum} shares → ~${assetsToReceive.toFixed(6)} BTC-LST`,
      "success"
    );
    setAmount("");
  }

  return (
    <div className="border border-neutral-800 rounded-xl overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b border-neutral-800">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t
                ? "text-white bg-neutral-900"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "deposit" ? (
          <>
            {/* Deposit form */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-neutral-400">Amount</label>
                <span className="text-xs text-neutral-500">
                  Bal: {MOCK_WALLET_BALANCE} BTC-LST
                </span>
              </div>
              <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden focus-within:border-neutral-500 transition-colors">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="px-3 text-xs text-neutral-400 border-l border-neutral-700">
                  BTC-LST
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-neutral-900 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">You deposit</span>
                <span>
                  {amountNum > 0 ? `${amountNum} BTC-LST` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Share price</span>
                <span>{sharePrice.toFixed(4)} BTC-LST</span>
              </div>
              <div className="border-t border-neutral-800 pt-2 flex justify-between text-xs font-medium">
                <span className="text-neutral-400">Shares received</span>
                <span>
                  {sharesToReceive > 0
                    ? `~${sharesToReceive.toFixed(4)}`
                    : "—"}
                </span>
              </div>
            </div>

            <button
              onClick={handleDeposit}
              className="w-full py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Deposit
            </button>
          </>
        ) : (
          <>
            {/* Withdraw form */}
            {!hasPosition ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500">
                  No position in this vault
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-neutral-400">Shares</label>
                    <button
                      onClick={() =>
                        setAmount(maxRedeemableShares.toString())
                      }
                      className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                      Max: {maxRedeemableShares.toFixed(4)}
                    </button>
                  </div>
                  <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden focus-within:border-neutral-500 transition-colors">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="px-3 text-xs text-neutral-400 border-l border-neutral-700">
                      Shares
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-neutral-900 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">You redeem</span>
                    <span>
                      {amountNum > 0 ? `${amountNum} shares` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Share price</span>
                    <span>{sharePrice.toFixed(4)} BTC-LST</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Withdrawable</span>
                    <span>{formatWei(availableLiquidity)} BTC-LST</span>
                  </div>
                  <div className="border-t border-neutral-800 pt-2 flex justify-between text-xs font-medium">
                    <span className="text-neutral-400">BTC-LST received</span>
                    <span>
                      {assetsToReceive > 0
                        ? `~${assetsToReceive.toFixed(6)}`
                        : "—"}
                    </span>
                  </div>
                </div>

                {amountNum > 0 &&
                  assetsToReceive > maxWithdrawableAssets && (
                    <p className="text-xs text-amber-400 mb-3">
                      Withdrawal may be limited by available (unlocked)
                      liquidity.
                    </p>
                  )}

                <button
                  onClick={handleWithdraw}
                  className="w-full py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Withdraw
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
