// ═══════════════════════════════════════════════════════════════════════════════
//
// PREMIUM MODULE
//
// Handles insurance premium payments and LP premium distribution for a single
// protocol/vault pair. Users pay BTC-LST premiums to purchase coverage and
// receive a CoverageToken NFT. Premiums accumulate per epoch (~monthly) and
// are claimable by LPs based on their snapshotted vault share.
//
// Epoch lifecycle:
//   1. LPs call checkpoint() during the epoch to record their vault shares
//   2. Users buy coverage — premiums accumulate in pending_premiums
//   3. Governance calls advance_epoch() — finalises premiums, snapshots total
//      supply, increments epoch
//   4. LPs call claim_premiums(epoch) for past epochs using their checkpoint
//
// ═══════════════════════════════════════════════════════════════════════════════

#[starknet::interface]
pub trait IPremiumModule<TContractState> {
    fn buy_coverage(
        ref self: TContractState, coverage_amount: u256, duration: u64,
    ) -> u256;
    fn preview_cost(self: @TContractState, coverage_amount: u256, duration: u64) -> u256;
    fn is_subscribed(self: @TContractState, user: starknet::ContractAddress) -> bool;

    fn checkpoint(ref self: TContractState);
    fn claim_premiums(ref self: TContractState, epoch: u32);
    fn claimable(self: @TContractState, epoch: u32, lp: starknet::ContractAddress) -> u256;

    fn advance_epoch(ref self: TContractState);
    fn expire_coverage(ref self: TContractState, token_id: u256);

