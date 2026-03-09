"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Sidebar sections ──────────────────────────────────────────────────────────

const SECTIONS = [
  {
    label: "Getting Started",
    items: [
      { id: "what-is-strk", label: "What is BitCover?" },
      { id: "how-it-works", label: "How It Works" },
      { id: "key-concepts", label: "Key Concepts" },
    ],
  },
  {
    label: "User Guides",
    items: [
      { id: "buy-coverage", label: "Buying Coverage" },
      { id: "provide-liquidity", label: "Providing Liquidity" },
      { id: "claim-premiums", label: "Claiming LP Premiums" },
      { id: "submit-claim", label: "Submitting a Claim" },
      { id: "faucet", label: "Testnet Faucet" },
    ],
  },
  {
    label: "Technical Architecture",
    items: [
      { id: "arch-overview", label: "System Overview" },
      { id: "protocol-registry", label: "ProtocolRegistry" },
      { id: "lst-vault", label: "LstVault" },
      { id: "premium-module", label: "PremiumModule" },
      { id: "coverage-token", label: "CoverageToken" },
      { id: "claims-manager", label: "ClaimsManager" },
      { id: "vault-factory", label: "VaultFactory" },
    ],
  },
  {
    label: "Cross-Chain",
    items: [
      { id: "crosschain-overview", label: "Overview" },
      { id: "crosschain-evm", label: "EVM Side (Base)" },
      { id: "crosschain-starknet", label: "Starknet Receiver" },
      { id: "message-encoding", label: "Message Encoding" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "deployed-addresses", label: "Deployed Addresses" },
      { id: "premium-formula", label: "Premium Formula" },
    ],
  },
];

