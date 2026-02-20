"use client";

import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  voyager,
  jsonRpcProvider,
  argent,
  braavos,
} from "@starknet-react/core";
import { ReactNode } from "react";

function rpc() {
  return {
    nodeUrl: "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
  };
}

const connectors = [argent(), braavos()];

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={connectors}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
