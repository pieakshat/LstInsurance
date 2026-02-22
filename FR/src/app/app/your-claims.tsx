"use client";

import { useState } from "react";
import type { Claim, ClaimStatus } from "@/lib/types";
import { formatWei } from "@/lib/utils";

const now = Math.floor(Date.now() / 1000);

const MOCK_CLAIMS: Claim[] = [];

const STATUS_STYLES: Record<
  ClaimStatus,
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    label: "Pending",
  },
  approved: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    label: "Approved",
  },
  rejected: { bg: "bg-red-500/10", text: "text-red-400", label: "Rejected" },
};

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

function statusDescription(status: ClaimStatus): string {
  switch (status) {
    case "pending":
      return "Your claim is being reviewed by the claims manager contract. This may take a few days.";
    case "approved":
      return "Your claim has been approved. The payout has been issued from the vault in BTC-LST.";
    case "rejected":
      return "Your claim was not approved. The coverage NFT remains valid if it has not expired.";
  }
}

export function YourClaims() {
  const claims = MOCK_CLAIMS;
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (claims.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500 mb-2">No claims filed</p>
        <p className="text-sm text-neutral-600">
          If you experience a loss event, you can file a claim from your active
          coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const style = STATUS_STYLES[claim.status];
        const isExpanded = expandedId === claim.claim_id;

        return (
          <div
            key={claim.claim_id}
            className="border border-neutral-800 rounded-xl"
          >
            {/* Clickable header */}
            <button
              onClick={() =>
                setExpandedId(isExpanded ? null : claim.claim_id)
              }
              className="w-full text-left p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={claim.logo_url}
                    alt={claim.protocol_name}
                    className="w-9 h-9 rounded-full bg-neutral-800"
                  />
                  <div>
                    <p className="font-medium text-sm">
                      {claim.protocol_name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Claim #{claim.claim_id} &middot; Token #{claim.token_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
                  >
                    {style.label}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">
                    Coverage Amount
                  </p>
                  <p className="font-medium">
                    {formatWei(claim.coverage_amount)} BTC-LST
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
                  <p className="font-medium">
                    {formatDate(claim.submitted_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Resolved</p>
                  <p className="font-medium">
                    {claim.resolved_at
                      ? formatDate(claim.resolved_at)
                      : "—"}
                  </p>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-0">
                <div className="border-t border-neutral-800 pt-4">
                  {/* Status timeline */}
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 mb-2">
                      Status Timeline
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium">Submitted</p>
                          <p className="text-xs text-neutral-500">
                            {formatDateTime(claim.submitted_at)}
                          </p>
                        </div>
                      </div>
                      {claim.resolved_at && (
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              claim.status === "approved"
                                ? "bg-emerald-400"
                                : "bg-red-400"
                            }`}
                          />
                          <div>
                            <p className="text-xs font-medium">
                              {claim.status === "approved"
                                ? "Approved"
                                : "Rejected"}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {formatDateTime(claim.resolved_at)}
                            </p>
                          </div>
                        </div>
                      )}
                      {claim.status === "pending" && (
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse" />
                          <div>
                            <p className="text-xs font-medium text-amber-400">
                              Under Review
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status description */}
                  <p className="text-xs text-neutral-500 mb-4">
                    {statusDescription(claim.status)}
                  </p>

                  <a
                    href={`https://sepolia.voyager.online/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs px-4 py-2 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                  >
                    View on Explorer &nearr;
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