// ── Small reusable components ─────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold text-white mb-3 scroll-mt-24">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-white mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-neutral-400 text-sm leading-relaxed mb-3">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-white/6 text-[#E8704A] text-xs px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="bg-[#0a0c10] border border-white/8 rounded-xl p-4 text-xs text-neutral-300 font-mono overflow-x-auto mb-4 leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[#E8704A]/15 border border-[#E8704A]/30 flex items-center justify-center text-xs font-bold text-[#E8704A]">
        {n}
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <div className="text-sm text-neutral-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-500/8 border-blue-500/20 text-blue-300",
    warning: "bg-amber-500/8 border-amber-500/20 text-amber-300",
    tip: "bg-[#E8704A]/8 border-[#E8704A]/20 text-[#E8704A]",
  };
  const icons = { info: "ℹ", warning: "⚠", tip: "💡" };
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm mb-4 leading-relaxed ${styles[type]}`}>
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 pr-6 text-xs text-neutral-500 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/4">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 pr-6 text-neutral-300 text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-white/6 my-10" />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [active, setActive] = useState("what-is-strk");
  const contentRef = useRef<HTMLDivElement>(null);

  // Track which section is in view
  useEffect(() => {
    const allIds = SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="flex gap-8 max-w-6xl mx-auto">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-24 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest mb-1.5 px-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                      active === item.id
                        ? "text-white bg-white/8"
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-white/4"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Content ── */}
      <main ref={contentRef} className="flex-1 min-w-0 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Documentation</h1>
          <p className="text-neutral-400 text-sm">
            Everything you need to use and build on BitCover.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════
            GETTING STARTED
        ════════════════════════════════════════════════════════ */}

        <H2 id="what-is-strk">What is BitCover?</H2>
        <P>
          BitCover is a decentralized insurance protocol built on Starknet. It lets DeFi
          users buy on-chain coverage for their positions in other protocols — for example,
          coverage against a smart contract exploit in a lending protocol.
        </P>
        <P>
          Coverage is backed by real capital: Liquidity Providers deposit BTC-LST (a Bitcoin
          liquid staking token) into underwriting vaults. In return, LPs earn the USDC premiums
          paid by coverage buyers. If a claim is approved, the claimant receives BTC-LST
          directly from the vault.
        </P>
        <P>
          The protocol also has a cross-chain extension: users on Base (EVM) can buy coverage
          that triggers vault operations on Starknet via LayerZero V2.
        </P>

        <Divider />

        <H2 id="how-it-works">How It Works</H2>

        <Pre>{`  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  LPs deposit BTC-LST ──► Vault ◄── locks capital           │
  │                                                             │
  │  Coverage buyers pay USDC ──► PremiumModule                 │
  │       └── mints Coverage NFT                               │
  │       └── locks vault capital proportional to coverage      │
  │                                                             │
  │  Each ~month, governance advances epoch:                    │
  │       └── premiums distributed to LPs pro-rata             │
  │                                                             │
  │  If exploit occurs:                                         │
  │       User submits claim ──► Governor approves              │
  │       └── vault pays out BTC-LST to claimant               │
  │       └── Coverage NFT burned                              │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘`}</Pre>

        <Divider />

        <H2 id="key-concepts">Key Concepts</H2>

        <H3>BTC-LST (xyBTC)</H3>
        <P>
          The collateral token deposited by LPs. It is a Bitcoin liquid staking token whose value
          appreciates over time via staking yield. LPs receive vault shares when depositing, and
          redeem those shares for BTC-LST when withdrawing.
        </P>

        <H3>Coverage NFT</H3>
        <P>
          An ERC-721 NFT minted on every coverage purchase. It encodes your policy — which
          protocol is insured, how much coverage, for how long, and how much premium was paid.{" "}
          <Code>is_active(token_id)</Code> returns <Code>true</Code> while within the coverage window.
        </P>

        <H3>Epochs</H3>
        <P>
          Premiums accumulate in the current epoch. Governance periodically calls{" "}
          <Code>advance_epoch()</Code> to finalise, snapshot LP shares, and open the next epoch.
          LPs must <Code>checkpoint()</Code> their share balance during an epoch to be eligible
          for its premiums.
        </P>

        <H3>Coverage Cap</H3>
        <P>
          Each protocol has a maximum amount of active coverage. Purchases that would push total
          coverage above the cap are rejected. The cap is set by governance and can be updated.
        </P>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            USER GUIDES
        ════════════════════════════════════════════════════════ */}

        <H2 id="buy-coverage">Buying Coverage</H2>
        <P>
          Coverage protects your deposit in a whitelisted protocol against smart contract
          exploits. You pay a USDC premium and receive a Coverage NFT representing your policy.
        </P>

        <Callout type="tip">
          Use the <Link href="/app/faucet" className="underline">Faucet</Link> to get testnet
          USDC and BTC-LST before trying any transactions.
        </Callout>

        <Step n={1} title="Connect your wallet">
          Click the wallet button in the top-right corner and connect your Argent X or Braavos
          wallet.
        </Step>
        <Step n={2} title="Pick a protocol">
          Go to the <Link href="/app" className="underline">Dashboard</Link>. Each card
          represents an insurable DeFi protocol. Click one to open the protocol detail page.
        </Step>
        <Step n={3} title="Enter coverage amount and duration">
          In the &quot;Buy Cover&quot; panel, enter how much BTC-LST value you want covered and
          select a duration (30 / 60 / 90 / 180 days). The USDC premium is calculated in
          real-time from the contract.
        </Step>
        <Step n={4} title="Approve and buy">
          Click <strong>Buy Cover</strong>. Your wallet will prompt you to sign a two-call
          transaction: first an ERC-20 approval for USDC, then the{" "}
          <Code>buy_coverage</Code> call. Once confirmed, your Coverage NFT appears in &quot;Your
          Covers&quot; on the dashboard.
        </Step>

        <Callout type="warning">
          The vault must have enough unlocked liquidity to back your coverage. If it does not, the
          transaction will be blocked with a warning.
        </Callout>

        <Divider />

        <H2 id="provide-liquidity">Providing Liquidity</H2>
        <P>
          LPs deposit BTC-LST into a protocol vault and earn USDC premiums from every coverage
          policy sold. Your capital backs the insurance pool — if a claim is approved, the payout
          comes from your vault.
        </P>

        <Callout type="info">
          Your BTC-LST continues to appreciate via LST staking yield while sitting in the vault.
          Premiums are an additional layer of income on top.
        </Callout>

        <Step n={1} title="Go to the LP page">
          Navigate to <Link href="/app/lp" className="underline">LP</Link> and select a vault.
        </Step>
        <Step n={2} title="Deposit BTC-LST">
          Enter the amount you want to deposit and click <strong>Deposit</strong>. You receive
          vault shares in return — these represent your proportional ownership of the pool.
        </Step>
        <Step n={3} title="Checkpoint your shares each epoch">
          Once per epoch, visit the vault page and click <strong>Checkpoint</strong>. This
          records your current share balance on-chain. You <em>must</em> do this to be eligible
          for that epoch&apos;s premium distribution. Missing an epoch means forfeiting its
          premiums.
        </Step>
        <Step n={4} title="Claim premiums after epoch advance">
          After governance advances the epoch, a <strong>Claim Premiums</strong> button appears
          for each past epoch you checkpointed. Click it to receive your share of the USDC
          premiums proportional to your vault share snapshot.
        </Step>
        <Step n={5} title="Withdraw anytime">
          You can withdraw up to the vault&apos;s <em>available liquidity</em> (total assets
          minus locked coverage). If a large amount of coverage is active, a portion of your
          deposit may be temporarily locked until coverage expires or a claim is resolved.
        </Step>

        <Divider />

        <H2 id="claim-premiums">Claiming LP Premiums</H2>
        <P>
          Premium distribution happens per epoch. After an epoch is finalised you can claim your
          share.
        </P>

        <Pre>{`Your payout = epoch_total_premiums × your_share_snapshot / total_share_snapshot`}</Pre>

        <P>
          The share snapshot is taken at the moment governance calls <Code>advance_epoch()</Code>.
          LPs who did not call <Code>checkpoint()</Code> during that epoch get zero, regardless
          of their deposit size.
        </P>

        <Callout type="warning">
          Each epoch&apos;s premiums can only be claimed once per LP address. Claiming is
          irreversible.
        </Callout>

        <Divider />

        <H2 id="submit-claim">Submitting a Claim</H2>
        <P>
          If the protocol you have coverage on suffers an exploit or loss event, you can submit a
          claim referencing your Coverage NFT. Governors review the evidence off-chain and approve
          or reject.
        </P>

        <Step n={1} title="Go to Submit a Claim">
          Navigate to <Link href="/app/submit-claim" className="underline">Submit a Claim</Link> in
          the nav. Your active Coverage NFTs are listed automatically.
        </Step>
        <Step n={2} title="Select your NFT and submit">
          Pick the coverage position you want to claim against and click{" "}
          <strong>Submit Claim</strong>. This creates an on-chain claim record with status{" "}
          <Code>PENDING</Code>.
        </Step>
        <Step n={3} title="Wait for governance review">
          Governors can see all pending claims in the{" "}
          <Link href="/app/governance" className="underline">Governance</Link> page. They will
          review evidence and either approve or reject.
        </Step>
        <Step n={4} title="Approval: receive BTC-LST payout">
          If approved, the vault sends <Code>coverage_amount</Code> in BTC-LST directly to your
          wallet and your Coverage NFT is burned.
        </Step>
        <Step n={5} title="Rejection: resubmit">
          If rejected, your NFT is untouched and you may submit a new claim with additional
          evidence.
        </Step>

        <Callout type="info">
          Your coverage must still be within its active window to submit a claim. Expired NFTs
          cannot be claimed.
        </Callout>

        <Divider />

        <H2 id="faucet">Testnet Faucet</H2>
        <P>
          On Starknet Sepolia, both MockUSDC and BTC-LST are freely mintable — there is no access
          control on the <Code>mint</Code> function. Visit the{" "}
          <Link href="/app/faucet" className="underline">Faucet</Link> page to mint:
        </P>
        <Table
          headers={["Token", "Amount per mint", "Use"]}
          rows={[
            ["MockUSDC", "10,000 USDC", "Pay coverage premiums"],
            ["BTC-LST (xyBTC)", "10 BTC-LST", "Deposit into LP vaults"],
          ]}
        />
        <P>You can mint both in a single transaction using the &quot;Mint Both&quot; button.</P>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            TECHNICAL ARCHITECTURE
        ════════════════════════════════════════════════════════ */}

        <H2 id="arch-overview">System Overview</H2>
        <P>
          Each insured protocol gets its own isolated contract stack — one vault, one premium
          module, one claims manager — all deployed atomically by the factory. Two contracts are
          singletons shared across all protocols: the registry and the coverage token.
        </P>

        <Pre>{`┌──────────────────────────────────────────────────────────────────┐
