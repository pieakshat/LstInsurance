"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSendTransaction, useTransactionReceipt } from "@starknet-react/core";
import { TransactionType } from "starknet";
import { parseContractError } from "../errors";
import { useToast } from "@/app/app/toast";

export type TxStatus = "idle" | "pending" | "confirming" | "done" | "error";

type Call = { contractAddress: string; entrypoint: string; calldata: string[] };

export function useTxStep() {
  const { account } = useAccount();
  const [txHash, setTxHash] = useState<string | undefined>();
  const [status, setStatus] = useState<TxStatus>("idle");
  const { toast } = useToast();

  const { sendAsync, error: sendError } = useSendTransaction({});

  const { data: receipt } = useTransactionReceipt({
    hash: txHash,
    refetchInterval: 2000,
    enabled: !!txHash && status === "confirming",
  });

  useEffect(() => {
    if (sendError && status === "pending") {
      setStatus("error");
      toast(parseContractError(sendError), "error");
    }
  }, [sendError, status, toast]);

  useEffect(() => {
    if (!receipt || status !== "confirming") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execStatus = (receipt as any).execution_status as string | undefined;
    if (execStatus === "SUCCEEDED") {
      setStatus("done");
      toast("Transaction confirmed", "success");
    } else if (execStatus === "REVERTED") {
      setStatus("error");
      toast("Transaction reverted on-chain", "error");
    }
  }, [receipt, status, toast]);

  const execute = useCallback(
    async (calls: Call[]) => {
      setStatus("pending");
      setTxHash(undefined);
      try {
        // Pre-simulate against the RPC to get the real contract revert reason
        // before the wallet opens. Argent X's own simulation only surfaces
        // "argent/multicall-failed" with no details.
        if (account) {
          await account.simulateTransaction(
            [{ type: TransactionType.INVOKE, payload: calls }],
            { skipValidate: true },
          );
        }

        const result = await sendAsync(calls);
        setTxHash(result.transaction_hash);
        setStatus("confirming");
      } catch (err) {
        setStatus("error");
        toast(parseContractError(err), "error");
      }
    },
    [sendAsync, account, toast],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(undefined);
  }, []);

  return { execute, status, txHash, reset };
}
