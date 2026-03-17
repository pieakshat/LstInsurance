"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ── Nav tree ──────────────────────────────────────────────────────────────────

const NAV = [
  {
    group: "Getting Started",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "concepts", label: "Core Concepts" },
    ],
  },
  {
    group: "Guides",
    items: [
      { id: "buy-coverage", label: "Buy Coverage" },
      { id: "provide-liquidity", label: "Provide Liquidity" },
      { id: "file-a-claim", label: "File a Claim" },
    ],
  },
  {
    group: "Protocol",
    items: [
      { id: "architecture", label: "Architecture" },
      { id: "cross-chain", label: "Cross-Chain" },
      { id: "security", label: "Security & Trust" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "faq", label: "FAQ" },
      { id: "developer", label: "Developer Reference" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

// ── Page content map ───────────────────────────────────────────────────────────

type PageId =
  | "introduction"
  | "concepts"
  | "buy-coverage"
  | "provide-liquidity"
  | "file-a-claim"
  | "architecture"
  | "cross-chain"
  | "security"
  | "faq"
  | "developer";

// ── Primitives ────────────────────────────────────────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-neutral-400 leading-[1.75] mb-4">{children}</p>;
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold text-white mb-1">{children}</h1>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white mt-10 mb-3">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-white mt-6 mb-2">{children}</h3>;
}

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[#E8704A] bg-[#E8704A]/10 text-[12px] px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#0d0f14] rounded-lg p-4 text-[12px] text-neutral-300 font-mono overflow-x-auto mb-5 leading-[1.7] whitespace-pre border border-white/5">
      {children}
    </pre>
  );
}

function Hint({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const border = { info: "border-blue-500/40", warning: "border-amber-500/40", tip: "border-[#E8704A]/40" };
  const text = { info: "text-blue-300", warning: "text-amber-300", tip: "text-[#E8704A]" };
  const label = { info: "Note", warning: "Warning", tip: "Tip" };
  return (
    <div className={`border-l-2 ${border[type]} pl-4 py-0.5 mb-5`}>
      <p className={`text-[12px] font-semibold uppercase tracking-wider mb-1 ${text[type]}`}>
        {label[type]}
      </p>
      <div className="text-[14px] text-neutral-400 leading-relaxed">{children}</div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto mb-5 rounded-lg border border-white/6">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/6 bg-white/2">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-[11px] text-neutral-500 font-semibold uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b border-white/4" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-neutral-300">
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

function Steps({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  return (
    <div className="mb-5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-white/15 flex items-center justify-center text-[11px] font-bold text-neutral-400">
            {i + 1}
          </div>
          <div>
            <p className="text-[14px] font-medium text-white mb-0.5">{item.title}</p>
            <div className="text-[14px] text-neutral-400 leading-relaxed">{item.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-neutral-400">{children}</span>;
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function PageIntroduction() {
  return (
    <>
      <H1>Introduction</H1>
      <p className="text-neutral-500 text-sm mb-8">Decentralized insurance for DeFi, underwritten by BTC Liquid Staking Tokens on Starknet.</p>

      <Prose>
        BitCover lets DeFi users buy on-chain coverage against smart contract exploits, and lets
        BTC-LST holders earn USDC yield by underwriting those policies.
      </Prose>
      <Prose>
        When you deposit into a lending protocol or liquidity pool, you carry real risk — bugs,
        oracle attacks, and exploits have cost the ecosystem hundreds of millions of dollars.
        BitCover is the safety net: pay a small USDC premium, receive a Coverage NFT, and get
        compensated in BTC-LST if the protocol you&apos;re insured against is exploited.
      </Prose>

      <Hint type="info">
        BitCover is live on <strong>Starknet Sepolia testnet</strong>. Full coverage, LP, and
        claims flows are functional. Mainnet is planned for a future release.
      </Hint>

      <H2>Who is it for?</H2>
      <DataTable
        headers={["Who", "What BitCover gives them"]}
        rows={[
          ["DeFi users", "Coverage against exploits on the protocols they use"],
          ["BTC-LST holders", "USDC yield on idle xyBTC by underwriting insurance pools"],
          ["Protocol teams", "A trust signal — point users to BitCover as evidence of safety"],
          ["Developers", "An open, composable insurance primitive"],
        ]}
      />

      {/* <H2>How it connects both sides</H2>
      <CodeBlock>{`Coverage buyers  →  pay USDC premium  →  receive Coverage NFT
                                           ↓
Liquidity providers  →  deposit BTC-LST  →  earn those USDC premiums
                                           ↓
On approved claim  →  vault pays BTC-LST to claimant  →  NFT burned`}</CodeBlock> */}

      <div className="mt-6 rounded-xl overflow-hidden border border-white/6 bg-[#0d0f14]">
        <Image
          src="/diagram-overview.svg"
          alt="BitCover protocol overview — DeFi user, BitCover protocol, and liquidity provider flows"
          width={780}
          height={528}
          className="w-full h-auto"
        />
      </div>
    </>
  );
}

function PageConcepts() {
  return (
    <>
      <H1>Core Concepts</H1>
      <p className="text-neutral-500 text-sm mb-8">The five building blocks of the protocol.</p>

      <H2>Coverage</H2>
      <Prose>
        A guarantee that if a specific DeFi protocol is exploited within your chosen time window,
        you&apos;ll be compensated up to the amount you covered. Each policy covers a single,
        named protocol — if you use three protocols, you need three separate policies.
      </Prose>
      <Prose>
        You choose: <strong>which protocol</strong>, <strong>how much</strong> (in BTC-LST terms),
        and <strong>for how long</strong> — 30, 60, 90, or 180 days.
      </Prose>

      <H2>Premiums</H2>
      <Prose>
        The USDC amount you pay upfront to activate coverage. Non-refundable once active.
        Premiums scale linearly with duration relative to the 90-day base period and the
        protocol&apos;s rate (set by governance in basis points).
      </Prose>
      <CodeBlock>{`premium = coverage_amount × BTC_price × rate × duration
          ──────────────────────────────────────────────────
          PRICE_PRECISION × RATE_DENOMINATOR × BASE_DURATION

BASE_DURATION = 7,776,000s (90 days)   RATE_DENOMINATOR = 10,000`}</CodeBlock>

      <H2>BTC-LST (xyBTC)</H2>
      <Prose>
        Tokenized staked Bitcoin — deposited by LPs as underwriting capital. BTC-LSTs are
        yield-bearing, so LPs earn staking yield on top of USDC premiums while their capital
        sits in the vault. Claims are paid out in BTC-LST, giving claimants a
        Bitcoin-denominated asset.
      </Prose>
      <Prose>
        On testnet, BitCover uses <strong>xyBTC</strong> from endurFi Finance on Starknet.
      </Prose>

      <H2>Liquidity Providers</H2>
      <Prose>
        LPs deposit BTC-LST into a protocol-specific vault and earn USDC premiums in return.
        Their capital is split into two buckets:
      </Prose>
      <DataTable
        headers={["Bucket", "Description"]}
        rows={[
          ["Locked", "Backing active policies — cannot be withdrawn until the policy expires or a claim is settled"],
          ["Available", "Free to withdraw at any time"],
        ]}
      />
      <Hint type="warning">
        The core LP risk is a claim payout. If an approved claim fires, BTC-LST is drawn from
        the vault proportionally. Higher-risk protocols carry higher premium rates to compensate.
      </Hint>

      <H2>The Coverage NFT</H2>
      <Prose>
        Every coverage purchase mints an ERC-721 NFT to your wallet. It encodes your policy
        on-chain: protocol covered, amount, start and end time, premium paid.
        <Ic>is_active(token_id)</Ic> returns <Ic>true</Ic> while inside the coverage window.
        Only active NFTs can file claims. The NFT is burned on payout or expiry.
      </Prose>
      <Prose>
        Because it&apos;s a standard NFT, coverage positions are transferable. Whoever holds the
        NFT at claim time receives the payout.
      </Prose>
    </>
  );
}

function PageBuyCoverage() {
  return (
    <>
      <H1>Buy Coverage</H1>
      <p className="text-neutral-500 text-sm mb-8">Protect a DeFi position in under two minutes.</p>

      <Hint type="info">
        You&apos;ll need testnet USDC. Use the{" "}
        <Link href="/app/faucet" className="underline">Faucet</Link> to mint MockUSDC before
        proceeding.
      </Hint>

      <Steps
        items={[
          {
            title: "Connect your wallet",
            body: "Click the wallet button (top-right) and connect Argent X or Braavos.",
          },
          {
            title: "Select a protocol",
            body: (
              <>
                Go to the <Link href="/app" className="underline">Dashboard</Link>. Each card is
                a registered DeFi protocol. Click to open its detail page.
              </>
            ),
          },
          {
            title: "Set amount and duration",
            body: "Enter the BTC-LST value you want covered and choose a duration. The USDC premium updates in real-time from the contract — no surprises.",
          },
          {
            title: "Approve & confirm",
            body: (
              <>
                Click <strong>Buy Cover</strong>. Two wallet prompts: first the USDC approval,
                then <Ic>buy_coverage</Ic>. Coverage is live the moment the tx confirms.
              </>
            ),
          },
        ]}
      />

      <H2>Coverage duration &amp; cost</H2>
      <DataTable
        headers={["Duration", "Multiplier", "Example (1 BTC-LST, 5% rate, BTC = $1,500)"]}
        rows={[
          ["30 days", "0.33×", "~$25 USDC"],
          ["60 days", "0.67×", "~$50 USDC"],
          ["90 days", "1× (base)", "$75 USDC"],
          ["180 days", "2×", "$150 USDC"],
        ]}
      />

      <H2>What is and isn&apos;t covered</H2>
      <DataTable
        headers={["Covered", "Not covered"]}
        rows={[
          ["Smart contract exploits", "Market losses (price drops)"],
          ["Oracle manipulation attacks", "Impermanent loss"],
          ["", "Rug pulls / admin fraud"],
          ["", "Protocols not listed on BitCover"],
        ]}
      />

      <Hint type="warning">
        Coverage is tied to a specific protocol address. Always verify you&apos;re buying for
        the exact protocol and version you&apos;re depositing into.
      </Hint>
    </>
  );
}

function PageProvideLiquidity() {
  return (
    <>
      <H1>Provide Liquidity</H1>
      <p className="text-neutral-500 text-sm mb-8">Earn USDC premiums on your BTC-LST holdings.</p>

      <Prose>
        Depositing BTC-LST into a BitCover vault makes you an underwriter. You earn USDC
        premiums from every policy sold on that vault, while your BTC-LST continues accruing
        staking yield from the underlying protocol.
      </Prose>

      <Steps
        items={[
          {
            title: "Go to the LP page",
            body: (
              <>
                Navigate to <Link href="/app/lp" className="underline">LP</Link> and select a
                vault.
              </>
            ),
          },
          {
            title: "Deposit BTC-LST",
            body: "Enter the amount and confirm. You receive vault shares proportional to your deposit.",
          },
          {
            title: "Checkpoint each epoch",
            body: (
              <>
                Once per epoch, click <strong>Checkpoint</strong>. This snapshots your share
                balance on-chain. <strong>You must do this</strong> to be eligible for that
                epoch&apos;s premiums — missing means forfeiting.
              </>
            ),
          },
          {
            title: "Claim premiums",
            body: "After governance advances the epoch, claim your pro-rata USDC from the LP page. Premiums are sent to your wallet immediately.",
          },
          {
            title: "Withdraw anytime",
            body: "Withdraw up to the vault's available liquidity (total assets − locked). If the vault is heavily utilised, wait for active policies to expire.",
          },
        ]}
      />

      <H2>How premiums are distributed</H2>
      <CodeBlock>{`your_payout = epoch_premiums[N] × your_shares / total_shares

Epoch timeline:
  LPs checkpoint()  →  premiums accumulate  →  advance_epoch()
  →  claim_premiums(N)`}</CodeBlock>

      <Hint type="warning">
        A portion of your deposit is locked at all times against active policies. You
        can&apos;t withdraw locked capital until the underlying policy expires or a claim is
        settled.
      </Hint>
    </>
  );
}

function PageFileAClaim() {
  return (
    <>
      <H1>File a Claim</H1>
      <p className="text-neutral-500 text-sm mb-8">Submit a claim if a covered protocol is exploited while your policy is active.</p>

      <Steps
        items={[
          {
            title: "Navigate to Submit a Claim",
            body: (
              <>
                Go to <Link href="/app/submit-claim" className="underline">Submit a Claim</Link>.
                Your active Coverage NFTs are listed automatically.
              </>
            ),
          },
          {
            title: "Select your NFT and submit",
            body: (
              <>
                Pick the affected position and click <strong>Submit Claim</strong>. This creates
                an on-chain record with status <Ic>PENDING</Ic>.
              </>
            ),
          },
          {
            title: "Wait for governor review",
            body: "Governors review pending claims in the Governance page, assessing off-chain evidence of the exploit.",
          },
          {
            title: "Approval — receive payout",
            body: "If approved, the vault sends BTC-LST to your wallet and your NFT is burned. Payout is automatic — no one can intercept it.",
          },
          {
            title: "Rejection — resubmit",
            body: "If rejected, your NFT is untouched. Resubmit as many times as needed while the policy is still active.",
          },
        ]}
      />

      <H2>Payout calculation</H2>
      <Prose>
        You receive BTC-LST equivalent in USD value to your covered amount, at the BTC price
        at time of payout:
      </Prose>
      <CodeBlock>{`payout (BTC-LST) = coverage_amount_USD / BTC_price_at_payout

Example: covered $1,500 worth, BTC at payout = $1,600
  → payout = $1,500 / $1,600 = 0.9375 BTC-LST`}</CodeBlock>

      <H2>Claim states</H2>
      <DataTable
        headers={["Status", "Meaning"]}
        rows={[
          ["Pending", "Submitted, awaiting governor review"],
          ["Approved", "Exploit confirmed — payout sent, NFT burned"],
          ["Rejected", "Does not meet coverage criteria — resubmit allowed"],
        ]}
      />

      <Hint type="tip">
        Gather evidence before submitting — transaction hashes, post-mortems, or announcements
        from the affected protocol strengthen your claim during review.
      </Hint>
    </>
  );
}

function PageArchitecture() {
  return (
    <>
      <H1>Architecture</H1>
      <p className="text-neutral-500 text-sm mb-8">How the contracts are structured and why.</p>

      <H2>Per-protocol isolation</H2>
      <Prose>
        Each insurable protocol gets its own isolated contract stack — vault, premium module, and
        claims manager — deployed atomically by the factory. Risk is fully siloed: a catastrophic
        claim on Protocol A cannot affect Protocol B&apos;s LPs.
      </Prose>
      <CodeBlock>{`InsuranceVaultFactory.create_vault(protocol_id, asset)
  ├── deploy → LstVault         (capital pool)
  ├── deploy → PremiumModule    (coverage sales + premium distribution)
  └── deploy → ClaimsManager   (claim lifecycle)`}</CodeBlock>

      <div className="my-6 rounded-xl overflow-hidden border border-white/6 bg-[#0d0f14]">
        <Image
          src="/diagram-starknet.svg"
          alt="BitCover Starknet protocol flow diagram"
          width={780}
          height={746}
          className="w-full h-auto"
        />
      </div>

      <H2>Contract overview</H2>
      <DataTable
        headers={["Contract", "Role"]}
        rows={[
          ["ProtocolRegistry", "Global directory of all insurable protocols — coverage caps, premium rates, active status"],
          ["LstVault", "ERC-4626 capital pool per protocol — tracks locked vs available liquidity, executes payouts"],
          ["PremiumModule", "Coverage purchase interface — accepts USDC, mints NFTs, locks vault capital, manages epochs"],
          ["ClaimsManager", "Claim lifecycle — submission, governor approve/reject, triggers vault payouts"],
          ["CoverageToken", "Singleton ERC-721 — issues policy NFTs for all protocols"],
          ["InsuranceVaultFactory", "Deploys the full per-protocol stack in one transaction"],
        ]}
      />

      <H2>Locked vs available liquidity</H2>
      <CodeBlock>{`available_liquidity = total_assets − locked_liquidity

buy_coverage()   → locked_liquidity ↑
policy expires   → locked_liquidity ↓
claim approved   → locked_liquidity ↓, BTC-LST leaves vault`}</CodeBlock>
    </>
  );
}

function PageCrossChain() {
  return (
    <>
      <H1>Cross-Chain</H1>
      <p className="text-neutral-500 text-sm mb-8">Buy coverage on Base — backed by vault capital on Starknet.</p>

      <Prose>
        The BitCover vaults live on Starknet, but many DeFi users operate on EVM chains like
        Base. The cross-chain extension — built on <strong>LayerZero V2</strong> — lets Base
        users buy coverage without ever managing a Starknet wallet.
      </Prose>

      <H2>Message flow</H2>
      <CodeBlock>{`User on Base
  │  buyCoverage(protocolId, amount, duration, starknetAddr)
  ├── pays USDC on Base, mints NFT on Base
  └── sends MSG_LOCK ──► LayerZero ──► Starknet
                                         vault.lock_for_coverage(amount)

On approved claim:
  ├── sends MSG_PAYOUT ──► LayerZero ──► Starknet
                                          vault.withdraw_for_payout(starknetAddr, amount)`}</CodeBlock>

      <div className="my-6 rounded-xl overflow-hidden border border-white/6 bg-[#0d0f14]">
        <Image
          src="/diagram-crosschain.svg"
          alt="BitCover cross-chain flow diagram"
          width={780}
          height={900}
          className="w-full h-auto"
        />
      </div>

      <H2>Base vs Starknet — key differences</H2>
      <DataTable
        headers={["", "Starknet", "Base"]}
        rows={[
          ["Premium", "USDC on Starknet", "USDC on Base"],
          ["Coverage NFT", "ERC-721 on Starknet", "ERC-721 on Base"],
          ["Claim payout", "BTC-LST to Starknet wallet", "BTC-LST to a Starknet address you provide at purchase"],
          ["Vault interaction", "Direct", "Via LayerZero V2"],
        ]}
      />

      <Hint type="warning">
        When buying from Base, provide a Starknet address at purchase time — this is where any
        BTC-LST payout will be sent.
      </Hint>

      <H2>Message types</H2>
      <DataTable
        headers={["Type", "Byte", "Action"]}
        rows={[
          ["MSG_LOCK_COVERAGE", "0x01", "vault.lock_for_coverage(amount)"],
          ["MSG_UNLOCK_COVERAGE", "0x02", "vault.unlock_from_coverage(amount)"],
          ["MSG_PAYOUT_CLAIM", "0x03", "vault.withdraw_for_payout(user, amount)"],
        ]}
      />
    </>
  );
}

function PageSecurity() {
  return (
    <>
      <H1>Security &amp; Trust</H1>
      <p className="text-neutral-500 text-sm mb-8">What is trustless, and where governance is involved.</p>

      <H2>Fully on-chain</H2>
      <Prose>These actions require no trust in any individual or organisation:</Prose>
      <DataTable
        headers={["Action", "How"]}
        rows={[
          ["Buy coverage", "Premium, capital lock, and NFT mint happen atomically in one tx"],
          ["LP deposits / withdrawals", "No intermediary, no custodian"],
          ["Claim payout", "Once approved, executes on-chain automatically — cannot be redirected"],
          ["Coverage expiry", "Anyone can call expire_coverage once a policy's end_time passes"],
        ]}
      />

      <H2>Requires governance</H2>
      <Prose>These actions rely on the governor multisig:</Prose>
      <DataTable
        headers={["Action", "Who"]}
        rows={[
          ["Claim adjudication", "Governors review off-chain evidence and call approve or reject"],
          ["Protocol registration", "Governance lists protocols and sets coverage caps and rates"],
          ["Protocol pausing", "Governance can pause coverage sales on a specific protocol"],
        ]}
      />
      <Hint type="warning">
        Claim adjudication is the most significant trust assumption. Governors cannot move funds
        directly — only approve or reject submitted claims. But the approval itself is off-chain.
      </Hint>

      <H2>Vault roles</H2>
      <DataTable
        headers={["Role", "Permissions"]}
        rows={[
          ["Owner", "Pause vault, set deposit limits, assign roles"],
          ["Pauser", "Pause / unpause vault"],
          ["Coverage Manager", "lock_for_coverage, unlock_from_coverage — assigned to PremiumModule"],
          ["Claims Manager", "withdraw_for_payout — assigned to ClaimsManager contract"],
        ]}
      />

      <Hint type="info">
        A formal security audit is planned before mainnet. Treat all testnet contracts as
        experimental.
      </Hint>
    </>
  );
}

function PageFAQ() {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "Is my coverage guaranteed?",
      a: "Payouts are backed by real BTC-LST locked in the vault. Coverage caps ensure the vault is never overextended. In an extreme scenario where multiple large claims fire simultaneously, payouts are processed in approval order.",
    },
    {
      q: "Can I cancel coverage early?",
      a: "No — premiums are non-refundable and coverage cannot be cancelled. Simply let it expire; locked vault capital is freed automatically.",
    },
    {
      q: "Can I transfer my Coverage NFT?",
      a: "Yes. It's a standard ERC-721. Whoever holds the NFT at claim submission time receives the payout if approved.",
    },
    {
      q: "What happens if a claim is rejected?",
      a: "Your NFT is untouched. You can resubmit as many times as you like while the policy is still active.",
    },
    {
      q: "Must I call checkpoint() every epoch?",
      a: "Yes. Missing a checkpoint for an epoch means forfeiting that epoch's premiums, even if you held vault shares throughout.",
    },
    {
      q: "Do I need a Starknet wallet to use BitCover?",
      a: "For purchases on Starknet, yes. For the Base cross-chain extension, only an EVM wallet is needed for purchase — but you'll still need to provide a Starknet address to receive any BTC-LST payout.",
    },
    {
      q: "What is xyBTC?",
      a: "xyBTC is a BTC Liquid Staking Token from endurFi Finance on Starknet. It represents staked Bitcoin and continues to accrue staking yield. It's the underwriting asset BitCover uses on testnet.",
    },
    {
      q: "What happens to LP premiums if a claim is approved?",
      a: "Already-distributed premiums are not clawed back. The claim payout comes from locked BTC-LST capital, not from previously distributed USDC.",
    },
  ];

  return (
    <>
      <H1>FAQ</H1>
      <p className="text-neutral-500 text-sm mb-8">Frequently asked questions.</p>

      <div className="space-y-7">
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-[15px] font-semibold text-white mb-1.5">{item.q}</p>
            <p className="text-[14px] text-neutral-400 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function PageDeveloper() {
  return (
    <>
      <H1>Developer Reference</H1>
      <p className="text-neutral-500 text-sm mb-8">Addresses, constants, and key functions.</p>

      <H2>Starknet Sepolia</H2>
      <DataTable
        headers={["Contract", "Address"]}
        rows={[
          ["ProtocolRegistry", <Mono key="r">0x0493ff23ec196924e7facfba6b351b9e40c906c280f48dc1892b113b6442ad0a</Mono>],
          ["CoverageToken", <Mono key="ct">0x0648a1f37af0adeea21180c08e1ddd5002561f50cee547ed9bf56588153c9319</Mono>],
          ["InsuranceVaultFactory", <Mono key="f">0x0293d696a31a5755e5e625e83f797a8e9075037bd868f51d3eee8480a099fc02</Mono>],
          ["MockUSDC", <Mono key="u">0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a</Mono>],
          ["BTC-LST (xyBTC)", <Mono key="b">0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee</Mono>],
        ]}
      />

      <H2>Base Sepolia</H2>
      <DataTable
        headers={["Contract", "Address"]}
        rows={[
          ["BaseInsuranceHub", <Mono key="hub">0x7F7e7B7C207a9d04aab64a577F8E131947F039A6</Mono>],
          ["CoverageTokenBase", <Mono key="ctb">0xBdDBbEB6ed923639cc6fa9948A86BF3dC9B43766</Mono>],
          ["InsuranceReceiver", <Mono key="ir">0x05c27127ef05482ec7c152aa51cceec19db933cc2c63ef5f212603ce821c21c8</Mono>],
          ["USDC (Base Sepolia)", <Mono key="ub">0x036CbD53842c5426634e7929541eC2318f3dCF7e</Mono>],
        ]}
      />

      <H2>LayerZero EIDs</H2>
      <DataTable
        headers={["Chain", "EID"]}
        rows={[["Starknet Sepolia", "40500"], ["Base Sepolia", "40245"]]}
      />

      <H2>Duration constants</H2>
      <DataTable
        headers={["Label", "Seconds", "vs 90-day base"]}
        rows={[
          ["30 days", "2,592,000", "0.33×"],
          ["60 days", "5,184,000", "0.67×"],
          ["90 days", "7,776,000", "1× (base)"],
          ["180 days", "15,552,000", "2×"],
        ]}
      />

      <H2>Premium formula</H2>
      <CodeBlock>{`premium = coverage_amount × BTC_PRICE_USDC × rate × duration
          ─────────────────────────────────────────────────────────
               PRICE_PRECISION × RATE_DENOMINATOR × BASE_DURATION

BTC_PRICE_USDC  = 1,500e18    PRICE_PRECISION = 1e18
RATE_DENOMINATOR = 10,000     BASE_DURATION   = 7,776,000s`}</CodeBlock>

      <H2>Onboarding a new protocol</H2>
      <CodeBlock>{`# 1. Register in registry
sncast invoke --contract-address $REGISTRY --function register_protocol \\
  --calldata $PROTOCOL_ADDR 0x0 $CAP_LOW $CAP_HIGH $PREMIUM_RATE

# 2. Deploy vault stack via factory
sncast invoke --contract-address $FACTORY --function create_vault \\
  --calldata $PROTOCOL_ID 0 '"Vault Name"' '"SYMBOL"' $LSTBTC_ADDR

# 3. Wire permissions (get PM + CM from factory events)
sncast invoke --contract-address $VAULT     --function set_coverage_manager --calldata $PM
sncast invoke --contract-address $VAULT     --function set_claims_manager   --calldata $CM
sncast invoke --contract-address $COV_TOKEN --function set_minter           --calldata $PM
sncast invoke --contract-address $COV_TOKEN --function set_burner           --calldata $CM
sncast invoke --contract-address $PM        --function set_claims_manager   --calldata $CM`}</CodeBlock>

      <H2>Key functions</H2>
      <H3>PremiumModule</H3>
      <DataTable
        headers={["Function", "Description"]}
        rows={[
          [<Ic key="bc">buy_coverage(amount, duration)</Ic>, "Pay premium, mint NFT, lock vault capital"],
          [<Ic key="pc">preview_cost(amount, duration)</Ic>, "View — returns USDC cost with no state change"],
          [<Ic key="cp">checkpoint()</Ic>, "Record LP share balance for current epoch"],
          [<Ic key="cl">claim_premiums(epoch)</Ic>, "Withdraw earned USDC for a finalised epoch"],
          [<Ic key="ae">advance_epoch()</Ic>, "Governance — finalise epoch, open next"],
          [<Ic key="ec">expire_coverage(token_id)</Ic>, "Anyone — unlock capital after policy expiry"],
        ]}
      />
      <H3>ClaimsManager</H3>
      <DataTable
        headers={["Function", "Description"]}
        rows={[
          [<Ic key="sc">submit_claim(token_id)</Ic>, "NFT owner submits a claim"],
          [<Ic key="ac">approve_claim(claim_id)</Ic>, "Governor — triggers payout, burns NFT"],
          [<Ic key="rc">reject_claim(claim_id)</Ic>, "Governor — sets status to rejected"],
        ]}
      />
    </>
  );
}

const PAGES: Record<PageId, React.ReactNode> = {
  introduction: <PageIntroduction />,
  concepts: <PageConcepts />,
  "buy-coverage": <PageBuyCoverage />,
  "provide-liquidity": <PageProvideLiquidity />,
  "file-a-claim": <PageFileAClaim />,
  architecture: <PageArchitecture />,
  "cross-chain": <PageCrossChain />,
  security: <PageSecurity />,
  faq: <PageFAQ />,
  developer: <PageDeveloper />,
};

// ── Root ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [page, setPage] = useState<PageId>("introduction");

  const currentIndex = ALL_ITEMS.findIndex((i) => i.id === page);
  const prev = currentIndex > 0 ? ALL_ITEMS[currentIndex - 1] : null;
  const next = currentIndex < ALL_ITEMS.length - 1 ? ALL_ITEMS[currentIndex + 1] : null;

  // Scroll content to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div className="flex gap-0 max-w-5xl mx-auto">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:block w-56 shrink-0 pr-8">
        <div className="sticky top-24 space-y-6">
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest mb-1 px-2">
                {group.group}
              </p>
              <div className="space-y-px">
                {group.items.map((item) => {
                  const active = page === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPage(item.id as PageId)}
                      className={`w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors ${active
                          ? "text-white font-medium"
                          : "text-neutral-500 hover:text-neutral-300"
                        }`}
                    >
                      {active && (
                        <span className="inline-block w-1 h-1 rounded-full bg-[#E8704A] mr-2 mb-0.5" />
                      )}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 min-w-0 max-w-2xl">
        <div className="min-h-[60vh]">
          {PAGES[page]}
        </div>

        {/* Prev / Next */}
        <div className="flex justify-between mt-12 pt-6 border-t border-white/6">
          {prev ? (
            <button
              onClick={() => setPage(prev.id as PageId)}
              className="flex flex-col items-start gap-0.5 text-left group"
            >
              <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Previous</span>
              <span className="text-[14px] text-neutral-400 group-hover:text-white transition-colors">
                ← {prev.label}
              </span>
            </button>
          ) : <div />}

          {next ? (
            <button
              onClick={() => setPage(next.id as PageId)}
              className="flex flex-col items-end gap-0.5 text-right group"
            >
              <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Next</span>
              <span className="text-[14px] text-neutral-400 group-hover:text-white transition-colors">
                {next.label} →
              </span>
            </button>
          ) : <div />}
        </div>
      </main>
    </div>
  );
}