│                          STARKNET                                 │
│                                                                   │
│  ┌────────────────┐  registers   ┌────────────────────────────┐  │
│  │ProtocolRegistry│◄─────────────│    InsuranceVaultFactory   │  │
│  │                │              │                            │  │
│  │ protocol list  │              │ deploys Vault + PM + CM    │  │
│  │ coverage caps  │              │ per protocol atomically     │  │
│  │ premium rates  │              └────────────────────────────┘  │
│  └────────────────┘                                              │
│          │ is_active?                                            │
│          ▼                                                        │
│  ┌────────────────┐  lock/unlock  ┌────────────────────────────┐ │
│  │ PremiumModule  │◄─────────────►│        LstVault            │ │
│  │                │               │                            │ │
│  │ buy_coverage   │  withdraw for │ ERC-4626 share vault       │ │
│  │ epoch system   │  payout       │ locked_liquidity tracking  │ │
│  │ LP premiums    │◄─────────────►│ role-based access control  │ │
│  └────────────────┘               └────────────────────────────┘ │
│          │ mint/burn                         ▲                   │
│          ▼                                   │ withdraw          │
│  ┌────────────────┐  approve_claim  ┌────────────────────────┐  │
│  │ CoverageToken  │◄───────────────►│    ClaimsManager       │  │
│  │                │                 │                        │  │
│  │ ERC-721 NFT    │ notify_payout   │ submit / approve /     │  │
│  │ CoveragePos    │◄────────────────│ reject claims          │  │
│  │ is_active()    │                 │ governor roles         │  │
│  └────────────────┘                 └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘`}</Pre>

        <Divider />

        <H2 id="protocol-registry">ProtocolRegistry</H2>
        <P>
          The global registry tracking every insurable DeFi protocol. Governance registers
          protocols with a coverage cap (max active coverage in BTC-LST) and a premium rate in
          basis points. The registry is queried by <Code>PremiumModule</Code> on every purchase
          to check if the protocol is active.
        </P>
        <Table
          headers={["Function", "Access", "Description"]}
          rows={[
            ["register_protocol(address, vault, cap, rate)", "GOVERNANCE", "Onboard a new protocol"],
            ["pause_protocol(id)", "GOVERNANCE", "Block new coverage purchases"],
            ["activate_protocol(id)", "GOVERNANCE", "Re-enable coverage purchases"],
            ["set_coverage_params(id, cap, rate)", "GOVERNANCE", "Update cap / rate"],
            ["is_active(id)", "public view", "Returns true if protocol is active"],
            ["get_protocol(id)", "public view", "Returns full ProtocolInfo struct"],
          ]}
        />

        <Divider />

        <H2 id="lst-vault">LstVault</H2>
        <P>
          An ERC-4626 vault where LPs deposit BTC-LST and receive vault shares. The vault tracks
          locked liquidity separately from total assets — locked liquidity cannot be withdrawn
          until the corresponding coverage expires or a claim is resolved.
        </P>

        <Pre>{`available_liquidity = total_assets - locked_liquidity`}</Pre>

        <Table
          headers={["Role", "Permissions"]}
          rows={[
            ["OWNER_ROLE", "pause, set deposit limit, assign managers"],
            ["COVERAGE_MANAGER_ROLE", "lock_for_coverage, unlock_from_coverage"],
            ["CLAIMS_MANAGER_ROLE", "withdraw_for_payout"],
          ]}
        />

        <Callout type="info">
          The vault is ERC-4626 compliant — standard deposit, withdraw, mint, and redeem
          functions all work as expected. No protocol-specific fees are applied.
        </Callout>

        <Divider />

        <H2 id="premium-module">PremiumModule</H2>
        <P>
          The core entry point for coverage buyers. Handles premium pricing, USDC collection,
          NFT minting, and vault capital locking. Also manages the epoch-based LP premium
          distribution system.
        </P>

        <H3>Premium Formula</H3>
        <Pre>{`premium = coverage_amount × BTC_PRICE_USDC × rate × duration
          ─────────────────────────────────────────────────────
               PRICE_PRECISION × RATE_DENOMINATOR × BASE_DURATION

