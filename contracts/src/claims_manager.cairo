// ═══════════════════════════════════════════════════════════════════════════════
//
// CLAIMS MANAGER
//
// Handles the full insurance claim lifecycle:
//   1. User submits a claim referencing their Coverage NFT
//   2. Whitelisted governance wallets review off-chain
//   3. Governor approves → vault pays out BTC-LST, NFT burned
//      Governor rejects → claim marked rejected, NFT untouched
//
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Drop, Copy, Serde)]
pub struct ClaimData {
    pub claim_id: u256,
    pub claimant: starknet::ContractAddress,
    pub token_id: u256,
    pub protocol_id: u256,
    pub coverage_amount: u256,
    pub status: felt252,
    pub submitted_at: u64,
    pub resolved_at: u64,
}

#[starknet::interface]
pub trait IClaimsManager<TContractState> {
    // --- User actions ---
    fn submit_claim(ref self: TContractState, token_id: u256) -> u256;

    // --- Governor actions ---
    fn approve_claim(ref self: TContractState, claim_id: u256);
    fn reject_claim(ref self: TContractState, claim_id: u256);

    // --- Owner admin ---
    fn add_governor(ref self: TContractState, governor: starknet::ContractAddress);
    fn remove_governor(ref self: TContractState, governor: starknet::ContractAddress);

    // --- Views ---
    fn get_claim(self: @TContractState, claim_id: u256) -> ClaimData;
    fn get_claim_status(self: @TContractState, claim_id: u256) -> felt252;
    fn is_governor(self: @TContractState, account: starknet::ContractAddress) -> bool;
    fn next_claim_id(self: @TContractState) -> u256;
    fn is_token_claimed(self: @TContractState, token_id: u256) -> bool;
}

#[starknet::contract]
pub mod ClaimsManager {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::introspection::src5::SRC5Component;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use super::ClaimData;

    // ── Roles ──
    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const GOVERNOR_ROLE: felt252 = selector!("GOVERNOR_ROLE");

    // ── Claim statuses ──
    pub const STATUS_PENDING: felt252 = 0;
    pub const STATUS_APPROVED: felt252 = 1;
    pub const STATUS_REJECTED: felt252 = 2;

    // ── External dispatchers ──
    #[starknet::interface]
    trait IVaultPayout<T> {
        fn withdraw_for_payout(ref self: T, to: ContractAddress, amount: u256);
    }

    #[starknet::interface]
    trait ICoverageTokenExt<T> {
        fn burn_coverage(ref self: T, token_id: u256);
        fn owner_of(self: @T, token_id: u256) -> ContractAddress;
        fn coverage_amount(self: @T, token_id: u256) -> u256;
        fn coverage_protocol(self: @T, token_id: u256) -> u256;
        fn is_active(self: @T, token_id: u256) -> bool;
    }

    // ── Storage node for claims ──
    #[starknet::storage_node]
    struct ClaimNode {
        claimant: ContractAddress,
        token_id: u256,
        protocol_id: u256,
        coverage_amount: u256,
        status: felt252,
        submitted_at: u64,
        resolved_at: u64,
    }

