"use client";

import { useReadContract } from "@starknet-react/core";
import type { Abi } from "starknet";

interface UseContractReadProps {
  address?: `0x${string}`;
  abi?: Abi;
  functionName: string;
  args?: unknown[];
  enabled?: boolean;
  watch?: boolean;
}

export function useContractRead({
  address,
  abi,
  functionName,
  args,
  enabled = true,
  watch = false,
}: UseContractReadProps) {
  const result = useReadContract({
    abi,
    address,
    functionName,
    args,
    watch,
    enabled: enabled && !!address && !!abi,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
