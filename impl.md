📄 PRD — BTC-LST Insurance Infrastructure

⸻

1. Overview

Build a DeFi insurance infrastructure on Starknet where:
	•	Liquidity providers deposit BTC-LST into protocol-specific ERC-4626 vaults.
	•	Each vault underwrites risk for a single partner protocol.
	•	Vault capital is automatically locked when coverage is sold and unlocked when it expires or is claimed.
	•	Users pay one-time premiums in USDC for insurance.
	•	Premiums flow only to LPs underwriting that protocol.
	•	In the event of a hack, insured users submit on-chain claims via their Coverage NFT; governors approve/reject payouts from the vault.

⸻

2. Goals
	•	Yield-backed underwriting using BTC-LST.
	•	Protocol-isolated solvency pools.
	•	LP-selected risk exposure.
	•	Tokenized insurance coverage.
	•	On-chain claim submission and governor-approved payouts.
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

Receive coverage tokens (ERC-721 NFTs) representing claim rights.

Pay premiums in USDC.

⸻

Governors

Whitelisted wallets (added via `claims_manager.add_governor()`) that review submitted claims off-chain and call `approve_claim` or `reject_claim` on-chain.

⸻

4. System Architecture

⸻

4.1 Vault Factory

Deploys protocol-specific solvency vaults, premium modules, and claims managers in a single call.

Functions
	•	`create_vault(protocol_id, name, symbol, underlying_asset)` — deploys Vault + PremiumModule + ClaimsManager atomically
	•	`get_vault(protocol_id)`
	•	`get_premium_module(protocol_id)`
	•	`get_claims_manager(protocol_id)`
	•	`set_vault_class_hash`, `set_premium_class_hash`, `set_claims_class_hash`

Constructor
	`InsuranceVaultFactory(registry, vault_class_hash, premium_class_hash, claims_class_hash, coverage_token, premium_asset, owner)`

Notes
	•	One vault + premium module + claims manager per protocol.
	•	Prevents risk cross-contamination.
	•	`premium_asset` (e.g. USDC) is stored on the factory and passed to each PremiumModule at deploy time.
	•	After `create_vault`, admin must manually wire roles (MINTER, BURNER, COVERAGE_MANAGER, CLAIMS_MANAGER, GOVERNOR) via the admin panel.

⸻

4.2 Protocol Insurance Vault (ERC-4626)

Solvency pool backing a single protocol.

Functions
	•	`deposit()`
	•	`withdraw()`
	•	`set_coverage_manager(manager)` — grants COVERAGE_MANAGER_ROLE to PremiumModule
	•	`set_claims_manager(manager)` — grants CLAIMS_MANAGER_ROLE to ClaimsManager
	•	`lock_for_coverage(amount)` — called by PremiumModule on buy_coverage
	•	`unlock_from_coverage(amount)` — called by PremiumModule on expiry/payout
	•	`withdraw_for_payout(to, amount)` — called by ClaimsManager on approve_claim
	•	`total_assets()`, `total_locked_liquidity()`, `total_payouts()`

Notes
	•	Holds BTC-LST only.
	•	Yield accrues via LST appreciation.
	•	Capital is locked automatically when coverage is sold.
	•	All deposited capital can back coverage — no manual LP locking step.

⸻

4.3 Demand-Based Capital Locking

Capital is locked automatically by the Premium Module when coverage is purchased, and unlocked when coverage expires or a claim is paid out.

Lock Lifecycle
	•	`buy_coverage()` → PremiumModule calls `vault.lock_for_coverage(coverage_amount)`
	•	`expire_coverage()` → PremiumModule calls `vault.unlock_from_coverage(amount)`
	•	`approve_claim()` → ClaimsManager calls `vault.withdraw_for_payout(user, amount)` + notifies PremiumModule via `notify_claim_payout(token_id)` which calls `vault.unlock_from_coverage`

Rules
	•	Locked capital cannot be withdrawn by LPs.
	•	Premium rewards accrue to all depositors proportional to vault shares.
	•	LPs can withdraw any unlocked portion at any time.

⸻

4.4 Premium Vault (Per Protocol)

Treasury holding premiums for each protocol.

Functions
	•	Receive USDC premium payments
	•	Track accrual per epoch
	•	Distribute rewards to LPs proportional to vault shares

Merged into PremiumModule accounting.

⸻

4.5 Coverage Token

Represents insurance entitlement.

Standard

ERC-721 NFT (singleton contract, one per system).

Metadata
	•	`protocol_id`
	•	`coverage_amount`
	•	`start_time`
	•	`end_time`
	•	`premium_paid`

Minted on premium purchase (by PremiumModule — MINTER_ROLE required).

Burned on expiry or approved claim (by ClaimsManager — BURNER_ROLE required).

⸻

4.6 Protocol Registry

Manages partner onboarding.

Functions
	•	`register_protocol()`
	•	`set_vault()` — called by factory after deploying vault
	•	`set_coverage_params()` / `pause_protocol()`

Stored Parameters
	•	Coverage caps
	•	Premium rates
	•	Covered risks
	•	Claim conditions

