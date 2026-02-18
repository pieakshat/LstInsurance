📄 PRD — BTC-LST Insurance Infrastructure

⸻

1. Overview

Build a DeFi insurance infrastructure on Starknet where:
	•	Liquidity providers deposit BTC-LST into protocol-specific ERC-4626 vaults.
	•	Each vault underwrites risk for a single partner protocol.
	•	Vault capital is automatically locked when coverage is sold and unlocked when it expires or is claimed.
	•	Users pay one-time premiums for insurance.
	•	Premiums flow only to LPs underwriting that protocol.
	•	In the event of a hack, insured users claim payouts via Merkle proofs from the relevant vault.

⸻

2. Goals
	•	Yield-backed underwriting using BTC-LST.
	•	Protocol-isolated solvency pools.
	•	LP-selected risk exposure.
	•	Tokenized insurance coverage.
	•	Scalable claims via Merkle snapshots.
	•	Fully on-chain solvency + payout accounting.

⸻

3. Actors

Liquidity Providers (LPs)

Deposit BTC-LST into protocol vaults.

Earn:
	•	Native BTC-LST yield
	•	Protocol insurance premiums (proportional to vault shares)

All deposited capital automatically backs coverage — no manual locking required.

⸻

Protocol Partners

Integrate insurance infra for their users.

Define:
	•	Coverage parameters
	•	Premium pricing
	•	Coverage conditions

⸻

Insured Users

Purchase coverage on protocol positions.

Receive coverage tokens representing claim rights.

⸻

Mediator / Resolver

Approves incidents and submits loss snapshots.

⸻

4. System Architecture

⸻

4.1 Vault Factory

Deploys protocol-specific solvency vaults.

Functions
	•	createVault(protocol_id, asset)
	•	getVault(protocol_id)
	•	isValidVault(address)

Notes
	•	One vault per protocol.
	•	Prevents risk cross-contamination.

⸻

4.2 Protocol Insurance Vault (ERC-4626)

Solvency pool backing a single protocol.

Functions
	•	deposit()
	•	withdraw()
	•	set_coverage_manager(manager)
	•	lock_for_coverage(amount) — called by Premium Module
	•	unlock_from_coverage(amount) — called by Premium Module
	•	withdraw_for_payout()
	•	totalAssets()

Notes
	•	Holds BTC-LST only.
	•	Yield accrues via LST appreciation.
	•	Capital is locked automatically when coverage is sold (demand-driven).
	•	All deposited capital can back coverage — no manual LP locking step.

⸻

4.3 Demand-Based Capital Locking

Capital is locked automatically by the Premium Module when coverage is purchased, and unlocked when coverage expires or is claimed. LPs do not manually lock.

Lock Lifecycle
	•	buy_coverage() → Premium Module calls vault.lock_for_coverage(coverage_amount)
	•	expire_coverage() → Premium Module calls vault.unlock_from_coverage(amount)
	•	approve_claim() → Claims Manager pays out (vault reduces locked_liquidity), then notifies Premium Module

Rules
	•	Locked capital cannot be withdrawn by LPs.
	•	Premium rewards accrue to all depositors proportional to vault shares.
	•	LPs can withdraw any unlocked portion at any time.

⸻

4.4 Premium Vault (Per Protocol)

Treasury holding premiums for each protocol.

Functions
	•	Receive premium payments
	•	Track accrual
	•	Distribute rewards to LPs proportional to vault shares

Optional: Can be merged into vault accounting.

⸻

4.5 Coverage Token

Represents insurance entitlement.

Standard

ERC-721 or ERC-1155.

Metadata
	•	protocol_id
	•	coverage_amount
	•	start_time
	•	end_time
	•	premium_paid
	•	risk_type

Minted on premium purchase.

Burned on expiry or full claim.

⸻

4.6 Protocol Registry

Manages partner onboarding.

Functions
	•	registerProtocol()
	•	setCoverageParams()
	•	pauseProtocol()

Stored Parameters
	•	Coverage caps
	•	Premium rates
	•	Covered risks
	•	Claim conditions

⸻

4.7 Premium Purchase Module

Handles coverage sales.