Constants:
  BTC_PRICE_USDC  = $1,500 (hardcoded notional, 18 decimals)
  BASE_DURATION   = 90 days (7,776,000 seconds)
  RATE_DENOMINATOR = 10,000 (basis points)

Example: 1 BTC-LST, 5% rate (500 bps), 90 days
  = 1e18 × 1500e18 × 500 × 7776000
    ──────────────────────────────── = 75 USDC
       1e18 × 10000 × 7776000`}</Pre>

        <H3>Epoch lifecycle</H3>
        <Pre>{`Epoch N opens
  │
  ├── LPs call checkpoint()      → snapshot share balance for epoch N
  ├── Buyers call buy_coverage() → premiums accumulate in pending_premiums
  │
  │ Governance calls advance_epoch()
  │   └── pending_premiums  → epoch_premiums[N]
  │   └── total vault shares → epoch_total_shares[N]
  │   └── epoch counter     → N + 1
  │
Epoch N+1 opens
  │
  └── LPs call claim_premiums(N)
        └── payout = epoch_premiums[N] × lp_shares[N] / epoch_total_shares[N]`}</Pre>

        <Table
          headers={["Function", "Access", "Description"]}
          rows={[
            ["buy_coverage(amount, duration)", "public", "Pay premium, mint NFT, lock vault"],
            ["preview_cost(amount, duration)", "view", "Returns USDC cost, no state change"],
            ["checkpoint()", "public LP", "Record share balance for current epoch"],
            ["claim_premiums(epoch)", "public LP", "Withdraw USDC from finalized epoch"],
            ["advance_epoch()", "GOVERNANCE", "Finalize epoch, open next"],
            ["expire_coverage(token_id)", "public", "Unlock vault capital for expired NFT"],
          ]}
        />

        <Divider />

        <H2 id="coverage-token">CoverageToken</H2>
        <P>
          An ERC-721 NFT representing a live insurance policy. Minted by{" "}
          <Code>PremiumModule</Code> on purchase, burned by <Code>ClaimsManager</Code> on claim
          approval.
        </P>

        <Pre>{`CoveragePosition {
  protocol_id      → which protocol is insured
  coverage_amount  → BTC-LST value covered (18 decimals)
  start_time       → block timestamp at purchase
  end_time         → start_time + duration_in_seconds
  premium_paid     → USDC amount paid (18 decimals)
}`}</Pre>

        <P>
          <Code>is_active(token_id)</Code> returns <Code>true</Code> while{" "}
          <Code>block_timestamp &lt; end_time</Code>. Only active NFTs can be used to submit
          claims. Once expired, <Code>expire_coverage</Code> can be called on the{" "}
          <Code>PremiumModule</Code> to free the locked vault capital.
        </P>

        <Divider />

        <H2 id="claims-manager">ClaimsManager</H2>
        <P>
          Manages the full insurance claim lifecycle from submission through resolution.
        </P>

        <Pre>{`User holds active Coverage NFT
        │
        │ submit_claim(token_id)
        ▼
  [PENDING] ─────────────────────────► Governor approves
        │                                   │
        │ Governor rejects                  ▼
        ▼                            [APPROVED]
  [REJECTED]                          │
        │                             ├── vault.withdraw_for_payout(user, amount)
        │ User resubmits              ├── coverage_token.burn_coverage(token_id)
        ▼                             └── pm.notify_claim_payout(token_id)
  [PENDING] → ...`}</Pre>

        <Callout type="warning">
          Only the NFT owner can submit a claim. The claim references a specific token ID — each
          NFT can only have one pending claim at a time. After rejection, the same NFT can be
          re-submitted.
        </Callout>

        <Divider />

        <H2 id="vault-factory">InsuranceVaultFactory</H2>
        <P>
          Deploys the full per-protocol contract stack in a single transaction. Given a
          protocol ID and underlying asset address, it uses Cairo&apos;s <Code>deploy_syscall</Code>{" "}
          to instantiate all three contracts atomically and wire the vault into the registry.
        </P>

        <Pre>{`factory.create_vault(protocol_id, name, symbol, underlying_asset)
    │
    ├── deploy_syscall ──► LstVault
    ├── deploy_syscall ──► PremiumModule   (wired to vault + registry + USDC)
    ├── deploy_syscall ──► ClaimsManager  (wired to vault + PM + coverage token)
    └── registry.set_vault(protocol_id, vault_address)`}</Pre>

        <Callout type="warning">
          After <Code>create_vault</Code>, the admin must manually wire four more permissions
          before the protocol is live: <Code>vault.set_coverage_manager(pm)</Code>,{" "}
          <Code>vault.set_claims_manager(cm)</Code>,{" "}
          <Code>coverage_token.set_minter(pm)</Code>, and{" "}
          <Code>coverage_token.set_burner(cm)</Code>.
        </Callout>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            CROSS-CHAIN
        ════════════════════════════════════════════════════════ */}

        <H2 id="crosschain-overview">Cross-Chain Overview</H2>
        <P>
          STRK Insurance has a cross-chain extension built on{" "}
          <strong>LayerZero V2</strong>. Users on Base (EVM) interact with the{" "}
          <Code>BaseInsuranceHub</Code> — a send-only OApp — which encodes vault operations into
          LZ messages and delivers them to the <Code>InsuranceReceiver</Code> on Starknet.
        </P>

        <Pre>{`     BASE (EVM)                              STARKNET
