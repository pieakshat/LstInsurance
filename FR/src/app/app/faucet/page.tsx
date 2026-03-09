"use client";

import { useState } from "react";
import { useAccount, useSendTransaction, useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";
import { TOKENS } from "@/lib/contracts";
import { useToast } from "../toast";

const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "balance_of",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const satisfies Abi;

const FAUCET_AMOUNTS = {
  usdc: 10_000n * 10n ** 18n,    // 10,000 USDC
  btclst: 10n * 10n ** 18n,      // 10 BTC-LST
};

function parseU256(raw: unknown): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  if (typeof raw === "string") return BigInt(raw);
  if (typeof raw === "object" && raw !== null && "low" in raw && "high" in raw) {
    const r = raw as { low: unknown; high: unknown };
    return (BigInt(String(r.high)) << 128n) | BigInt(String(r.low));
  }
  return 0n;
}

function formatBalance(wei: bigint, decimals = 18): string {
  const whole = wei / 10n ** BigInt(decimals);
  return whole.toLocaleString("en-US");
}

function mintCalldata(to: string, amount: bigint): string[] {
  const low = String(amount & ((1n << 128n) - 1n));
  const high = String(amount >> 128n);
  return [to, low, high];
}

export default function FaucetPage() {
  const { address, status: accountStatus } = useAccount();
  const { toast } = useToast();
  const { sendAsync } = useSendTransaction({});
  const [claiming, setClaiming] = useState<"usdc" | "btclst" | "both" | null>(null);

  const { data: usdcBalRaw, refetch: refetchUsdc } = useReadContract({
    abi: MINT_ABI,
    address: TOKENS.usdc as `0x${string}`,
    functionName: "balance_of",
    args: [address as `0x${string}`],
    enabled: !!address,
  });

  const { data: btcBalRaw, refetch: refetchBtc } = useReadContract({
    abi: MINT_ABI,
    address: TOKENS.btcLst as `0x${string}`,
    functionName: "balance_of",
    args: [address as `0x${string}`],
    enabled: !!address,
  });

  const usdcBalance = parseU256(usdcBalRaw);
  const btcBalance = parseU256(btcBalRaw);

  async function claim(token: "usdc" | "btclst" | "both") {
    if (!address) {
      toast("Connect your wallet first", "error");
      return;
    }
    setClaiming(token);
    try {
      const calls = [];
      if (token === "usdc" || token === "both") {
        calls.push({
          contractAddress: TOKENS.usdc,
          entrypoint: "mint",
          calldata: mintCalldata(address, FAUCET_AMOUNTS.usdc),
        });
      }
      if (token === "btclst" || token === "both") {
        calls.push({
          contractAddress: TOKENS.btcLst,
          entrypoint: "mint",
          calldata: mintCalldata(address, FAUCET_AMOUNTS.btclst),
        });
      }
      await sendAsync(calls);
      toast(
        token === "both"
          ? "Minted 10,000 USDC + 10 BTC-LST!"
          : token === "usdc"
          ? "Minted 10,000 USDC!"
          : "Minted 10 BTC-LST!",
        "success",
      );
      setTimeout(() => {
        refetchUsdc();
        refetchBtc();
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(msg.length > 80 ? "Transaction failed" : msg, "error");
    } finally {
      setClaiming(null);
    }
  }

  const connected = accountStatus === "connected";

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Testnet Faucet</h1>
      <p className="text-neutral-400 text-sm mb-8">
        Mint test tokens to play around with the protocol on Starknet Sepolia.
      </p>

      {/* Balances */}
      {connected && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="gradient-border rounded-xl p-4">
            <p className="text-xs text-neutral-400 mb-1">Your USDC Balance</p>
            <p className="text-xl font-semibold">{formatBalance(usdcBalance)}</p>
            <p className="text-xs text-neutral-500 mt-0.5">MockUSDC</p>
          </div>
          <div className="gradient-border rounded-xl p-4">
            <p className="text-xs text-neutral-400 mb-1">Your BTC-LST Balance</p>
            <p className="text-xl font-semibold">{formatBalance(btcBalance)}</p>
            <p className="text-xs text-neutral-500 mt-0.5">xyBTC</p>
          </div>
        </div>
      )}

      {/* Token cards */}
      <div className="space-y-3 mb-4">
        {/* USDC */}
        <div className="gradient-border rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">MockUSDC</p>
            <p className="text-xs text-neutral-400 mt-0.5">Used to pay insurance premiums</p>
            <p className="text-xs text-neutral-500 font-mono mt-2">
              {TOKENS.usdc.slice(0, 10)}...{TOKENS.usdc.slice(-6)}
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-lg font-semibold mb-2">10,000 <span className="text-sm text-neutral-400">USDC</span></p>
            <button
              onClick={() => claim("usdc")}
              disabled={!connected || claiming !== null}
              className="btn-primary px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming === "usdc" ? "Minting..." : "Mint"}
            </button>
          </div>
        </div>

        {/* BTC-LST */}
        <div className="gradient-border rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">BTC-LST (xyBTC)</p>
            <p className="text-xs text-neutral-400 mt-0.5">Deposited by LPs to back coverage</p>
            <p className="text-xs text-neutral-500 font-mono mt-2">
              {TOKENS.btcLst.slice(0, 10)}...{TOKENS.btcLst.slice(-6)}
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-lg font-semibold mb-2">10 <span className="text-sm text-neutral-400">BTC-LST</span></p>
            <button
              onClick={() => claim("btclst")}
              disabled={!connected || claiming !== null}
              className="btn-primary px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming === "btclst" ? "Minting..." : "Mint"}
            </button>
          </div>
        </div>
      </div>

      {/* Mint both */}
      <button
        onClick={() => claim("both")}
        disabled={!connected || claiming !== null}
        className="w-full py-2.5 text-sm font-medium rounded-lg border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {claiming === "both" ? "Minting..." : "Mint Both in One Transaction"}
      </button>

      {!connected && (
        <p className="text-center text-xs text-neutral-500 mt-4">
          Connect your wallet to mint tokens.
        </p>
      )}
    </div>
  );
}