⸻

4.7 Premium Purchase Module

Handles coverage sales. One per protocol, deployed by factory.

Constructor
	`PremiumModule(protocol_id, vault, registry, coverage_token, premium_asset, owner)`

Flow
	1.	User selects protocol.
	2.	Chooses coverage amount + duration.
	3.	Approves USDC to PremiumModule.
	4.	Calls `buy_coverage(coverage_amount, duration)`.
	5.	Premium (USDC) transferred from user to module.
	6.	Coverage NFT minted via CoverageToken (MINTER_ROLE).
	7.	`vault.lock_for_coverage(coverage_amount)` called — capital locked automatically.

Note: Premium is paid in USDC (`premium_asset`). Vault payouts are in BTC-LST (`underlying_asset`). These are different tokens.

⸻

4.8 Claims Manager

Handles the full on-chain claim lifecycle. One per protocol, auto-deployed by factory alongside vault and premium module.

Constructor
	`ClaimsManager(vault, coverage_token, premium_module, owner)`

Roles
	•	`OWNER_ROLE`: deployer (the `create_vault` caller). Can add/remove governors.
	•	`GOVERNOR_ROLE`: whitelisted wallets that approve or reject claims.

Interface
	•	`submit_claim(token_id) → claim_id` — user proves ownership via tx signature. Verifies NFT owner == caller, coverage is active, no double claim.
	•	`approve_claim(claim_id)` — governor only. Pays BTC-LST from vault to claimant, burns NFT, notifies PM.
	•	`reject_claim(claim_id)` — governor only. Marks rejected, token re-usable for retry.
	•	`add_governor(address)` / `remove_governor(address)` — owner only.
	•	`get_claim(claim_id) → ClaimData` — returns full claim struct.
	•	`next_claim_id()` — iterating all claims.
	•	`is_token_claimed(token_id)` — double-claim prevention.

ClaimData struct (12 felts over RPC):
	`claim_id(u256), claimant(felt252), token_id(u256), protocol_id(u256), coverage_amount(u256), status(felt252: 0=pending 1=approved 2=rejected), submitted_at(u64), resolved_at(u64)`

Claim statuses: 0 = Pending, 1 = Approved, 2 = Rejected.

On rejection: `token_claimed[token_id]` is reset to false so user can re-submit.

⸻

5. System Workflows

⸻

5.1 Vault Deployment Flow
	1.	Protocol approved via `registry.register_protocol()`.
	2.	Factory deploys vault + premium module + claims manager atomically via `create_vault()`.
	3.	Admin wires roles: `set_coverage_manager`, `set_claims_manager`, `set_minter`, `set_burner`, `add_governor`.
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
	3.	Pays premium in USDC.
	4.	Coverage NFT minted.
	5.	USDC premium routed to PremiumModule.
	6.	BTC-LST liquidity locked in vault.

⸻

5.4 Premium Distribution Flow

Premiums distributed per vault:

```
reward =
  protocol_premiums_usdc
* (lp_shares / total_vault_shares)
```

All depositors earn premiums proportional to their vault share balance.

⸻

5.5 Incident & Claims Flow
	1.	Hack occurs.
	2.	Governor reviews evidence off-chain.
	3.	Insured user calls `claims_manager.submit_claim(token_id)` on Starknet.
	   — Contract verifies: caller owns NFT, coverage is active, not already claimed.
	4.	Governor calls `approve_claim(claim_id)` (or `reject_claim`).
	5.	On approval: vault transfers BTC-LST to claimant, NFT burned, PM notified to unlock coverage.
	6.	On rejection: token re-enabled for retry (in case evidence was insufficient).

⸻

6. Data Structures

⸻

Coverage Position

```
struct CoverageData {
  protocol_id:      u256
  coverage_amount:  u256
  start_time:       u64
  end_time:         u64
  premium_paid:     u256
}
```

⸻

Claim

```
struct ClaimData {
  claim_id:        u256
  claimant:        ContractAddress
  token_id:        u256
  protocol_id:     u256
  coverage_amount: u256
  status:          felt252  // 0=pending 1=approved 2=rejected
  submitted_at:    u64
  resolved_at:     u64
}
```

⸻

7. Risk Controls
	•	Coverage caps per vault.
	•	Demand-based capital locking (automatic lock/unlock tied to coverage lifecycle).
	•	Coverage expiry enforcement.
	•	Double-claim prevention (`is_token_claimed` bitmap).
	•	Vault deposit caps.
	•	Governor-gated claim approval.
	•	On rejection, claim is re-openable so user isn't permanently blocked.

⸻

8. Economic Model

⸻

LP Yield Sources
	•	BTC-LST native yield.
	•	Insurance premiums in USDC (proportional to vault shares, claimable per epoch).

All depositors earn premiums — no manual locking required.

⸻

Loss Socialization

Losses affect only LPs in that protocol vault.