    // ── Components ──
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    // ── Storage ──
    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        vault: ContractAddress,
        coverage_token: ContractAddress,
        claims: Map<u256, ClaimNode>,
        next_claim_id: u256,
        token_claimed: Map<u256, bool>,
    }

    // ── Events ──
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        ClaimSubmitted: ClaimSubmitted,
        ClaimApproved: ClaimApproved,
        ClaimRejected: ClaimRejected,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClaimSubmitted {
        #[key]
        pub claim_id: u256,
        #[key]
        pub claimant: ContractAddress,
        pub token_id: u256,
        pub protocol_id: u256,
        pub coverage_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClaimApproved {
        #[key]
        pub claim_id: u256,
        pub claimant: ContractAddress,
        pub payout_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClaimRejected {
        #[key]
        pub claim_id: u256,
    }

    // ── Constructor ──
    #[constructor]
    fn constructor(
        ref self: ContractState,
        vault: ContractAddress,
        coverage_token: ContractAddress,
        owner: ContractAddress,
    ) {
        assert(vault.is_non_zero(), 'Invalid vault');
        assert(coverage_token.is_non_zero(), 'Invalid coverage token');
        assert(owner.is_non_zero(), 'Invalid owner');

        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(GOVERNOR_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);

        self.vault.write(vault);
        self.coverage_token.write(coverage_token);
        self.next_claim_id.write(1);
    }

    // ── Implementation ──
    #[abi(embed_v0)]
    pub impl ClaimsManagerImpl of super::IClaimsManager<ContractState> {
        /// User submits a claim by presenting their Coverage NFT token_id.
        /// The tx signature itself proves wallet ownership.
        fn submit_claim(ref self: ContractState, token_id: u256) -> u256 {
            let caller = get_caller_address();

            // Verify caller owns the NFT
            let cov = ICoverageTokenExtDispatcher {
                contract_address: self.coverage_token.read(),
            };
            let nft_owner = cov.owner_of(token_id);
            assert(nft_owner == caller, 'Not NFT owner');

            // Reject expired coverage
            assert(cov.is_active(token_id), 'Coverage expired');

            // Prevent double claims on the same NFT
            assert(!self.token_claimed.entry(token_id).read(), 'Already claimed');

            // Read coverage data
            let coverage_amount = cov.coverage_amount(token_id);
            let protocol_id = cov.coverage_protocol(token_id);

            // Create claim record
            let claim_id = self.next_claim_id.read();
            self.next_claim_id.write(claim_id + 1);

            let now = get_block_timestamp();
            let node = self.claims.entry(claim_id);
            node.claimant.write(caller);
            node.token_id.write(token_id);
            node.protocol_id.write(protocol_id);
            node.coverage_amount.write(coverage_amount);
            node.status.write(STATUS_PENDING);
            node.submitted_at.write(now);
            node.resolved_at.write(0);

            // Mark NFT as claimed
            self.token_claimed.entry(token_id).write(true);

            self.emit(ClaimSubmitted { claim_id, claimant: caller, token_id, protocol_id, coverage_amount });

            claim_id
        }

        /// Governor approves a claim → vault pays BTC-LST to user, NFT burned.
        fn approve_claim(ref self: ContractState, claim_id: u256) {
            self.access_control.assert_only_role(GOVERNOR_ROLE);

            let node = self.claims.entry(claim_id);
            let status = node.status.read();
            assert(status == STATUS_PENDING, 'Claim not pending');

            let claimant = node.claimant.read();
            assert(claimant.is_non_zero(), 'Claim does not exist');

            let coverage_amount = node.coverage_amount.read();
            let token_id = node.token_id.read();

            // Update status
            node.status.write(STATUS_APPROVED);
            node.resolved_at.write(get_block_timestamp());

            // Pay out from vault
            let vault = IVaultPayoutDispatcher { contract_address: self.vault.read() };
            vault.withdraw_for_payout(claimant, coverage_amount);

            // Burn the Coverage NFT
            let cov = ICoverageTokenExtDispatcher {
                contract_address: self.coverage_token.read(),
            };
            cov.burn_coverage(token_id);

            self.emit(ClaimApproved { claim_id, claimant, payout_amount: coverage_amount });
        }

        /// Governor rejects a claim. NFT is not burned — user keeps it.
        fn reject_claim(ref self: ContractState, claim_id: u256) {
            self.access_control.assert_only_role(GOVERNOR_ROLE);

            let node = self.claims.entry(claim_id);
            let status = node.status.read();
            assert(status == STATUS_PENDING, 'Claim not pending');

            let claimant = node.claimant.read();
            assert(claimant.is_non_zero(), 'Claim does not exist');

            node.status.write(STATUS_REJECTED);
            node.resolved_at.write(get_block_timestamp());

            // Un-mark the token so user can re-submit if needed
            let token_id = node.token_id.read();
            self.token_claimed.entry(token_id).write(false);

            self.emit(ClaimRejected { claim_id });
        }

        /// Owner adds a whitelisted governor wallet.
        fn add_governor(ref self: ContractState, governor: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(governor.is_non_zero(), 'Invalid address');
            self.access_control._grant_role(GOVERNOR_ROLE, governor);
        }

        /// Owner removes a governor wallet.
        fn remove_governor(ref self: ContractState, governor: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.access_control._revoke_role(GOVERNOR_ROLE, governor);
        }

        // ── Views ──

        fn get_claim(self: @ContractState, claim_id: u256) -> ClaimData {
            let node = self.claims.entry(claim_id);
            let claimant = node.claimant.read();
            assert(claimant.is_non_zero(), 'Claim does not exist');
            ClaimData {
                claim_id,
                claimant,
                token_id: node.token_id.read(),
                protocol_id: node.protocol_id.read(),
                coverage_amount: node.coverage_amount.read(),
                status: node.status.read(),
                submitted_at: node.submitted_at.read(),
                resolved_at: node.resolved_at.read(),
            }
        }

        fn get_claim_status(self: @ContractState, claim_id: u256) -> felt252 {
            self.claims.entry(claim_id).status.read()
        }

        fn is_governor(self: @ContractState, account: ContractAddress) -> bool {
            self.access_control.has_role(GOVERNOR_ROLE, account)
        }

        fn next_claim_id(self: @ContractState) -> u256 {
            self.next_claim_id.read()
        }

        fn is_token_claimed(self: @ContractState, token_id: u256) -> bool {
            self.token_claimed.entry(token_id).read()
        }
    }
}
