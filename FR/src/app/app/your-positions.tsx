"use client";

import Link from "next/link";
import type { LPPosition } from "@/lib/types";
import { formatWei, shortenAddress } from "@/lib/utils";

const now = Math.floor(Date.now() / 1000);

const MOCK_POSITIONS: LPPosition[] = [
  {
    protocol_id: 1,
    protocol_name: "Nostra Finance",
    logo_url: "https://app.nostra.finance/favicon.ico",
    vault_address: "0x0123456789abcdef0123456789abcdef01234567",
    shares: "480000000000000000",
    assets_value: "500000000000000000",
    deposited_at: now - 45 * 86400,
  },
  {
    protocol_id: 2,
    protocol_name: "Ekubo Protocol",
    logo_url: "https://ekubo.org/favicon.ico",
    vault_address: "0xabcdef0123456789abcdef0123456789abcdef01",
    shares: "820000000000000000",
    assets_value: "850000000000000000",
    deposited_at: now - 20 * 86400,
  },
];

// Mock: total LP shares per vault for pool share %
const MOCK_TOTAL_SHARES: Record<number, string> = {
  1: "4800000000000000000",
  2: "8200000000000000000",
};

function daysSince(unix: number): string {
  const days = Math.floor((now - unix) / 86400);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function YourPositions() {
  const positions = MOCK_POSITIONS;

  if (positions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No LP positions yet</p>
        <p className="text-sm text-neutral-600 mb-4">
          Deposit into a vault to start earning premiums.
        </p>
        <Link
          href="/app/lp"
          className="inline-block text-sm px-5 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
        >
          View Pools
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((pos) => {
        const totalShares = MOCK_TOTAL_SHARES[pos.protocol_id] ?? "1";
        const poolShare =
          (Number(pos.shares) / Math.max(Number(totalShares), 1)) * 100;

        return (
          <div
            key={pos.protocol_id}
            className="border border-neutral-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={pos.logo_url}
                  alt={pos.protocol_name}
                  className="w-9 h-9 rounded-full bg-neutral-800"
                />
                <div>
                  <p className="font-medium text-sm">{pos.protocol_name}</p>
                  <p className="text-xs text-neutral-500">
                    Vault:{" "}
                    <span className="font-mono">
                      {shortenAddress(pos.vault_address)}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href="/app/lp"
                className="text-xs px-3 py-1.5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
              >
                Manage
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Your Shares</p>
                <p className="font-medium">{formatWei(pos.shares)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">
                  Current Value
                </p>
                <p className="font-medium">
                  {formatWei(pos.assets_value)} BTC-LST
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Pool Share</p>
                <p className="font-medium">{poolShare.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Deposited</p>
                <p className="font-medium">{daysSince(pos.deposited_at)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