Flow
	1.	User selects protocol.
	2.	Chooses coverage amount + duration.
	3.	Pays premium.
	4.	Coverage token minted.
	5.	Premium routed to protocol premium vault.
	6.	Premium Module calls vault.lock_for_coverage(coverage_amount) — capital locked automatically.

⸻

4.8 Resolution Module

Confirms insurance incidents.

Triggers
	•	Multisig
	•	Oracle
	•	Governance vote

Functions
	•	reportIncident(protocol_id)
	•	approveIncident()
	•	rejectIncident()

Outputs incident_id.

⸻

4.9 Loss Snapshot Engine (Off-Chain)

Computes claimable losses.

Responsibilities
	•	Compute user losses.
	•	Validate coverage.
	•	Apply coverage caps.
	•	Adjust for insolvency if needed.

Outputs
	•	Merkle root
	•	Claim proofs

⸻

4.10 Claim Manager (Pull-Based)

Verifies claims via Merkle proofs.

Storage
	•	incident_id → merkle_root
	•	Claimed bitmap

Functions
	•	submitMerkleRoot()
	•	claim(amount, proof)
	•	isClaimed()

Users claim individually.

⸻

4.11 Payout Manager

Executes liquidity payouts.

Flow
	1.	Claim verified.
	2.	Identify protocol vault.
	3.	Withdraw liquidity.
	4.	Transfer to user.

⸻

5. System Workflows

⸻

5.1 Vault Deployment Flow
	1.	Protocol approved.
	2.	Factory deploys vault.
	3.	Vault configured.
	4.	LP deposits open.

⸻

5.2 LP Deposit Flow
	1.	LP deposits BTC-LST.
	2.	Shares minted.
	3.	LP checkpoints in premium module (once per epoch to earn premiums).
	4.	Deposited capital automatically backs future coverage purchases.

⸻

5.3 Coverage Purchase Flow
	1.	User deposits in partner protocol.
	2.	Buys insurance.
	3.	Pays premium.
	4.	Coverage token minted.
	5.	Premium routed.
	6.	Liquidity locked.

⸻

5.4 Premium Distribution Flow

Premiums distributed per vault:

reward =
  protocol_premiums
* (lp_shares / total_vault_shares)

All depositors earn premiums proportional to their vault share balance.

⸻

5.5 Incident & Claims Flow
	1.	Hack occurs.
	2.	Resolution Module approves.
	3.	Loss snapshot computed.
	4.	Merkle root submitted.
	5.	Users claim individually.
	6.	Vault pays payouts.

⸻

6. Data Structures

⸻

Coverage Position

struct Coverage {
  protocol_id
  coverage_amount
  start_time
  end_time
  premium_paid
}


⸻

Incident

struct Incident {
  protocol_id
  merkle_root
  timestamp
  resolved
}


⸻

7. Risk Controls
	•	Coverage caps per vault.
	•	Demand-based capital locking (automatic lock/unlock tied to coverage lifecycle).
	•	Coverage expiry enforcement.
	•	Double-claim prevention.
	•	Vault deposit caps.
	•	Incident pause controls.
	•	Insolvency ratio adjustments.

⸻

8. Economic Model

⸻

LP Yield Sources
	•	BTC-LST native yield.
	•	Insurance premiums (proportional to vault shares).

All depositors earn premiums — no manual locking required.

⸻

Loss Socialization

Losses affect only LPs in that protocol vault.

Share price decreases after payouts.

---

## 9. System Flowcharts

### 9.1 Contract Architecture

```
                         ┌──────────────────┐
                         │    Governance     │
                         └────────┬─────────┘
                                  │ registers protocols
                                  │ sets coverage params
                                  ▼
┌───────────────────┐    ┌──────────────────┐    ┌───────────────────────┐
│                   │    │                  │    │                       │
│   Vault Factory   │───▶│ Protocol Registry│◀───│    Premium Module     │
│                   │    │                  │    │    (per protocol)     │
└────────┬──────────┘    └──────────────────┘    └───┬──────────┬───────┘
         │ deploys                                   │          │
         │ vault + premium module                    │          │
         ▼                                           │          │
┌───────────────────┐          reads params ─────────┘          │
│                   │          & checks active                  │
│   LST Vault       │◀─────────────────────────────────────────┘
│   (ERC-4626)      │    lock/unlock capital for coverage       │
│                   │    reads shares for premium distribution  │
└───────┬───────────┘                                           │
        │                                                       │ mints
        │ holds BTC-LST                                         ▼
        │ issues shares                              ┌───────────────────┐
        ▼                                            │                   │
┌───────────────────┐                                │  Coverage Token   │
│                   │                                │  (ERC-721 NFT)    │
│   BTC-LST Token   │                                │                   │
│   (ERC-20)        │                                └───────────────────┘
│                   │
└───────────────────┘
```