Share price decreases after BTC-LST payouts.

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
│  (deploys vault + │    │                  │    │    (per protocol)     │
│   PM + CM)        │    │                  │    │    pays USDC premiums │
└────────┬──────────┘    └──────────────────┘    └───┬──────────┬───────┘
         │ deploys                                   │          │
         │ vault + PM + ClaimsManager                │          │
         ▼                                           │          │
┌───────────────────┐          reads params ─────────┘          │
│                   │          & checks active                  │
│   LST Vault       │◀─────────────────────────────────────────┘
│   (ERC-4626)      │    lock/unlock capital for coverage       │
│                   │                                           │ mints
└───────┬───────────┘                                           ▼
        │                                            ┌───────────────────┐
        │ holds BTC-LST                              │                   │
        │ issues shares                              │  Coverage Token   │
        │                                            │  (ERC-721 NFT)    │
        ▼                                            │                   │
┌───────────────────┐                                └────────┬──────────┘
│                   │                                         │
│   BTC-LST Token   │                                         │ burned by
│   (ERC-20)        │◀────────────────────────────────────────┤
│                   │   withdraw_for_payout               ┌───▼────────────────┐
└───────────────────┘                                     │  Claims Manager    │
                                                          │  (per protocol)    │
                                                          │  submit/approve/   │
                                                          │  reject claims     │
                                                          └────────────────────┘
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
    User              USDC Token           Premium Module    Coverage Token     Registry       Vault
     │                  │                       │                 │               │              │
     │                                          │  1. is_active?  │               │              │
     │  buy_coverage(amount, duration)          │────────────────┼──────────────▶│              │
     │─────────────────────────────────────────▶│                │               │              │
     │                                          │  2. get params │               │              │
     │                                          │────────────────┼──────────────▶│              │
     │                                          │◀───────────────┼───────────────│              │
     │                                          │  (premium_rate,│coverage_cap)  │              │
     │                                          │                │               │              │
     │                                          │ 3. compute     │               │              │
     │                                          │    premium     │               │              │
     │                                          │                │               │              │
     │  4. approve(PM, usdc_premium)            │                │               │              │
     │─────────────────────────────────────────▶│                │               │              │
     │                  4. transferFrom         │                │               │              │
     │                  (user → PM, USDC)       │                │               │              │
     │                 ──────────────────────────│                │               │              │
     │                                          │                │               │              │
     │                                          │ 5. mint_coverage               │              │
     │                                          │───────────────▶│               │              │
     │                                          │                │               │              │
     │                                          │ 6. lock_for_coverage(amount)   │              │
     │                                          │────────────────┼───────────────┼─────────────▶│
     │                                          │                │               │              │
     │            7. Coverage NFT minted        │                │               │              │
     │◀─────────────────────────────────────────┼────────────────│               │              │
     │                                          │                │               │              │
     │        NFT contains:                    │                │               │              │
     │        - protocol_id                    │     Vault capital now locked    │              │
     │        - coverage_amount                │     for this coverage amount    │              │
     │        - start_time / end_time          │                │               │              │
     │        - premium_paid (USDC)            │                │               │              │
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

### 9.5 Incident & Claims Flow (On-Chain NFT-Based)

```
    Hack occurs
        │
        ▼
    User calls submit_claim(token_id)
        │
    ┌──────────────────┐
    │ Claims Manager   │
    │                  │
    │ verify:          │
    │ - caller owns NFT│
    │ - coverage active│
    │ - not claimed    │
    │                  │
    │ store ClaimData  │
    │ mark token_claimed│
    └────────┬─────────┘
             │ claim_id
             ▼
    Governor reviews off-chain
             │
      ┌──────┴──────┐
      │             │
   approve       reject
      │             │
      ▼             ▼
  vault pays    token_claimed
  BTC-LST       reset → user
  to user       can retry
  NFT burned
  PM notified
  (unlocks coverage)
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
       PM + CM               │                     │
         │                   │                     │
    3. admin wires           │                     │
       roles                 │                     │
         │                   │                     │
         │              4. deposit                 │
         │                 BTC-LST                 │
         │                 into vault              │
         │                   │                     │
         │              5. checkpoint              │
         │                 in premium              │
         │                 module                  │
         │                   │                     │
         │                   │                6. buy coverage
         │                   │                   pay USDC premium
         │                   │                   receive NFT
         │                   │                   (vault BTC-LST
         │                   │                    auto-locked)
         │                   │                     │
    7. advance               │                     │
       epoch                 │                     │
         │                   │                     │
         │              8. claim                   │
         │                 premiums                │
         │                 (USDC)                  │
         │                   │                     │
         │                   │                     │
    ─ ─ ─ ─ ─ ─ ─ ─ IF HACK OCCURS ─ ─ ─ ─ ─ ─ ─
         │                   │                     │
         │                   │               9. submit_claim
         │                   │                  (token_id)
         │                   │                     │
    10. governor             │                     │
        approve_claim        │                     │
         │                   │                     │
         │                   │              11. receive
         │                   │                  BTC-LST payout
         │                   │                     │
         │              LP vault shares            │
         │              decrease in value           │
         │              (loss socialization)        │
         ▼                   ▼                     ▼
```
