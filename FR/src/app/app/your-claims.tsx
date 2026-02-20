"use client";

import type { Claim, ClaimStatus } from "@/lib/types";
import { formatWei } from "@/lib/utils";

const now = Math.floor(Date.now() / 1000);

const MOCK_CLAIMS: Claim[] = [
  {
    claim_id: 1,
    token_id: 3,
    protocol_name: "Nostra Finance",
    logo_url: "https://app.nostra.finance/favicon.ico",
    coverage_amount: "250000000000000000",
    status: "approved",
    submitted_at: now - 8 * 86400,
    resolved_at: now - 5 * 86400,
  },
  {
    claim_id: 2,
    token_id: 1,
    protocol_name: "Nostra Finance",
    logo_url: "https://app.nostra.finance/favicon.ico",
    coverage_amount: "500000000000000000",
    status: "pending",
    submitted_at: now - 2 * 86400,
    resolved_at: null,
  },
  {
    claim_id: 3,
    token_id: 2,
    protocol_name: "Ekubo Protocol",
    logo_url: "https://ekubo.org/favicon.ico",
    coverage_amount: "1000000000000000000",
    status: "rejected",
    submitted_at: now - 15 * 86400,
    resolved_at: now - 12 * 86400,
  },
];

const STATUS_STYLES: Record<ClaimStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Pending" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Approved" },
  rejected: { bg: "bg-red-500/10", text: "text-red-400", label: "Rejected" },
};

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function YourClaims() {
  const claims = MOCK_CLAIMS;

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

        return (
          <div
            key={claim.claim_id}
            className="border border-neutral-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={claim.logo_url}
                  alt={claim.protocol_name}
                  className="w-9 h-9 rounded-full bg-neutral-800"
                />
                <div>
                  <p className="font-medium text-sm">{claim.protocol_name}</p>
                  <p className="text-xs text-neutral-500">
                    Claim #{claim.claim_id} &middot; Token #{claim.token_id}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
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
                <p className="font-medium">{formatDate(claim.submitted_at)}</p>
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
          </div>
        );
      })}
    </div>
  );
}