### 9.2 LP Deposit & Underwriting Flow

```
    LP                    BTC-LST Token         LST Vault         Premium Module
    │                          │                    │                    │
    │  1. approve(vault, amt)  │                    │                    │
    │─────────────────────────▶│                    │                    │
    │                          │                    │                    │
    │  2. deposit(assets, LP)  │                    │                    │
    │──────────────────────────┼───────────────────▶│                    │
    │                          │                    │                    │
    │                          │  3. transferFrom   │                    │
    │                          │◀───────────────────│                    │
    │                          │    (LP → vault)    │                    │
    │                          │                    │                    │
    │  4. vault shares minted  │                    │                    │
    │◀─────────────────────────┼────────────────────│                    │
    │                          │                    │                    │
    │  5. checkpoint()         │                    │                    │
    │──────────────────────────┼────────────────────┼───────────────────▶│
    │                          │                    │                    │
    │  6. LPCheckpointed event │                    │                    │
    │◀─────────────────────────┼────────────────────┼────────────────────│
    │                          │                    │                    │
    │        LP is now underwriting and earning premiums                 │
    │        (capital auto-locked when coverage is purchased)            │
```

### 9.3 Coverage Purchase Flow

```
    User              Premium Token       Premium Module    Coverage Token     Registry       Vault
     │                  (USDC)                 │                 │               │              │
     │                                         │  1. is_active?  │               │              │
     │  buy_coverage(amount, duration)         │────────────────┼──────────────▶│              │
     │────────────────────────────────────────▶│                │               │              │
     │                                         │  2. get params │               │              │
     │                                         │────────────────┼──────────────▶│              │
     │                                         │◀───────────────┼───────────────│              │
     │                                         │  (premium_rate,│coverage_cap)  │              │
     │                                         │                │               │              │
     │                                         │ 3. compute     │               │              │
     │                                         │    premium     │               │              │
     │                                         │                │               │              │
     │                  4. transferFrom         │                │               │              │
     │                  (user → PM, premium)    │                │               │              │
     │                 ─────────────────────────│                │               │              │
     │                                         │                │               │              │
     │                                         │ 5. mint_coverage               │              │
     │                                         │───────────────▶│               │              │
     │                                         │                │               │              │
     │                                         │ 6. lock_for_coverage(amount)   │              │
     │                                         │────────────────┼───────────────┼─────────────▶│
     │                                         │                │               │              │
     │            7. Coverage NFT minted        │                │               │              │
     │◀─────────────────────────────────────────┼────────────────│               │              │
     │                                         │                │               │              │
     │        NFT contains:                    │                │               │              │
     │        - protocol_id                    │     Vault capital now locked    │              │
     │        - coverage_amount                │     for this coverage amount    │              │
     │        - start_time / end_time          │                │               │              │
     │        - premium_paid                   │                │               │              │
```

### 9.4 Epoch Lifecycle & Premium Distribution

