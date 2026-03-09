"use client";

import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  voyager,
  jsonRpcProvider,
  argent,
  braavos,
  useInjectedConnectors,
} from "@starknet-react/core";
import { ReactNode } from "react";

function rpc() {
  return {
    nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/ObRBmbXEtBVr6aVMb4XE4yPd7FajQh63",
  };
}

export function StarknetProvider({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "always",
    order: "alphabetical",
  });

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
