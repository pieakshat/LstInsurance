"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoveragePosition } from "@/lib/types";
import { formatWei, formatDuration } from "@/lib/utils";

const now = Math.floor(Date.now() / 1000);

const MOCK_COVERS: CoveragePosition[] = [
];

function getStatus(cover: CoveragePosition): "active" | "expired" {
  return now < cover.end_time ? "active" : "expired";
}

function timeRemaining(endTime: number): string {
  const diff = endTime - now;
  if (diff <= 0) return "Expired";
  return `${formatDuration(diff)} left`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function YourCovers() {
  const covers = MOCK_COVERS;
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        const isExpanded = expandedId === cover.token_id;

        return (
          <div
            key={cover.token_id}
            className={`border rounded-xl transition-colors ${
              isActive
                ? "border-neutral-800"
                : "border-neutral-800/50 opacity-60"
            }`}
          >
            {/* Clickable header area */}
            <button
              onClick={() =>
                setExpandedId(isExpanded ? null : cover.token_id)
              }
              className="w-full text-left p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={cover.logo_url}
                    alt={cover.protocol_name}
                    className="w-9 h-9 rounded-full bg-neutral-800"
                  />
                  <div>
                    <p className="font-medium text-sm">
                      {cover.protocol_name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Token #{cover.token_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    {isActive ? "Active" : "Expired"}
                  </span>
                  <svg
                    className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Coverage</p>
                  <p className="font-medium">
                    {formatWei(cover.coverage_amount)} BTC-LST
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">
                    Premium Paid
                  </p>
                  <p className="font-medium">
                    {formatWei(cover.premium_paid)} USDC
                  </p>
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
                    className={`font-medium ${!isActive ? "text-neutral-500" : ""}`}
                  >
                    {timeRemaining(cover.end_time)}
                  </p>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-0">
                <div className="border-t border-neutral-800 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">
                        Start Date
                      </p>
                      <p className="font-medium">
                        {formatDateTime(cover.start_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">
                        End Date
                      </p>
                      <p className="font-medium">
                        {formatDateTime(cover.end_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-0.5">
                        Protocol ID
                      </p>
                      <p className="font-medium">{cover.protocol_id}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isActive && (
                      <Link
                        href={`/app/submit-claim?tokenId=${cover.token_id}`}
                        className="text-xs px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
                      >
                        File a Claim
                      </Link>
                    )}
                    <a
                      href={`https://sepolia.voyager.online/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-4 py-2 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                    >
                      View on Explorer &nearr;
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