┌──────────────────────┐              ┌────────────────────────┐
│                      │              │                        │
│  CoverageTokenBase   │              │  InsuranceReceiver     │
│  (ERC-721 on Base)   │              │  (LayerZero OApp)      │
│          │           │              │          │             │
│  BaseInsuranceHub    │──LayerZero──►│          ▼             │
│  (OApp sender)       │              │  vault.lock /          │
│                      │              │  unlock /              │
│  MSG_LOCK_COVERAGE   │              │  withdraw_for_payout   │
│  MSG_UNLOCK_COVERAGE │              │                        │
│  MSG_PAYOUT_CLAIM    │              └────────────────────────┘
└──────────────────────┘`}</Pre>

        <Divider />

        <H2 id="crosschain-evm">EVM Side — BaseInsuranceHub</H2>
        <P>
          A Solidity OApp on Base Sepolia. Users buy coverage here — paying USDC on Base and
          receiving an ERC-721 NFT on Base — while the actual vault capital locking happens on
          Starknet.
        </P>

        <Table
          headers={["Function", "Action"]}
          rows={[
            ["buyCoverage(protocolId, amount, duration, starknetAddr)", "Mints NFT on Base, sends MSG_LOCK to Starknet"],
            ["expireCoverage(tokenId)", "Burns NFT on Base, sends MSG_UNLOCK to Starknet"],
            ["submitClaim(tokenId)", "Creates claim record on Base"],
            ["approveClaim(claimId) [governor]", "Sends MSG_PAYOUT to Starknet, vault pays user's Starknet address"],
          ]}
        />

        <Divider />

        <H2 id="crosschain-starknet">Starknet Receiver</H2>
        <P>
          A Cairo OApp that receives LZ messages from Base and dispatches the corresponding vault
          call. It holds the <Code>COVERAGE_MANAGER_ROLE</Code> and{" "}
          <Code>CLAIMS_MANAGER_ROLE</Code> on the target vault.
        </P>

        <Table
          headers={["Message", "Starknet action"]}
          rows={[
            ["MSG_LOCK_COVERAGE (0x01)", "vault.lock_for_coverage(amount)"],
            ["MSG_UNLOCK_COVERAGE (0x02)", "vault.unlock_from_coverage(amount)"],
            ["MSG_PAYOUT_CLAIM (0x03)", "vault.withdraw_for_payout(user, amount)"],
          ]}
        />

        <Divider />

        <H2 id="message-encoding">Message Encoding</H2>
        <P>
          All cross-chain messages are packed byte arrays. Big-endian, 97 bytes total.
        </P>

        <Pre>{`LOCK / UNLOCK (97 bytes):
  [msg_type: 1 byte][protocol_id: 32 bytes][amount: 32 bytes][token_id: 32 bytes]

