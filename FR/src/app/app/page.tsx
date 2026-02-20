"use client";

import { useAccount } from "@starknet-react/core";
import { useEffect, useState } from "react";
import type { Protocol } from "@/lib/types";
import { ProtocolCard } from "./protocol-card";
import { YourCovers } from "./your-covers";
import { YourClaims } from "./your-claims";

const TABS = ["Buy Cover", "Your Covers", "Your Claims"] as const;

export default function AppPage() {
  const { status } = useAccount();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);

  useEffect(() => {
    if (status !== "connected") return;
    fetch("/api/protocols")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProtocols(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "connected") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Connect your wallet to get started</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? "text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
        ))}
      </div>

      {/* Buy Cover */}
      {activeTab === "Buy Cover" && (
        <>
          <h2 className="text-2xl font-bold mb-2">Buy Cover</h2>
          <p className="text-neutral-400 mb-6">
            Choose a protocol to purchase insurance coverage.
          </p>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border border-neutral-800 rounded-xl p-5 animate-pulse"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-neutral-800" />
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-neutral-800 rounded" />
                      <div className="h-3 w-32 bg-neutral-800 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-neutral-800 rounded mb-4" />
                  <div className="flex justify-between">
                    <div className="h-4 w-16 bg-neutral-800 rounded" />
                    <div className="h-4 w-16 bg-neutral-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : protocols.length === 0 ? (
            <p className="text-neutral-500">No protocols available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {protocols.map((p) => (
                <ProtocolCard key={p._id} protocol={p} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Your Covers */}
      {activeTab === "Your Covers" && (
        <>
          <h2 className="text-2xl font-bold mb-2">Your Covers</h2>
          <p className="text-neutral-400 mb-6">
            Coverage NFTs representing your active and past insurance positions.
          </p>
          <YourCovers />
        </>
      )}

      {/* Your Claims */}
      {activeTab === "Your Claims" && (
        <>
          <h2 className="text-2xl font-bold mb-2">Your Claims</h2>
          <p className="text-neutral-400 mb-6">
            Track the status of claims you have filed.
          </p>
          <YourClaims />
        </>
      )}
    </div>
  );
}
