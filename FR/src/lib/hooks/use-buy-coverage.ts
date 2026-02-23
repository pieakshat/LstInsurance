"use client";

import { useAccount, useProvider, useReadContract } from "@starknet-react/core";
import { useEffect } from "react";
import type { Abi } from "starknet";
import { hash, num } from "starknet";
import { useTxStep } from "./use-tx-step";
import { PREMIUM_MODULE_ABI } from "../abis/premium-module";
import { ERC20_ABI } from "../abis/erc20";
import { VAULT_ABI } from "../abis/vault";
import { TOKENS, CONTRACTS } from "../contracts";
import { addTokenId } from "../token-store";

const COVERAGE_MINTED_SELECTOR = hash.getSelectorFromName("CoverageMinted");

const U128_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
const SHIFT_128 = 128n;

function u256Calldata(value: bigint): [string, string] {
  return [String(value & U128_MASK), String(value >> SHIFT_128)];
}

/** Decode a starknet u256 return value (bigint, number, string, or {low,high}) to bigint. */
function parseU256(raw: unknown): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  if (typeof raw === "string") return BigInt(raw);
  if (typeof raw === "object" && raw !== null && "low" in raw && "high" in raw) {
    const r = raw as { low: unknown; high: unknown };
    return (BigInt(String(r.high)) << SHIFT_128) | BigInt(String(r.low));
  }
  return 0n;
}

export function useBuyCoverage({
  premiumModuleAddress,
  vaultAddress,
  coverageAmountWei,
  durationSecs,
}: {
  premiumModuleAddress: string;
  vaultAddress: string;
  coverageAmountWei: bigint;
  durationSecs: number;
}) {
  const { address: accountAddress } = useAccount();
  const { provider } = useProvider();
  const txStep = useTxStep();

  const enabled =
    !!premiumModuleAddress &&
    premiumModuleAddress !== "0x0" &&
    coverageAmountWei > 0n &&
    durationSecs > 0;

  // Read exact premium cost from contract
  const { data: previewCostRaw, isLoading: isPreviewLoading } = useReadContract({
    abi: PREMIUM_MODULE_ABI as Abi,
    address: premiumModuleAddress as `0x${string}`,
    functionName: "preview_cost",
    // starknet-react with typed ABI encodes u256 as bigint, u64 as bigint
    args: [coverageAmountWei, BigInt(durationSecs)],
    enabled,
  });

  // Read user's USDC balance (the premium payment token)
  const { data: balanceRaw } = useReadContract({
    abi: ERC20_ABI as Abi,
    address: TOKENS.usdc as `0x${string}`,
    functionName: "balance_of",
    args: [accountAddress],
    enabled: !!accountAddress,
  });

  // Read vault available liquidity to warn user if vault is underfunded
  const { data: liquidityRaw } = useReadContract({
    abi: VAULT_ABI as Abi,
    address: vaultAddress as `0x${string}`,
    functionName: "available_liquidity",
    args: [],
    enabled: !!vaultAddress && vaultAddress !== "0x0",
  });

  const premiumWei = parseU256(previewCostRaw);
  const balanceWei = parseU256(balanceRaw);
  const availableLiquidityWei = parseU256(liquidityRaw);
  const hasEnoughLiquidity = availableLiquidityWei >= coverageAmountWei;

  // When buy_coverage confirms, fetch the receipt directly from the RPC and
  // parse the CoverageMinted event to extract + store the token ID.
  useEffect(() => {
    if (txStep.status !== "done" || !txStep.txHash || !accountAddress) return;

    const txHash = txStep.txHash;

    provider.getTransactionReceipt(txHash).then((receipt) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: Array<{ from_address: string; keys: string[] }> =
        (receipt as any).events ?? [];

      console.log("[useBuyCoverage] receipt events:", events);

      for (const ev of events) {
        // Normalize hex before comparing to handle different zero-padding
        const fromAddr = num.toHex(ev.from_address ?? "0x0");
        const evKey0  = num.toHex(ev.keys?.[0] ?? "0x0");

        if (
          fromAddr === num.toHex(CONTRACTS.coverageToken) &&
          evKey0   === num.toHex(COVERAGE_MINTED_SELECTOR)
        ) {
          // keys: [selector, token_id_low, token_id_high, user]
          const low = BigInt(ev.keys[1] ?? "0");
          const high = BigInt(ev.keys[2] ?? "0");
          const tokenId = Number((high << 128n) | low);
          console.log("[useBuyCoverage] stored tokenId:", tokenId);
          addTokenId(accountAddress, tokenId);
          break;
        }
      }
    }).catch((err) => console.error("[useBuyCoverage] receipt fetch failed:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txStep.status, txStep.txHash]);

  function execute() {
    if (!accountAddress || !enabled || premiumWei <= 0n) return;

    const [covLow, covHigh] = u256Calldata(coverageAmountWei);
    const [premLow, premHigh] = u256Calldata(premiumWei);

    txStep.execute([
      {
        // Approve the PremiumModule to pull the USDC premium from user's wallet
        contractAddress: TOKENS.usdc,
        entrypoint: "approve",
        calldata: [premiumModuleAddress, premLow, premHigh],
      },
      {
        contractAddress: premiumModuleAddress,
        entrypoint: "buy_coverage",
        calldata: [covLow, covHigh, String(durationSecs)],
      },
    ]);
  }

  return {
    execute,
    status: txStep.status,
    txHash: txStep.txHash,
    reset: txStep.reset,
    premiumWei,
    isPreviewLoading,
    balanceWei,
    availableLiquidityWei,
    hasEnoughLiquidity,
  };
}
