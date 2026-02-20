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
        <span className="text-sm text-neutral-400 font-mono">{short}</span>
        <button
          onClick={() => disconnect()}
          className="text-sm px-3 py-1.5 border border-neutral-700 rounded hover:border-neutral-500 transition-colors"
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
          className="text-sm px-4 py-1.5 bg-white text-black rounded font-medium hover:bg-neutral-200 transition-colors"
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