```
    ┌─────────────────────── EPOCH N ───────────────────────┐
    │                                                       │
    │  ┌─────────┐   ┌──────────────┐   ┌───────────────┐  │
    │  │  LPs    │   │   Users buy  │   │  Premiums     │  │
    │  │  call   │   │   coverage   │   │  accumulate   │  │
    │  │ check-  │   │   (pay USDC) │   │  in pending_  │  │
    │  │  point  │   │              │   │  premiums     │  │
    │  └─────────┘   └──────────────┘   └───────────────┘  │
    │                                                       │
    └───────────────────────┬───────────────────────────────┘
                            │
                   governance calls
                   advance_epoch()
                            │
                            ▼
    ┌───────────────────────────────────────────────────────┐
    │                   EPOCH FINALIZED                     │
    │                                                       │
    │  - pending_premiums → epoch_premiums_collected[N]     │
    │  - vault.total_supply() → epoch_total_shares[N]      │
    │  - pending_premiums reset to 0                        │
    │  - current_epoch = N + 1                              │
    └───────────────────────┬───────────────────────────────┘
                            │
                            ▼
    ┌─────────────────────── CLAIMS ────────────────────────┐
    │                                                       │
    │  LP calls claim_premiums(epoch = N)                   │
    │                                                       │
    │  payout = epoch_premiums[N]                           │
    │           * lp_checkpoint[N]                          │
    │           / epoch_total_shares[N]                     │
    │                                                       │
    │  ┌──────────┐    payout    ┌────────┐                 │
    │  │ Premium  │─────────────▶│   LP   │                 │
    │  │ Module   │   (USDC)     │        │                 │
    │  └──────────┘              └────────┘                 │
    │                                                       │
    └───────────────────────────────────────────────────────┘
```

### 9.5 Incident & Claims Flow (Merkle-Based)

```
    Hack occurs
        │
        ▼
    ┌──────────────────┐
    │ Resolution Module │
    │ reportIncident()  │
    │ approveIncident() │
    └────────┬─────────┘
             │ incident_id
             ▼
    ┌──────────────────┐
    │ Loss Snapshot    │  (off-chain)
    │ Engine           │
    │                  │
    │ - compute losses │
    │ - validate NFTs  │
    │ - apply caps     │
    └────────┬─────────┘
             │ merkle_root + proofs
             ▼
    ┌──────────────────┐         ┌──────────────────┐
    │  Claim Manager   │         │    LST Vault      │
    │                  │         │                    │
    │ submitMerkle     │         │ withdraw_for_      │
    │   Root()         │────────▶│   payout()         │
    │                  │         │                    │
    │ claim(amt,proof) │         │ BTC-LST ──▶ user  │
    │                  │         │                    │
    └──────────────────┘         └──────────────────┘

    User claims:
    ┌────────┐  claim(amount, proof)  ┌──────────────┐  withdraw  ┌───────────┐
    │  User  │───────────────────────▶│Claim Manager │──────────▶│ LST Vault │
    │        │◀───────────────────────│verify merkle │           │           │
    │        │    BTC-LST payout      │mark claimed  │           │           │
    └────────┘                        └──────────────┘           └───────────┘
```

### 9.6 Full System Flow (End-to-End)

```
    ┌─────────┐         ┌──────────┐         ┌───────────┐
    │Governance│         │   LPs    │         │  Users    │
    └────┬────┘         └────┬─────┘         └─────┬─────┘
         │                   │                     │
    1. register              │                     │
       protocol              │                     │
         │                   │                     │
    2. factory               │                     │
       creates               │                     │
       vault +               │                     │
       premium               │                     │
       module                │                     │
         │                   │                     │
         │              3. deposit                 │
         │                 BTC-LST                 │
         │                 into vault              │
         │                   │                     │
         │              4. checkpoint              │
         │                 in premium              │
         │                 module                  │
         │                   │                     │
         │                   │                5. buy coverage
         │                   │                   pay premium
         │                   │                   receive NFT
         │                   │                   (vault capital
         │                   │                    auto-locked)
         │                   │                     │
    6. advance               │                     │
       epoch                 │                     │
         │                   │                     │
         │              7. claim                   │
         │                 premiums                │
         │                 (USDC)                  │
         │                   │                     │
         │                   │                     │
    ─ ─ ─ ─ ─ ─ ─ ─ IF HACK OCCURS ─ ─ ─ ─ ─ ─ ─
         │                   │                     │
    8. approve               │                     │
       incident              │                     │
         │                   │                     │
    9. submit                │                     │
       merkle root           │                     │
         │                   │                     │
         │                   │               10. claim payout
         │                   │                   via merkle
         │                   │                   proof
         │                   │                     │
         │              LP vault shares            │
         │              decrease in value           │
         │              (loss socialization)        │
         ▼                   ▼                     ▼
```

