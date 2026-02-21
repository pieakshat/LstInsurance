"use client";

import { useSendTransaction } from "@starknet-react/core";
import type { Call } from "starknet";
import { parseContractError } from "../errors";

export function useSendTx() {
  const { send: rawSend, isPending, error, data, reset } = useSendTransaction({});

  function send(calls: Call[]) {
    rawSend(calls);
  }

  return {
    send,
    isPending,
    error: error ? new Error(parseContractError(error)) : null,
    data,
    reset,
  };
}
