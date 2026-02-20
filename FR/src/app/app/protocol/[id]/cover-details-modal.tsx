"use client";

import type { Protocol } from "@/lib/types";

export function CoverDetails({ protocol }: { protocol: Protocol }) {
  return (
    <div className="border border-neutral-800 rounded-xl p-5 space-y-4">
      <h2 className="text-base font-semibold">Cover Details</h2>

      <section>
        <h3 className="text-xs font-medium text-neutral-300 mb-1">Summary</h3>
        <p className="text-xs text-neutral-500 leading-relaxed">
          This policy covers assets deposited in {protocol.protocol_name} on{" "}
          {protocol.chain} against qualifying loss events defined below.
        </p>
      </section>

      <section>
        <h3 className="text-xs font-medium text-neutral-300 mb-1">What is Covered</h3>
        <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside leading-relaxed">
          <li>Smart contract exploits or bugs leading to loss of deposited funds</li>
          <li>Oracle manipulation resulting in incorrect liquidations</li>
          <li>Protocol governance attacks that result in theft of funds</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-medium text-neutral-300 mb-1">What is Not Covered</h3>
        <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside leading-relaxed">
          <li>Market volatility or price depreciation of covered assets</li>
          <li>Losses due to user error (e.g., sending to wrong address)</li>
          <li>Centralized exchange failures or custodial losses</li>
          <li>Front-end phishing attacks unrelated to protocol smart contracts</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-medium text-neutral-300 mb-1">Claim Process</h3>
        <ol className="text-xs text-neutral-500 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Submit a claim within 7 days of the incident</li>
          <li>Provide evidence (transaction hashes, on-chain proof)</li>
          <li>Claims are validated by the claims manager contract</li>
          <li>Approved claims are paid out from the vault in BTC-LST</li>
        </ol>
      </section>

      <section>
        <h3 className="text-xs font-medium text-neutral-300 mb-1">Terms</h3>
        <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside leading-relaxed">
          <li>Coverage is active from the block the transaction is confirmed</li>
          <li>Coverage expires at the end of the selected duration</li>
          <li>Premiums are non-refundable once coverage starts</li>
          <li>Maximum payout limited to coverage amount purchased</li>
          <li>One active policy per wallet per protocol</li>
        </ul>
      </section>
    </div>
  );
}
