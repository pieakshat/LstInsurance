"use client";

import type { CoveragePosition } from "@/lib/types";
import { formatWei, formatDuration } from "@/lib/utils";

const now = Math.floor(Date.now() / 1000);

const MOCK_COVERS: CoveragePosition[] = [
  {
    token_id: 1,
    protocol_id: 1,
    protocol_name: "Nostra Finance",
    logo_url: "https://app.nostra.finance/favicon.ico",
    coverage_amount: "500000000000000000",
    premium_paid: "8333333333333333",
    start_time: now - 30 * 86400,
    end_time: now + 60 * 86400,
  },
  {
    token_id: 2,
    protocol_id: 2,
    protocol_name: "Ekubo Protocol",
    logo_url: "https://ekubo.org/favicon.ico",
    coverage_amount: "1000000000000000000",
    premium_paid: "25000000000000000",
    start_time: now - 60 * 86400,
    end_time: now + 30 * 86400,
  },
  {
    token_id: 3,
    protocol_id: 1,
    protocol_name: "Nostra Finance",
    logo_url: "https://app.nostra.finance/favicon.ico",
    coverage_amount: "250000000000000000",
    premium_paid: "4166666666666666",
    start_time: now - 100 * 86400,
    end_time: now - 10 * 86400,
  },
];

function getStatus(cover: CoveragePosition): "active" | "expired" {
  return now < cover.end_time ? "active" : "expired";
}

function timeRemaining(endTime: number): string {
  const diff = endTime - now;
  if (diff <= 0) return "Expired";
  return `${formatDuration(diff)} left`;
}

export function YourCovers() {
  const covers = MOCK_COVERS;

  if (covers.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No coverage positions yet</p>
        <p className="text-sm text-neutral-600">
          Purchase cover from the Buy Cover tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {covers.map((cover) => {
        const status = getStatus(cover);
        const isActive = status === "active";

        return (
          <div
            key={cover.token_id}
            className={`border rounded-xl p-5 ${
              isActive
                ? "border-neutral-800"
                : "border-neutral-800/50 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={cover.logo_url}
                  alt={cover.protocol_name}
                  className="w-9 h-9 rounded-full bg-neutral-800"
                />
                <div>
                  <p className="font-medium text-sm">{cover.protocol_name}</p>
                  <p className="text-xs text-neutral-500">
                    Token #{cover.token_id}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {isActive ? "Active" : "Expired"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Coverage</p>
                <p className="font-medium">{formatWei(cover.coverage_amount)} BTC-LST</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Premium Paid</p>
                <p className="font-medium">{formatWei(cover.premium_paid)} USDC</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Duration</p>
                <p className="font-medium">
                  {formatDuration(cover.end_time - cover.start_time)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Time Left</p>
                <p
                  className={`font-medium ${
                    !isActive ? "text-neutral-500" : ""
                  }`}
                >
                  {timeRemaining(cover.end_time)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