    fn current_epoch(self: @TContractState) -> u32;
    fn epoch_premiums(self: @TContractState, epoch: u32) -> u256;
    fn total_active_coverage(self: @TContractState) -> u256;
    fn protocol_id(self: @TContractState) -> u256;
    fn pending_premiums(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod PremiumModule {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
    use openzeppelin::interfaces::upgrades::IUpgradeable;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::upgradeable::UpgradeableComponent;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};

    use contracts::coverage_token::{ICoverageTokenDispatcher, ICoverageTokenDispatcherTrait};
    use contracts::protocol_registry::{
        IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
    };

    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const GOVERNANCE_ROLE: felt252 = selector!("GOVERNANCE_ROLE");

    pub const RATE_DENOMINATOR: u256 = 10000;
    pub const BASE_DURATION: u64 = 7776000; // 90 days in seconds

    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        protocol_id: u256,
        vault: ContractAddress,
        registry: ContractAddress,
        coverage_token: ContractAddress,
        asset: ContractAddress,
        total_active_coverage: u256,
        coverage_amounts: Map<u256, u256>, // token_id => coverage_amount
        user_subscribed: Map<ContractAddress, bool>,
        current_epoch: u32,
        epoch_premiums_collected: Map<u32, u256>,
        epoch_total_shares: Map<u32, u256>,
        epoch_start_time: Map<u32, u64>,
        epoch_lp_checkpoint: Map<u32, Map<ContractAddress, u256>>,
        epoch_claimed: Map<u32, Map<ContractAddress, bool>>,
        pending_premiums: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        CoveragePurchased: CoveragePurchased,
        PremiumClaimed: PremiumClaimed,
        EpochAdvanced: EpochAdvanced,
        CoverageExpired: CoverageExpired,
        LPCheckpointed: LPCheckpointed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoveragePurchased {
        #[key]
        pub user: ContractAddress,
        #[key]
        pub token_id: u256,
        pub coverage_amount: u256,
        pub premium_paid: u256,
        pub duration: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PremiumClaimed {
        #[key]
        pub lp: ContractAddress,
        #[key]
        pub epoch: u32,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EpochAdvanced {
        #[key]
        pub epoch: u32,
        pub total_premiums: u256,
        pub total_shares: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageExpired {
        #[key]
        pub token_id: u256,
        pub amount_freed: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LPCheckpointed {
        #[key]
        pub lp: ContractAddress,
        #[key]
        pub epoch: u32,
        pub shares: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        protocol_id: u256,
        vault: ContractAddress,
        registry: ContractAddress,
        coverage_token: ContractAddress,
        asset: ContractAddress,
        owner: ContractAddress,
    ) {
        assert(vault.is_non_zero(), 'Invalid vault');
        assert(registry.is_non_zero(), 'Invalid registry');
        assert(coverage_token.is_non_zero(), 'Invalid coverage token');
        assert(asset.is_non_zero(), 'Invalid asset');

        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(GOVERNANCE_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(GOVERNANCE_ROLE, owner);

        self.protocol_id.write(protocol_id);
        self.vault.write(vault);
        self.registry.write(registry);
        self.coverage_token.write(coverage_token);
        self.asset.write(asset);

        self.current_epoch.write(1);
        self.epoch_start_time.entry(1).write(get_block_timestamp());
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: starknet::ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    fn compute_premium(coverage_amount: u256, premium_rate: u256, duration: u64) -> u256 {
        let duration_u256: u256 = duration.into();
        let base_duration_u256: u256 = BASE_DURATION.into();
        coverage_amount * premium_rate * duration_u256 / (RATE_DENOMINATOR * base_duration_u256)
    }

    #[abi(embed_v0)]
    pub impl PremiumModuleImpl of super::IPremiumModule<ContractState> {
        fn buy_coverage(
            ref self: ContractState, coverage_amount: u256, duration: u64,
        ) -> u256 {
            let caller = get_caller_address();
            assert(coverage_amount.is_non_zero(), 'Coverage must be > 0');
            assert(duration > 0, 'Duration must be > 0');

            let protocol_id = self.protocol_id.read();
            let registry = IProtocolRegistryDispatcher {
                contract_address: self.registry.read(),
            };
            assert(registry.is_active(protocol_id), 'Protocol not active');

            let protocol = registry.get_protocol(protocol_id);

            // Coverage cap enforcement
            let new_total = self.total_active_coverage.read() + coverage_amount;
            assert(new_total <= protocol.coverage_cap, 'Exceeds coverage cap');

            let premium = compute_premium(coverage_amount, protocol.premium_rate, duration);
            assert(premium.is_non_zero(), 'Premium too small');

            // Transfer premium from user to this contract
            let asset = ERC20ABIDispatcher { contract_address: self.asset.read() };
            asset.transfer_from(caller, get_contract_address(), premium);

            // Mint CoverageToken NFT to user
            let coverage_token = ICoverageTokenDispatcher {
                contract_address: self.coverage_token.read(),
            };
            let token_id = coverage_token.mint_coverage(
                caller, protocol_id, coverage_amount, duration, premium,
            );

            self.total_active_coverage.write(new_total);
            self.coverage_amounts.entry(token_id).write(coverage_amount);
            self.user_subscribed.entry(caller).write(true);

            let pending = self.pending_premiums.read();
            self.pending_premiums.write(pending + premium);

            self
                .emit(
                    CoveragePurchased {
                        user: caller, token_id, coverage_amount, premium_paid: premium, duration,
                    },
                );

            token_id
        }

        fn preview_cost(
            self: @ContractState, coverage_amount: u256, duration: u64,
        ) -> u256 {
            let protocol_id = self.protocol_id.read();
            let registry = IProtocolRegistryDispatcher {
                contract_address: self.registry.read(),
            };
            let protocol = registry.get_protocol(protocol_id);
            compute_premium(coverage_amount, protocol.premium_rate, duration)
        }

        fn is_subscribed(self: @ContractState, user: ContractAddress) -> bool {
            self.user_subscribed.entry(user).read()
        }

        fn checkpoint(ref self: ContractState) {
            let caller = get_caller_address();
            let epoch = self.current_epoch.read();

            let existing = self.epoch_lp_checkpoint.entry(epoch).entry(caller).read();
            assert(existing.is_zero(), 'Already checkpointed');

            let vault = ERC20ABIDispatcher { contract_address: self.vault.read() };
            let lp_shares = vault.balance_of(caller);
            assert(lp_shares.is_non_zero(), 'No vault shares');

            self.epoch_lp_checkpoint.entry(epoch).entry(caller).write(lp_shares);

            self.emit(LPCheckpointed { lp: caller, epoch, shares: lp_shares });
        }

        fn claim_premiums(ref self: ContractState, epoch: u32) {
            let caller = get_caller_address();
            let current = self.current_epoch.read();
            assert(epoch < current, 'Epoch not finalized');

            let claimed = self.epoch_claimed.entry(epoch).entry(caller).read();
            assert(!claimed, 'Already claimed');

            let lp_shares = self.epoch_lp_checkpoint.entry(epoch).entry(caller).read();
            assert(lp_shares.is_non_zero(), 'No checkpoint for epoch');

            let total_shares = self.epoch_total_shares.entry(epoch).read();
            assert(total_shares.is_non_zero(), 'No shares in epoch');

            let premiums = self.epoch_premiums_collected.entry(epoch).read();
            let payout = premiums * lp_shares / total_shares;
            assert(payout.is_non_zero(), 'Nothing to claim');

            self.epoch_claimed.entry(epoch).entry(caller).write(true);

            let asset = ERC20ABIDispatcher { contract_address: self.asset.read() };
            asset.transfer(caller, payout);

            self.emit(PremiumClaimed { lp: caller, epoch, amount: payout });
        }

        fn claimable(self: @ContractState, epoch: u32, lp: ContractAddress) -> u256 {
            let current = self.current_epoch.read();
            if epoch >= current {
                return 0;
            }

            if self.epoch_claimed.entry(epoch).entry(lp).read() {
                return 0;
            }

            let lp_shares = self.epoch_lp_checkpoint.entry(epoch).entry(lp).read();
            if lp_shares.is_zero() {
                return 0;
            }

            let total_shares = self.epoch_total_shares.entry(epoch).read();
            if total_shares.is_zero() {
                return 0;
            }

            let premiums = self.epoch_premiums_collected.entry(epoch).read();
            premiums * lp_shares / total_shares
        }

        fn advance_epoch(ref self: ContractState) {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);

            let epoch = self.current_epoch.read();

            // Finalize current epoch
            let premiums = self.pending_premiums.read();
            self.epoch_premiums_collected.entry(epoch).write(premiums);

            // Snapshot vault total supply at epoch end
            let vault = ERC20ABIDispatcher { contract_address: self.vault.read() };
            let total_shares = vault.total_supply();
            self.epoch_total_shares.entry(epoch).write(total_shares);

            // Reset pending and advance
            self.pending_premiums.write(0);
            let new_epoch = epoch + 1;
            self.current_epoch.write(new_epoch);
            self.epoch_start_time.entry(new_epoch).write(get_block_timestamp());

            self.emit(EpochAdvanced { epoch, total_premiums: premiums, total_shares });
        }

        fn expire_coverage(ref self: ContractState, token_id: u256) {
            let coverage_token = ICoverageTokenDispatcher {
                contract_address: self.coverage_token.read(),
            };
            assert(!coverage_token.is_active(token_id), 'Coverage still active');

            let amount = self.coverage_amounts.entry(token_id).read();
            assert(amount.is_non_zero(), 'Not tracked or already expired');

            let current_total = self.total_active_coverage.read();
            if current_total >= amount {
                self.total_active_coverage.write(current_total - amount);
            } else {
                self.total_active_coverage.write(0);
            }

            self.coverage_amounts.entry(token_id).write(0);

            self.emit(CoverageExpired { token_id, amount_freed: amount });
        }

        fn current_epoch(self: @ContractState) -> u32 {
            self.current_epoch.read()
        }

        fn epoch_premiums(self: @ContractState, epoch: u32) -> u256 {
            self.epoch_premiums_collected.entry(epoch).read()
        }

        fn total_active_coverage(self: @ContractState) -> u256 {
            self.total_active_coverage.read()
        }

        fn protocol_id(self: @ContractState) -> u256 {
            self.protocol_id.read()
        }

        fn pending_premiums(self: @ContractState) -> u256 {
            self.pending_premiums.read()
        }
    }
}
