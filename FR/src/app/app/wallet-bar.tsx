"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";

export function WalletBar() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (status === "connected" && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-400 font-mono px-3 py-1.5 gradient-border rounded-lg">
          {short}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-sm px-3 py-1.5 border border-white/10 rounded-lg text-neutral-400 hover:text-white hover:border-white/20 transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className="btn-primary text-sm px-4 py-1.5 text-white rounded-lg font-medium"
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