PAYOUT (97 bytes):
  [msg_type: 1 byte][protocol_id: 32 bytes][user_starknet_addr: 32 bytes][amount: 32 bytes]

Message type constants:
  0x01 = LOCK_COVERAGE
  0x02 = UNLOCK_COVERAGE
  0x03 = PAYOUT_CLAIM`}</Pre>

        <Divider />

        {/* ════════════════════════════════════════════════════════
            REFERENCE
        ════════════════════════════════════════════════════════ */}

        <H2 id="deployed-addresses">Deployed Addresses</H2>
        <H3>Starknet Sepolia</H3>
        <Table
          headers={["Contract", "Address"]}
          rows={[
            ["ProtocolRegistry", <code key="r" className="text-xs font-mono text-neutral-400">0x0493ff23ec196924e7facfba6b351b9e40c906c280f48dc1892b113b6442ad0a</code>],
            ["CoverageToken", <code key="ct" className="text-xs font-mono text-neutral-400">0x0648a1f37af0adeea21180c08e1ddd5002561f50cee547ed9bf56588153c9319</code>],
            ["InsuranceVaultFactory", <code key="f" className="text-xs font-mono text-neutral-400">0x0293d696a31a5755e5e625e83f797a8e9075037bd868f51d3eee8480a099fc02</code>],
            ["MockUSDC", <code key="u" className="text-xs font-mono text-neutral-400">0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a</code>],
            ["BTC-LST (xyBTC)", <code key="b" className="text-xs font-mono text-neutral-400">0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee</code>],
            ["LZ Endpoint", <code key="lz" className="text-xs font-mono text-neutral-400">0x0316d70a6e0445a58c486215fac8ead48d3db985acde27efca9130da4c675878</code>],
          ]}
        />

        <H3>Base Sepolia (cross-chain layer)</H3>
        <Table
          headers={["Contract", "Address"]}
          rows={[
            ["BaseInsuranceHub", <code key="hub" className="text-xs font-mono text-neutral-400">0x7F7e7B7C207a9d04aab64a577F8E131947F039A6</code>],
            ["CoverageTokenBase", <code key="ctb" className="text-xs font-mono text-neutral-400">0xBdDBbEB6ed923639cc6fa9948A86BF3dC9B43766</code>],
            ["InsuranceReceiver (Starknet)", <code key="ir" className="text-xs font-mono text-neutral-400">0x05c27127ef05482ec7c152aa51cceec19db933cc2c63ef5f212603ce821c21c8</code>],
            ["USDC (Base Sepolia)", <code key="ub" className="text-xs font-mono text-neutral-400">0x036CbD53842c5426634e7929541eC2318f3dCF7e</code>],
          ]}
        />

        <H3>LayerZero Chain IDs</H3>
        <Table
          headers={["Chain", "EID"]}
          rows={[
            ["Starknet Sepolia", "40500"],
            ["Base Sepolia", "40245"],
          ]}
        />

        <Divider />

        <H2 id="premium-formula">Premium Formula Reference</H2>
        <Pre>{`premium = coverage_amount × BTC_PRICE_USDC × rate × duration
          ─────────────────────────────────────────────────────────
               PRICE_PRECISION × RATE_DENOMINATOR × BASE_DURATION

Hardcoded constants (PremiumModule):
  BTC_PRICE_USDC    = 1,500 USDC  (1_500_000_000_000_000_000_000, 18 dec)
  PRICE_PRECISION   = 1e18
  RATE_DENOMINATOR  = 10,000      (basis points)
  BASE_DURATION     = 7,776,000 s (90 days)

Rate examples (basis points):
  250  →  2.5% per 90 days
  500  →  5.0% per 90 days
  1000 → 10.0% per 90 days

Coverage / premium examples at 5% rate, 90 days:
  1  BTC-LST →   $75 USDC
  10 BTC-LST →  $750 USDC
  100 BTC-LST → $7,500 USDC`}</Pre>
      </main>
    </div>
  );
}
