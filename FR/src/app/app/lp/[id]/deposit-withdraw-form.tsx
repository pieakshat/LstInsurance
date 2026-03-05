"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";
import { VAULT_ABI } from "@/lib/abis/vault";
import { ERC20_ABI } from "@/lib/abis/erc20";
import { TOKENS } from "@/lib/contracts";
import { useTxStep } from "@/lib/hooks/use-tx-step";
import { useToast } from "../../toast";

// ---------------------------------------------------------------------------
// Helpers
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

/** Split bigint into [low, high] decimal strings for raw calldata. */
function u256cd(v: bigint): [string, string] {
  return [String(v & U128_MASK), String(v >> SHIFT_128)];
}

function fmtBtc(wei: bigint, decimals = 4): string {
  if (wei === 0n) return "0";
  const val = Number(wei) / 1e18;
  return val.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/**
 * Parse a user-entered decimal string directly to wei (bigint) without
 * passing through float — avoids precision loss above Number.MAX_SAFE_INTEGER.
 */
function parseAmountToWei(input: string): bigint {
  const clean = input.trim();
  if (!clean || clean === ".") return 0n;
  const [intStr, fracStr = ""] = clean.split(".");
  const fracPadded = fracStr.padEnd(18, "0").slice(0, 18);
  return BigInt(intStr || "0") * (10n ** 18n) + BigInt(fracPadded);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = "deposit" | "withdraw";

interface Props {
  vaultAddress: string;
  userAddress: string | undefined;
  totalAssets: bigint;
  totalSupply: bigint;
  availableLiquidity: bigint;
  onTxSuccess: () => void;
}

export function DepositWithdrawForm({
  vaultAddress,
  userAddress,
  totalAssets,
  totalSupply,
  availableLiquidity,
  onTxSuccess,
}: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");

  const vaultEnabled = !!vaultAddress && vaultAddress !== "0x0";

  const depositTx = useTxStep();
  const withdrawTx = useTxStep();

  // ── On-chain reads ──────────────────────────────────────────────────────
  // User's BTC-LST wallet balance — track pending so we don't false-fail the guard
  const { data: btcBalRaw, isPending: btcBalPending, refetch: refetchBtcBal } = useReadContract({
    abi: ERC20_ABI as Abi,
    address: TOKENS.btcLst as `0x${string}`,
    functionName: "balance_of",
    args: [userAddress],
    enabled: !!userAddress,
  });

  // User's vault share balance
  const { data: userSharesRaw, isPending: sharesPending, refetch: refetchShares } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddress as `0x${string}`,
    functionName: "balance_of",
    args: [userAddress],
    enabled: vaultEnabled && !!userAddress,
  });

  // ── Parsed values ────────────────────────────────────────────────────────
  const btcBalance = parseU256(btcBalRaw);
  const userShares = parseU256(userSharesRaw);

  const sharePriceFloat =
    totalSupply > 0n ? Number(totalAssets) / Number(totalSupply) : 1;

  const amountNum = parseFloat(amount) || 0;
  // Parse directly from string to avoid float precision loss for large amounts
  const amountWei = amount ? parseAmountToWei(amount) : 0n;

  // Deposit preview
  const sharesToReceive = sharePriceFloat > 0 ? amountNum / sharePriceFloat : 0;

  // Withdraw preview: user enters shares to redeem
  const assetsToReceive = amountNum * sharePriceFloat;
  const maxSharesFloat = Number(userShares) / 1e18;
  const maxWithdrawAssets = Number(availableLiquidity) / 1e18;

  const hasPosition = userShares > 0n;

  // ── Tx handlers ──────────────────────────────────────────────────────────
  function handleDeposit() {
    if (!userAddress) { toast("Connect your wallet first", "error"); return; }
    if (amountWei <= 0n) { toast("Enter an amount to deposit", "error"); return; }
    // Only gate on balance when the read has actually resolved — btcBalRaw is
    // undefined while loading, which would make btcBalance = 0 and block every deposit.
    if (!btcBalPending && btcBalRaw !== undefined && amountWei > btcBalance) {
      toast("Insufficient BTC-LST balance", "error"); return;
    }

    const [amtLow, amtHigh] = u256cd(amountWei);

    depositTx.execute([
      // 1. Approve vault to spend BTC-LST
      {
        contractAddress: TOKENS.btcLst,
        entrypoint: "approve",
        calldata: [vaultAddress, amtLow, amtHigh],
      },
      // 2. Deposit BTC-LST into vault, receive LP shares
      {
        contractAddress: vaultAddress,
        entrypoint: "deposit",
        calldata: [amtLow, amtHigh, userAddress],
      },
    ]);
  }

  function handleWithdraw() {
    if (!userAddress) { toast("Connect your wallet first", "error"); return; }
    if (amountWei <= 0n) { toast("Enter share amount to withdraw", "error"); return; }
    if (amountWei > userShares) { toast("Exceeds your share balance", "error"); return; }

    const [sharesLow, sharesHigh] = u256cd(amountWei);

    withdrawTx.execute([
      {
        contractAddress: vaultAddress,
        entrypoint: "redeem",
        // redeem(shares, receiver, owner)
        calldata: [sharesLow, sharesHigh, userAddress, userAddress],
      },
    ]);
  }

  // Refetch balances after tx success
  const isTxPending =
    depositTx.status === "pending" || depositTx.status === "confirming" ||
    withdrawTx.status === "pending" || withdrawTx.status === "confirming";

  // Refetch balances and notify parent after tx confirms
  useEffect(() => {
    if (depositTx.status === "done") {
      setAmount("");
      refetchBtcBal();
      refetchShares();
      onTxSuccess();
      depositTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.status]);

  useEffect(() => {
    if (withdrawTx.status === "done") {
      setAmount("");
      refetchBtcBal();
      refetchShares();
      onTxSuccess();
      withdrawTx.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawTx.status]);

  const txStatus = tab === "deposit" ? depositTx.status : withdrawTx.status;

  return (
    <div className="gradient-border rounded-xl overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b border-white/5">
        {(["deposit", "withdraw"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(""); }}
            className={`flex-1 py-3 text-sm font-medium transition-all relative ${
              tab === t ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t === "deposit" ? "Deposit" : "Withdraw"}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8704A]" />
            )}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "deposit" ? (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-neutral-400">Amount</label>
                <button
                  className="text-xs text-neutral-500 hover:text-white transition-colors"
                  onClick={() => setAmount(fmtBtc(btcBalance, 6))}
                  disabled={btcBalPending}
                >
                  Bal: {btcBalPending ? "..." : `${fmtBtc(btcBalance)} BTC-LST`}
                </button>
              </div>
              <div className="flex items-center bg-[#0f1117] border border-white/8 rounded-lg overflow-hidden focus-within:border-[#E8704A]/50 transition-colors">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="px-3 text-xs text-neutral-400 border-l border-white/8">BTC-LST</span>
              </div>
            </div>

            <div className="bg-[#0f1117] border border-white/6 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">You deposit</span>
                <span>{amountNum > 0 ? `${amountNum} BTC-LST` : "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Share price</span>
                <span>{sharePriceFloat.toFixed(4)} BTC-LST</span>
              </div>
              <div className="border-t border-white/5 pt-2 flex justify-between text-xs font-medium">
                <span className="text-neutral-400">Shares received</span>
                <span>{sharesToReceive > 0 ? `~${sharesToReceive.toFixed(4)}` : "—"}</span>
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={isTxPending || amountNum <= 0}
              className="btn-primary w-full py-2.5 text-sm font-medium text-white rounded-lg"
            >
              {depositTx.status === "pending"
                ? "Sign in wallet..."
                : depositTx.status === "confirming"
                ? "Confirming..."
                : "Deposit"}
            </button>
            {depositTx.status === "error" && (
              <p className="text-xs text-red-400 mt-2">Transaction failed. Try again.</p>
            )}
          </>
        ) : (
          <>
            {sharesPending ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500">Loading position...</p>
              </div>
            ) : !hasPosition ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500">No position in this vault</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-neutral-400">Shares to redeem</label>
                    <button
                      onClick={() => setAmount(maxSharesFloat.toString())}
                      className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                      Max: {fmtBtc(userShares)}
                    </button>
                  </div>
                  <div className="flex items-center bg-[#0f1117] border border-white/8 rounded-lg overflow-hidden focus-within:border-[#E8704A]/50 transition-colors">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="px-3 text-xs text-neutral-400 border-l border-white/8">Shares</span>
                  </div>
                </div>

                <div className="bg-[#0f1117] border border-white/6 rounded-xl p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">You redeem</span>
                    <span>{amountNum > 0 ? `${amountNum} shares` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Share price</span>
                    <span>{sharePriceFloat.toFixed(4)} BTC-LST</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Pool available</span>
                    <span>{fmtBtc(availableLiquidity)} BTC-LST</span>
                  </div>
                  <div className="border-t border-white/5 pt-2 flex justify-between text-xs font-medium">
                    <span className="text-neutral-400">BTC-LST received</span>
                    <span>{assetsToReceive > 0 ? `~${assetsToReceive.toFixed(6)}` : "—"}</span>
                  </div>
                </div>

                {amountNum > 0 && assetsToReceive > maxWithdrawAssets && (
                  <p className="text-xs text-amber-400 mb-3">
                    Withdrawal limited by available (unlocked) liquidity.
                  </p>
                )}

                <button
                  onClick={handleWithdraw}
                  disabled={isTxPending || amountNum <= 0}
                  className="btn-primary w-full py-2.5 text-sm font-medium text-white rounded-lg"
                >
                  {withdrawTx.status === "pending"
                    ? "Sign in wallet..."
                    : withdrawTx.status === "confirming"
                    ? "Confirming..."
                    : "Withdraw"}
                </button>
                {withdrawTx.status === "error" && (
                  <p className="text-xs text-red-400 mt-2">Transaction failed. Try again.</p>
                )}
              </>
            )}
          </>
        )}

        {/* Tx status indicator */}
        {(txStatus === "done") && (
          <p className="text-xs text-neutral-400 mt-2">Transaction confirmed.</p>
        )}
      </div>
    </div>
  );
}
