
⸻
PRD — BTC-LST Insurance Infrastructure

1. Overview

Build a DeFi insurance infrastructure on Starknet where:
	•	Liquidity providers deposit BTC-LST into an ERC-4626 vault.
	•	Partner protocols integrate insurance coverage for their users.
	•	Users pay one-time premiums for coverage.
	•	Premiums flow to LPs as yield.
	•	In the event of a hack, insured users can claim payouts from the vault based on verified losses.

⸻

2. Goals
	•	Yield-backed underwriting using BTC-LST.
	•	B2B2C insurance distribution via protocol integrations.
	•	Tokenized coverage positions.
	•	Scalable claims distribution via Merkle snapshots.
	•	Fully on-chain solvency + payout accounting.

⸻

3. Actors

Liquidity Providers (LPs)

Deposit BTC-LST → earn:
	•	Native LST yield
	•	Insurance premiums

Protocol Partners

Integrate insurance infra for their users.

Insured Users

Buy coverage on protocol deposits.

Mediator / Resolver

Confirms hacks and approves claims.

⸻

4. System Components

4.1 BTC-LST Vault (ERC-4626)

Role: Solvency pool.

Functions:
	•	deposit()
	•	withdraw()
	•	totalAssets()
	•	convertToShares()

Notes:
	•	Vault holds BTC-LST only.
	•	Yield accrues via LST appreciation.
	•	Funds used for payouts.

⸻

4.2 Premium Vault

Role: Premium treasury + LP reward distributor.

Functions:
	•	Receive premium payments.
	•	Track premium accrual.
	•	Distribute rewards to LPs pro-rata.

Optional: ERC-4626 wrapper.

⸻

4.3 Coverage Token

Represents insurance entitlement.

Standard: ERC-721 or ERC-1155 preferred.

Metadata fields:
	•	protocol_id
	•	coverage_amount
	•	coverage_start
	•	coverage_end
	•	premium_paid
	•	risk_type

Minted when premium is paid.

⸻

4.4 Protocol Registry

Onboards partner protocols.

Functions:
	•	registerProtocol()
	•	setCoverageParams()
	•	pauseProtocol()

Stored params:
	•	Coverage cap %
	•	Premium rate
	•	Covered risks
	•	Claim conditions

⸻

4.5 Premium Purchase Module

Handles user coverage purchases.

Flow:
	1.	User selects protocol.
	2.	Chooses coverage amount.
	3.	Pays premium.
	4.	Coverage token minted.
	5.	Premium routed to Premium Vault.

⸻

4.6 Resolution Module

Confirms incidents.

Trigger sources:
	•	Multisig
	•	Oracle
	•	Governance

Functions:
	•	reportIncident(protocol_id)
	•	approveIncident()
	•	rejectIncident()

Outputs incident ID.

⸻

4.7 Loss Snapshot Engine

Off-chain computation layer.

Responsibilities:
	•	Compute user losses.
	•	Validate coverage.
	•	Calculate claimable amounts.

Output:
	•	Merkle root
	•	Proofs per user

⸻

4.8 Claim Manager

Handles claims using Merkle proofs.

Storage:
	•	incident_id → merkle_root
	•	Claimed bitmap

Functions:
	•	submitMerkleRoot()
	•	claim(amount, proof)
	•	isClaimed()

⸻

4.9 Payout Manager

Executes liquidity withdrawals.

Flow:
	1.	Validate claim via Claim Manager.
	2.	Pull liquidity from BTC-LST Vault.
	3.	Transfer payout to user.

⸻

5. System Workflows

⸻

5.1 LP Deposit Flow
	1.	LP deposits BTC-LST.
	2.	ERC-4626 shares minted.
	3.	Vault TVL increases.

⸻

5.2 Coverage Purchase Flow
	1.	User deposits in partner protocol.
	2.	Buys insurance via integration.
	3.	Pays premium.
	4.	Coverage token minted.
	5.	Premium → Premium Vault.

⸻

5.3 Premium Distribution Flow
	1.	Premiums accumulate.
	2.	LP rewards calculated:

reward = premium_pool * (lp_shares / total_shares)

	3.	LPs claim rewards.

⸻

5.4 Incident & Claims Flow
	1.	Hack occurs.
	2.	Resolution Module approves incident.
	3.	Loss Snapshot Engine computes losses.
	4.	Merkle root submitted onchain.
	5.	Users claim with proofs.
	6.	Payout Manager withdraws from vault.

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
	•	Coverage caps per protocol.
	•	Global solvency ratio enforcement.
	•	Coverage expiry enforcement.
	•	Double-claim prevention.
	•	Incident pause controls.

⸻

