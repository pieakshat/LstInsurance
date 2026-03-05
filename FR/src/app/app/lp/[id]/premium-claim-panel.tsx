"use client";

import { useEffect, useState } from "react";
import { useProvider, useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";
import { PREMIUM_MODULE_ABI } from "@/lib/abis/premium-module";
import { useTxStep } from "@/lib/hooks/use-tx-step";
import { useToast } from "../../toast";

const SHIFT_128 = 128n;

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

function fmtBtc(wei: bigint): string {
  if (wei === 0n) return "0";
  const val = Number(wei) / 1e18;
  if (val < 0.0001) return "<0.0001";
  return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

interface Props {
  premiumModuleAddr: string;
  userAddress: string;
  userShares: bigint;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PremiumClaimPanel({ premiumModuleAddr, userAddress, userShares }: Props) {
  const { provider } = useProvider();
  const { toast } = useToast();

  const pmEnabled = !!premiumModuleAddr && premiumModuleAddr !== "0x0";

  // ── Contract reads ────────────────────────────────────────────────────────

  const { data: currentEpochRaw, refetch: refetchEpoch } = useReadContract({
    abi: PREMIUM_MODULE_ABI as Abi,
    address: premiumModuleAddr as `0x${string}`,
    functionName: "current_epoch",
    args: [],
    enabled: pmEnabled,
  });

  const { data: pendingPremiumsRaw, refetch: refetchPending } = useReadContract({
    abi: PREMIUM_MODULE_ABI as Abi,
    address: premiumModuleAddr as `0x${string}`,
    functionName: "pending_premiums",
    args: [],
    enabled: pmEnabled,
  });

  const currentEpoch = typeof currentEpochRaw === "number"
    ? currentEpochRaw
    : typeof currentEpochRaw === "bigint"
      ? Number(currentEpochRaw)
      : typeof currentEpochRaw === "string"
        ? parseInt(currentEpochRaw, 10)
        : 0;

  const pendingPremiums = parseU256(pendingPremiumsRaw);

  // ── Per-epoch claimable amounts ───────────────────────────────────────────

  // { [epoch]: bigint }
  const [claimable, setClaimable] = useState<Record<number, bigint>>({});
  const [loadingEpochs, setLoadingEpochs] = useState(false);

  async function fetchClaimable(epoch: number) {
    if (!provider || !userAddress || epoch < 1) return;
    // Look back up to 5 finalized epochs
    const from = Math.max(1, epoch - 1);
    const to = epoch - 1; // finalized = current - 1 and earlier

    if (to < from) return;

    setLoadingEpochs(true);
    try {
      const results: Record<number, bigint> = {};
      await Promise.all(
        Array.from({ length: to - from + 1 }, (_, i) => from + i).map(async (ep) => {
          try {
            const res = await provider.callContract({
              contractAddress: premiumModuleAddr,
              entrypoint: "claimable",
              calldata: [String(ep), userAddress],
            }, "latest");
            const amount = (BigInt(res[0] ?? "0")) | (BigInt(res[1] ?? "0") << SHIFT_128);
            if (amount > 0n) results[ep] = amount;
          } catch {
            // epoch may not have data yet
          }
        })
      );
      setClaimable(results);
    } finally {
      setLoadingEpochs(false);
    }
  }

  useEffect(() => {
    if (!pmEnabled || !userAddress || !provider || currentEpoch === 0) return;
    fetchClaimable(currentEpoch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpoch, userAddress, pmEnabled, provider]);

  // ── Transactions ──────────────────────────────────────────────────────────

  const checkpointTx = useTxStep();
  const claimTx = useTxStep();

  function handleCheckpoint() {
    if (!userAddress) { toast("Connect your wallet first", "error"); return; }
    if (userShares === 0n) { toast("No vault shares to checkpoint", "error"); return; }
    checkpointTx.execute([
      { contractAddress: premiumModuleAddr, entrypoint: "checkpoint", calldata: [] },
    ]);
  }

  function handleClaim(epoch: number) {
    if (!userAddress) { toast("Connect your wallet first", "error"); return; }
    claimTx.execute([
      {
        contractAddress: premiumModuleAddr,
        entrypoint: "claim_premiums",
        calldata: [String(epoch)],
      },
    ]);
  }

  // Refetch after txs confirm
  useEffect(() => {
    if (checkpointTx.status === "done") {
      refetchEpoch();
      refetchPending();
      checkpointTx.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpointTx.status]);

  useEffect(() => {
    if (claimTx.status === "done") {
      fetchClaimable(currentEpoch);
      claimTx.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimTx.status]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const claimableEpochs = Object.entries(claimable)
    .map(([ep, amt]) => ({ epoch: Number(ep), amount: amt }))
    .sort((a, b) => b.epoch - a.epoch);

  const totalClaimable = claimableEpochs.reduce((sum, { amount }) => sum + amount, 0n);

  const isTxBusy =
    checkpointTx.status === "pending" || checkpointTx.status === "confirming" ||
    claimTx.status === "pending" || claimTx.status === "confirming";

  if (!pmEnabled || currentEpoch === 0) return null;

  return (
    <div className="gradient-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Premium Earnings</h2>
        <span className="text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full">
          Epoch {currentEpoch}
        </span>
      </div>

      {/* Current epoch stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Pending (this epoch)</p>
          <p className="text-sm font-semibold">{fmtBtc(pendingPremiums)} USDC</p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <p className="text-xs text-neutral-500 mb-1">Claimable now</p>
          <p className="text-sm font-semibold text-[#34D399]">
            {loadingEpochs ? "..." : `${fmtBtc(totalClaimable)} BTC-LST`}
          </p>
        </div>
      </div>

      {/* Checkpoint section */}
      <div className="bg-[#0f1117] rounded-lg p-3 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium mb-0.5">Checkpoint shares</p>
            <p className="text-xs text-neutral-500">
              Record your current vault shares for epoch {currentEpoch}. Required once per epoch to earn premiums.
            </p>
          </div>
          <button
            onClick={handleCheckpoint}
            disabled={isTxBusy || userShares === 0n}
            className="shrink-0 text-xs px-3 py-1.5 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg text-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {checkpointTx.status === "pending"
              ? "Signing..."
              : checkpointTx.status === "confirming"
                ? "Confirming..."
                : "Checkpoint"}
          </button>
        </div>
      </div>

      {/* Claimable epochs */}
      {claimableEpochs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 mb-2">Past epochs to claim</p>
          {claimableEpochs.map(({ epoch, amount }) => (
            <div
              key={epoch}
              className="flex items-center justify-between bg-[#0f1117] rounded-lg px-3 py-2.5"
            >
              <div>
                <p className="text-xs text-neutral-400">Epoch {epoch}</p>
                <p className="text-sm font-medium text-[#34D399]">{fmtBtc(amount)} BTC-LST</p>
              </div>
              <button
                onClick={() => handleClaim(epoch)}
                disabled={isTxBusy}
                className="text-xs px-3 py-1.5 btn-primary text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {claimTx.status !== "idle" && claimTx.status !== "done" && claimTx.status !== "error"
                  ? "..."
                  : "Claim"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        !loadingEpochs && (
          <p className="text-xs text-neutral-600 text-center py-2">
            No claimable premiums from past epochs.
          </p>
        )
      )}
    </div>
  );
}
