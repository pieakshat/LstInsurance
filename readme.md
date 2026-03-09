# BitCover

**Website:** https://lst-insurance.vercel.app/ | **Docs:** https://lst-insurance.vercel.app/docs 

A decentralized insurance protocol built on Starknet. Users buy coverage for their DeFi positions (e.g. deposits into a lending protocol), paying premiums in USDC. Liquidity Providers deposit BTC-LST into underwriting vaults and earn those premiums as yield. Claims are reviewed by a governance layer and paid out in BTC-LST.

The protocol also has a cross-chain extension — users on Base (EVM) can buy coverage that triggers vault operations on Starknet via LayerZero V2.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Starknet Contracts](#starknet-contracts)
  - [ProtocolRegistry](#1-protocolregistry)
  - [LstVault](#2-lstvault)
  - [PremiumModule](#3-premiummodule)
  - [CoverageToken](#4-coveragetoken)
  - [ClaimsManager](#5-claimsmanager)
  - [InsuranceVaultFactory](#6-insurancevaultfactory)
- [User Flows](#user-flows)
  - [LP Flow](#lp-flow)
  - [Coverage Buyer Flow](#coverage-buyer-flow)
  - [Claim Flow](#claim-flow)
- [Cross-Chain Extension (Base → Starknet)](#cross-chain-extension-base--starknet)
- [Deployed Addresses](#deployed-addresses)
- [Development](#development)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        STARKNET                                  │
│                                                                  │
│  ┌──────────────────┐     registers      ┌──────────────────┐   │
│  │ ProtocolRegistry │◄───────────────────│ VaultFactory     │   │
│  │                  │                    │                  │   │
│  │ - protocol list  │                    │ - deploys Vault  │   │
│  │ - coverage caps  │                    │ - deploys PM     │   │
│  │ - premium rates  │                    │ - deploys CM     │   │
│  └──────────────────┘                    └──────────────────┘   │
│           │                                       │             │
│           │ is_active?                            │ deploys     │
│           ▼                                       ▼             │
│  ┌──────────────────┐    lock/unlock    ┌──────────────────┐   │
│  │  PremiumModule   │◄─────────────────►│    LstVault      │   │
│  │                  │                    │                  │   │
│  │ - buy_coverage   │    withdraw_for_   │ - ERC-4626       │   │
│  │ - epoch system   │    payout          │ - locked_liq     │   │
│  │ - LP premiums    │◄─────────────────►│ - deposit limit  │   │
│  └──────────────────┘                    └──────────────────┘   │
│           │ mint/burn                             ▲             │
│           ▼                                       │ withdraw    │
│  ┌──────────────────┐    approve_claim  ┌──────────────────┐   │
│  │  CoverageToken   │◄─────────────────►│  ClaimsManager   │   │
│  │                  │                    │                  │   │
│  │ - ERC-721 NFT    │    notify_payout   │ - submit_claim   │   │
│  │ - CoveragePos    │◄───────────────────│ - approve/reject │   │
│  │ - is_active()    │                    │ - governor roles │   │
│  └──────────────────┘                    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

Each insured protocol gets its own isolated stack: one `LstVault`, one `PremiumModule`, and one `ClaimsManager`, all deployed atomically by the `InsuranceVaultFactory`. The `ProtocolRegistry` and `CoverageToken` are singletons shared across all protocols.

---

## Starknet Contracts

### 1. ProtocolRegistry

**`contracts/src/protocol_registry.cairo`**

The global registry that tracks every insurable protocol. Governance registers a protocol with a coverage cap and a premium rate (in basis points). The registry is the source of truth for whether a protocol is currently active — `PremiumModule` queries it on every `buy_coverage` call.

```
ProtocolInfo {
  protocol_id       → auto-incremented u256
  protocol_address  → the DeFi contract users deposit into (e.g. Aave)
  vault             → the BTC-LST vault backing this protocol's coverage
  active            → bool — paused protocols cannot sell new coverage
  coverage_cap      → max total active coverage in BTC-LST (e18)
  premium_rate      → basis points, e.g. 500 = 5% per 90 days
}
```

Key functions:
- `register_protocol(address, vault, cap, rate)` → governance only
- `pause_protocol(id)` / `activate_protocol(id)` → governance only
- `is_active(id)` → checked by PremiumModule before every purchase

---

### 2. LstVault

**`contracts/src/vault.cairo`**

An ERC-4626 vault where LPs deposit BTC-LST and receive vault shares. The vault is the capital pool — it backs all coverage sold by the associated `PremiumModule`. When a claim is approved, the `ClaimsManager` pulls BTC-LST directly from this vault.

```
                    ┌──────────────────────────────┐
   LP deposits      │         LstVault             │
   BTC-LST ────────►│                              │
                    │  total_assets  = 1,000 BTC   │
   LP receives      │  locked_liq    =   300 BTC   │◄── locked by PremiumModule
   vault shares ◄───│  available_liq =   700 BTC   │
                    │                              │
   On payout:       │  withdraw_for_payout() ──────┼──► claimant
   locked_liq ──────►  reduced by payout amount   │
                    └──────────────────────────────┘
```

**Role-based access:**
| Role | Can do |
|---|---|
| `OWNER_ROLE` | pause, set deposit limit, set managers |
| `PAUSER_ROLE` | pause / unpause |
| `COVERAGE_MANAGER_ROLE` | `lock_for_coverage`, `unlock_from_coverage` |
| `CLAIMS_MANAGER_ROLE` | `withdraw_for_payout` |

Key functions:
- `deposit(assets, receiver)` / `withdraw(assets, receiver, owner)` → standard ERC-4626
- `lock_for_coverage(amount)` → called by PremiumModule on every coverage purchase
- `unlock_from_coverage(amount)` → called by PremiumModule when coverage expires
- `withdraw_for_payout(to, amount)` → called by ClaimsManager on approved claims
- `available_liquidity()` → `total_assets - locked_liquidity`

---

### 3. PremiumModule

**`contracts/src/premium_module.cairo`**

The core of the insurance product. Users call `buy_coverage` here, paying USDC premiums in exchange for a `CoverageToken` NFT. The module locks the corresponding BTC-LST capital in the vault and tracks premiums across epochs for LP distribution.

#### Premium Formula

```
premium = coverage_amount × BTC_PRICE_USDC × rate × duration
          ─────────────────────────────────────────────────────
               PRICE_PRECISION × RATE_DENOMINATOR × BASE_DURATION

Example: 1 BTC-LST, 5% rate, 90 days
= 1e18 × 1500e18 × 500 × 7776000
  ────────────────────────────────
     1e18 × 10000 × 7776000
= $75 USDC
```

#### Epoch System

Premiums accumulate over ~monthly epochs. LPs must checkpoint their vault share balance during an epoch to be eligible for that epoch's premium distribution.

```
Epoch lifecycle:
  ┌─ Epoch 1 starts ──────────────────────────────────────────────┐
  │                                                                │
  │  1. LPs call checkpoint()     → records vault share snapshot  │
  │  2. Users call buy_coverage() → premiums go to pending_pool   │
  │  3. Governance calls advance_epoch() →                        │
  │       - pending_premiums → epoch_premiums[1]                  │
  │       - snapshot total vault share supply                     │
  │       - epoch counter increments                              │
  │                                                               │
  │  4. LPs call claim_premiums(epoch=1) →                        │
  │       payout = epoch_premiums[1] × lp_shares / total_shares   │
  └───────────────────────────────────────────────────────────────┘
```

Key functions:
- `buy_coverage(coverage_amount, duration)` → mints NFT, locks vault, pulls USDC
- `preview_cost(coverage_amount, duration)` → view — returns USDC cost
- `checkpoint()` → LP records share balance for current epoch
- `claim_premiums(epoch)` → LP withdraws earned USDC from finalized epoch
- `advance_epoch()` → governance only, finalizes epoch
- `expire_coverage(token_id)` → anyone can call after NFT expiry, unlocks vault capital

---

### 4. CoverageToken

**`contracts/src/coverage_token.cairo`**

An ERC-721 NFT that represents an active insurance position. Each token stores the full policy metadata on-chain.

```
CoveragePosition {
  protocol_id      → which protocol is insured
  coverage_amount  → BTC-LST amount covered (e18)
  start_time       → block timestamp at purchase
  end_time         → start_time + duration
  premium_paid     → USDC amount paid (e18)
}
```

`is_active(token_id)` returns `true` while `block_timestamp < end_time`. Once expired, anyone can call `PremiumModule.expire_coverage(token_id)` to unlock the vault capital.

**Roles:** `MINTER_ROLE` (PremiumModule), `BURNER_ROLE` (ClaimsManager)

Key functions:
- `mint_coverage(to, protocol_id, amount, duration, premium)` → minter only
- `burn_coverage(token_id)` → burner only, called on claim approval
- `get_coverage(token_id)` → returns full `CoveragePosition`
- `get_tokens_of(owner)` → all token IDs held by an address

---

### 5. ClaimsManager

**`contracts/src/claims_manager.cairo`**

Manages the insurance claim lifecycle. Users submit a claim referencing their Coverage NFT. Whitelisted governors review the claim off-chain and either approve (triggering a payout) or reject (allowing re-submission).

```
Claim lifecycle:

  User holds NFT
       │
       │ submit_claim(token_id)
       ▼
  [PENDING] ──────────────────────────► Governor approves
       │                                    │
       │ Governor rejects                   ▼
       ▼                              [APPROVED]
  [REJECTED]                           │
       │                               ├── vault.withdraw_for_payout(user, amount)
       │ User resubmits                ├── coverage_token.burn_coverage(token_id)
       ▼                               └── pm.notify_claim_payout(token_id)
  [PENDING] → ...
```

On approval:
1. Vault transfers `coverage_amount` BTC-LST to claimant
2. Coverage NFT is burned (position closed)
3. PremiumModule is notified to clean up internal accounting

Key functions:
- `submit_claim(token_id)` → any NFT owner; reverts if coverage is still active (not yet expired) — wait, coverage must be active (within its coverage window) to submit a claim
- `approve_claim(claim_id)` → governor only
- `reject_claim(claim_id)` → governor only
- `add_governor(account)` / `remove_governor(account)` → owner only

---

### 6. InsuranceVaultFactory

**`contracts/src/vault_factory.cairo`**

Deploys the full per-protocol contract stack in a single transaction. Given a `protocol_id` and underlying asset, it uses `deploy_syscall` to instantiate a `LstVault`, a `PremiumModule`, and a `ClaimsManager`, then registers the vault in the `ProtocolRegistry`.

```
factory.create_vault(protocol_id, name, symbol, underlying_asset)
          │
          ├── deploy_syscall → LstVault
          ├── deploy_syscall → PremiumModule (wired to vault + registry)
          ├── deploy_syscall → ClaimsManager (wired to vault + PM)
          └── registry.set_vault(protocol_id, vault_address)
```

> **Note:** After `create_vault`, the admin must still manually grant:
> - `vault.set_coverage_manager(pm_address)` → PM can lock capital
> - `vault.set_claims_manager(cm_address)` → CM can trigger payouts
> - `coverage_token.set_minter(pm_address)` → PM can mint NFTs
> - `coverage_token.set_burner(cm_address)` → CM can burn NFTs
> - `pm.set_claims_manager(cm_address)` → PM can receive payout notifications

---

## User Flows

### LP Flow

```
1. LP calls vault.deposit(amount, receiver)
        └── transfers BTC-LST to vault
        └── receives vault shares (ERC-20)

2. LP calls pm.checkpoint()
        └── records current vault share balance for this epoch
        └── required ONCE per epoch to be eligible for premiums

3. After epoch advances:
   LP calls pm.claim_premiums(epoch)
        └── receives USDC proportional to their share snapshot
        └── payout = epoch_premiums × lp_shares / total_shares

4. LP calls vault.withdraw(amount, receiver, owner)
        └── burns shares, receives BTC-LST
        └── only up to available_liquidity (not locked portion)
```

---

### Coverage Buyer Flow

```
1. Buyer calls pm.preview_cost(coverage_amount, duration)
        └── returns USDC premium (no state change)

2. Buyer calls usdc.approve(pm_address, premium)
        └── standard ERC-20 approval

3. Buyer calls pm.buy_coverage(coverage_amount, duration)
        ├── verifies: protocol active, within coverage cap, vault has liquidity
        ├── pulls USDC from buyer
        ├── vault.lock_for_coverage(coverage_amount)
        └── coverage_token.mint_coverage(buyer, ...) → returns token_id

4. Buyer holds Coverage NFT until:
   (a) Coverage expires naturally → anyone calls pm.expire_coverage(token_id)
   (b) A hack/exploit occurs → buyer submits a claim
```

---

### Claim Flow

```
1. Buyer calls cm.submit_claim(token_id)
        └── must be NFT owner; creates Claim with status=PENDING

2. Governor reviews off-chain evidence

3a. Governor calls cm.approve_claim(claim_id)
        ├── vault.withdraw_for_payout(buyer, coverage_amount) → BTC-LST sent
        ├── coverage_token.burn_coverage(token_id)            → NFT destroyed
        └── pm.notify_claim_payout(token_id)                 → PM clears state

3b. Governor calls cm.reject_claim(claim_id)
        └── status = REJECTED; buyer may re-submit
```

---

## Cross-Chain Extension (Base → Starknet)
[The LayerZero oApp contracts for cross-chain functionality have been deployed. However, end-to-end testing could not be completed because the required LayerZero configuration has not yet been finalized by the LayerZero team.

The protocol has a cross-chain layer allowing users on Base (EVM) to buy insurance coverage. Coverage purchases on Base are bridged to Starknet via **LayerZero V2**, where the actual vault capital locking happens.

### Architecture

```
          BASE (EVM)                          STARKNET
  ┌─────────────────────────┐        ┌─────────────────────────┐
  │                         │        │                         │
  │  CoverageTokenBase      │        │  InsuranceReceiver      │
  │  (ERC-721 on Base)      │        │  (LZ OApp receiver)     │
  │         │               │        │         │               │
  │         │               │        │         │               │
  │  BaseInsuranceHub       │  LZ V2 │         ▼               │
  │  (LZ OApp sender) ──────┼───────►│  vault.lock_for_        │
  │         │               │        │  coverage(amount)       │
  │  MSG_LOCK_COVERAGE      │        │                         │
  │  MSG_UNLOCK_COVERAGE    │        │  vault.unlock_from_     │
  │  MSG_PAYOUT_CLAIM       │        │  coverage(amount)       │
  │                         │        │                         │
  └─────────────────────────┘        │  vault.withdraw_for_    │
                                     │  payout(user, amount)   │
                                     └─────────────────────────┘
```

### EVM Side — `BaseInsuranceHub`

**`evmcontracts/src/BaseInsuranceHub.sol`**

A send-only LayerZero OApp on Base Sepolia. Users interact here:

- `buyCoverage(protocolId, amount, duration, starknetAddr)` → mints ERC-721 on Base, sends `MSG_LOCK_COVERAGE` to Starknet
- `expireCoverage(tokenId)` → burns ERC-721, sends `MSG_UNLOCK_COVERAGE` to Starknet
- `submitClaim(tokenId)` → records claim, governor approves → sends `MSG_PAYOUT_CLAIM` to Starknet

Premium is paid in USDC on Base and stays on the EVM side (not bridged).

### Starknet Side — `InsuranceReceiver`

**`crosschain/src/insurance_receiver.cairo`**

A LayerZero V2 OApp receiver. Decodes incoming messages and calls the vault directly:

| Message type | Byte | Action on Starknet |
|---|---|---|
| `LOCK_COVERAGE` | `0x01` | `vault.lock_for_coverage(amount)` |
| `UNLOCK_COVERAGE` | `0x02` | `vault.unlock_from_coverage(amount)` |
| `PAYOUT_CLAIM` | `0x03` | `vault.withdraw_for_payout(user, amount)` |

### Message Encoding

Messages are packed byte arrays:

```
LOCK / UNLOCK:
  [msg_type: 1 byte][protocol_id: 32 bytes][amount: 32 bytes][token_id: 32 bytes]
  = 97 bytes total

PAYOUT:
  [msg_type: 1 byte][protocol_id: 32 bytes][user_starknet_addr: 32 bytes][amount: 32 bytes]
  = 97 bytes total
```

### Cross-Chain Flow

```
User on Base                    LayerZero                    Starknet
     │                              │                            │
     │ buyCoverage(protocolId,      │                            │
     │   amount, duration,          │                            │
     │   starknetAddr)              │                            │
     │                              │                            │
     │ ── pays USDC on Base ──►     │                            │
     │ ── mints NFT on Base ──►     │                            │
     │                              │                            │
     │ ── sends MSG_LOCK ──────────►│                            │
     │                              │ ── delivers to receiver ──►│
     │                              │                            │ vault.lock_for_coverage(amount)
     │                              │                            │
     │ (hack occurs)                │                            │
     │                              │                            │
     │ submitClaim(tokenId)         │                            │
     │ governor.approveClaim()      │                            │
     │                              │                            │
     │ ── sends MSG_PAYOUT ────────►│                            │
     │                              │ ── delivers to receiver ──►│
     │                              │                            │ vault.withdraw_for_payout(
     │                              │                            │   starknetAddr, amount)
     │                              │                            │
     │ expireCoverage(tokenId)      │                            │
     │ ── sends MSG_UNLOCK ────────►│                            │
     │                              │ ── delivers to receiver ──►│
     │                              │                            │ vault.unlock_from_coverage(amount)
```

---

## Deployed Addresses

### Starknet Sepolia

| Contract | Address |
|---|---|
| ProtocolRegistry | `0x0493ff23ec196924e7facfba6b351b9e40c906c280f48dc1892b113b6442ad0a` |
| CoverageToken | `0x0648a1f37af0adeea21180c08e1ddd5002561f50cee547ed9bf56588153c9319` |
| InsuranceVaultFactory | `0x0293d696a31a5755e5e625e83f797a8e9075037bd868f51d3eee8480a099fc02` |
| MockUSDC | `0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a` |
| BTC-LST (xyBTC) | `0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee` |
| LZ Endpoint | `0x0316d70a6e0445a58c486215fac8ead48d3db985acde27efca9130da4c675878` |

### Base Sepolia (cross-chain layer)

| Contract | Address |
|---|---|
| BaseInsuranceHub | `0x7F7e7B7C207a9d04aab64a577F8E131947F039A6` |
| CoverageTokenBase | `0xBdDBbEB6ed923639cc6fa9948A86BF3dC9B43766` |
| InsuranceReceiver (Starknet) | `0x05c27127ef05482ec7c152aa51cceec19db933cc2c63ef5f212603ce821c21c8` |
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### LayerZero Chain IDs

| Chain | EID |
|---|---|
| Starknet Sepolia | 40500 |
| Base Sepolia | 40245 |

---

## Development

### Starknet contracts

```bash
cd contracts
scarb build
snforge test
```

### EVM contracts

```bash
cd evmcontracts
forge build
forge test
```

### Frontend

```bash
cd FR
pnpm install
pnpm dev
```

### Deploying a new protocol (Starknet)

```bash
# 1. Register protocol in registry
sncast invoke --contract-address $REGISTRY --function register_protocol \
  --calldata $PROTOCOL_ADDR 0x0 $COVERAGE_CAP_LOW $COVERAGE_CAP_HIGH $PREMIUM_RATE

# 2. Deploy vault + PM + CM via factory
sncast invoke --contract-address $FACTORY --function create_vault \
  --calldata $PROTOCOL_ID 0 '"Vault Name"' '"SYMBOL"' $LSTBTC_ADDR

# 3. Wire permissions (get PM and CM addresses from factory first)
sncast invoke --contract-address $VAULT --function set_coverage_manager --calldata $PM
sncast invoke --contract-address $VAULT --function set_claims_manager --calldata $CM
sncast invoke --contract-address $COVERAGE_TOKEN --function set_minter --calldata $PM
sncast invoke --contract-address $COVERAGE_TOKEN --function set_burner --calldata $CM
sncast invoke --contract-address $PM --function set_claims_manager --calldata $CM
```
