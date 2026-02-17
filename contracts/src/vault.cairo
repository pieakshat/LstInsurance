// ═══════════════════════════════════════════════════════════════════════════════
//
// BTC-LST INSURANCE VAULT
//
// ERC-4626 vault serving as the solvency pool for the insurance protocol.
// LPs deposit BTC-LST and receive vault shares. Yield accrues via LST
// appreciation. Funds are used for insurance payouts when claims are approved.
//
// Key Features:
// - ERC-4626 compliant with share-based accounting
// - Role-based access control (OWNER, PAUSER, CLAIMS_MANAGER)
// - Pausable deposits and withdrawals
// - Configurable deposit cap
// - Claims manager can pull funds for verified payouts
// - LP-initiated liquidity locking for underwriting
//
// ═══════════════════════════════════════════════════════════════════════════════

#[starknet::interface]
pub trait ILstVault<TContractState> {
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn set_deposit_limit(ref self: TContractState, limit: u256);
    fn get_deposit_limit(self: @TContractState) -> u256;

    fn set_claims_manager(ref self: TContractState, claims_manager: starknet::ContractAddress);
    fn get_claims_manager(self: @TContractState) -> starknet::ContractAddress;
    fn withdraw_for_payout(
        ref self: TContractState, to: starknet::ContractAddress, amount: u256,
    );

    fn lock_liquidity(ref self: TContractState, amount: u256, duration: u64);
    fn unlock_liquidity(ref self: TContractState, lock_id: u32);
    fn locked_balance(self: @TContractState, user: starknet::ContractAddress) -> u256;
    fn total_locked_liquidity(self: @TContractState) -> u256;
    fn available_liquidity(self: @TContractState) -> u256;

    fn solvency_assets(self: @TContractState) -> u256;
    fn solvency_locked(self: @TContractState) -> u256;
    fn coverage_capacity(self: @TContractState, leverage: u256) -> u256;

    fn total_payouts(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod LstVault {
    use core::num::traits::{Bounded, Zero};
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::interfaces::erc20::{
        ERC20ABIDispatcher, ERC20ABIDispatcherTrait, IERC20Metadata,
    };
    use openzeppelin::interfaces::upgrades::IUpgradeable;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::security::pausable::PausableComponent;
    use openzeppelin::token::erc20::extensions::erc4626::ERC4626Component::Fee;
    use openzeppelin::token::erc20::extensions::erc4626::{DefaultConfig, ERC4626Component};
    use openzeppelin::token::erc20::{
        DefaultConfig as ERC20DefaultConfig, ERC20Component, ERC20HooksEmptyImpl,
    };
    use openzeppelin::upgrades::upgradeable::UpgradeableComponent;
    use openzeppelin::utils::math::Rounding;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};

    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");
    pub const CLAIMS_MANAGER_ROLE: felt252 = selector!("CLAIMS_MANAGER_ROLE");

    #[starknet::storage_node]
    struct LockNode {
        amount: u256,
        unlock_time: u64,
    }

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: ERC4626Component, storage: erc4626, event: ERC4626Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl ERC4626Impl = ERC4626Component::ERC4626Impl<ContractState>;
    impl ERC4626InternalImpl = ERC4626Component::InternalImpl<ContractState>;

    impl ERC4626FeesImpl of ERC4626Component::FeeConfigTrait<ContractState> {
        fn calculate_deposit_fee(
            self: @ERC4626Component::ComponentState<ContractState>, assets: u256, shares: u256,
        ) -> Option<Fee> {
            Option::None
        }

        fn calculate_mint_fee(
            self: @ERC4626Component::ComponentState<ContractState>, assets: u256, shares: u256,
        ) -> Option<Fee> {
            Option::None
        }

        fn calculate_withdraw_fee(
            self: @ERC4626Component::ComponentState<ContractState>, assets: u256, shares: u256,
        ) -> Option<Fee> {
            Option::None
        }

        fn calculate_redeem_fee(
            self: @ERC4626Component::ComponentState<ContractState>, assets: u256, shares: u256,
        ) -> Option<Fee> {
            Option::None
        }
    }

    impl ERC4626LimitConfigImpl of ERC4626Component::LimitConfigTrait<ContractState> {
        fn deposit_limit(
            self: @ERC4626Component::ComponentState<ContractState>, receiver: ContractAddress,
        ) -> Option<u256> {
            let contract_state = self.get_contract();
            let limit = contract_state.deposit_limit.read();
            if limit == Bounded::MAX {
                Option::None
            } else {
                let total_assets = self.get_total_assets();
                if total_assets >= limit {
                    Option::Some(0)
                } else {
                    Option::Some(limit - total_assets)
                }
            }
        }

        fn mint_limit(
            self: @ERC4626Component::ComponentState<ContractState>, receiver: ContractAddress,
        ) -> Option<u256> {
            let deposit_limit_opt = self.deposit_limit(receiver);
            match deposit_limit_opt {
                Option::None => Option::None,
                Option::Some(deposit_remaining) => {
                    Option::Some(self._convert_to_shares(deposit_remaining, Rounding::Floor))
                },
            }
        }

        fn withdraw_limit(
            self: @ERC4626Component::ComponentState<ContractState>, owner: ContractAddress,
        ) -> Option<u256> {
            let contract_state = self.get_contract();
            let locked = InternalImpl::_locked_balance_of(contract_state, owner);
            if locked.is_zero() {
                Option::None
            } else {
                let user_shares = contract_state.erc20.ERC20_balances.entry(owner).read();
                let user_assets = self._convert_to_assets(user_shares, Rounding::Floor);
                if user_assets > locked {
                    Option::Some(user_assets - locked)
                } else {
                    Option::Some(0)
                }
            }
        }

        fn redeem_limit(
            self: @ERC4626Component::ComponentState<ContractState>, owner: ContractAddress,
        ) -> Option<u256> {
            let contract_state = self.get_contract();
            let locked = InternalImpl::_locked_balance_of(contract_state, owner);
            if locked.is_zero() {
                Option::None
            } else {
                let user_shares = contract_state.erc20.ERC20_balances.entry(owner).read();
                let user_assets = self._convert_to_assets(user_shares, Rounding::Floor);
                if user_assets > locked {
                    let withdrawable_assets = user_assets - locked;
                    Option::Some(
                        self._convert_to_shares(withdrawable_assets, Rounding::Floor),
                    )
                } else {
                    Option::Some(0)
                }
            }
        }
    }

    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20CamelOnlyImpl = ERC20Component::ERC20CamelOnlyImpl<ContractState>;

    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        erc4626: ERC4626Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        decimals: u8,
        deposit_limit: u256,
        claims_manager: ContractAddress,
        total_payouts: u256,
        lp_lock_count: Map<ContractAddress, u32>,
        lp_locks: Map<ContractAddress, Map<u32, LockNode>>,
        locked_liquidity: u256,
        total_raw_locked: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        ERC4626Event: ERC4626Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        PayoutWithdrawn: PayoutWithdrawn,
        LiquidityLocked: LiquidityLocked,
        LiquidityUnlocked: LiquidityUnlocked,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutWithdrawn {
        pub to: ContractAddress,
        pub amount: u256,
        pub total_payouts: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LiquidityLocked {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub unlock_time: u64,
        pub lock_id: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LiquidityUnlocked {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub lock_id: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying_asset: ContractAddress,
        owner: ContractAddress,
    ) {
        self.erc20.initializer(name, symbol);
        self.erc4626.initializer(underlying_asset);
        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(PAUSER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(CLAIMS_MANAGER_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(PAUSER_ROLE, owner);

        self.decimals.write(ERC20ABIDispatcher { contract_address: underlying_asset }.decimals());
        self.deposit_limit.write(Bounded::MAX);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: starknet::ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    /// total_assets = vault's underlying token balance.
    /// Payouts decrease balance → share price drops → LPs absorb the loss.
    impl VaultAssetsManagementImpl of ERC4626Component::AssetsManagementTrait<ContractState> {
        fn get_total_assets(self: @ERC4626Component::ComponentState<ContractState>) -> u256 {
            let vault_address = starknet::get_contract_address();
            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.ERC4626_asset.read(),
            };
            asset_dispatcher.balance_of(vault_address)
        }

        fn transfer_assets_in(
            ref self: ERC4626Component::ComponentState<ContractState>,
            from: ContractAddress,
            assets: u256,
        ) {
            let this = starknet::get_contract_address();
            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.ERC4626_asset.read(),
            };
            assert(
                asset_dispatcher.transfer_from(from, this, assets),
                ERC4626Component::Errors::TOKEN_TRANSFER_FAILED,
            );
        }

        fn transfer_assets_out(
            ref self: ERC4626Component::ComponentState<ContractState>,
            to: ContractAddress,
            assets: u256,
        ) {
            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.ERC4626_asset.read(),
            };
            assert(
                asset_dispatcher.transfer(to, assets),
                ERC4626Component::Errors::TOKEN_TRANSFER_FAILED,
            );
        }
    }

    pub impl VaultHooksImpl of ERC4626Component::ERC4626HooksTrait<ContractState> {
        fn before_deposit(
            ref self: ERC4626Component::ComponentState<ContractState>,
            caller: ContractAddress,
            receiver: ContractAddress,
            assets: u256,
            shares: u256,
            fee: Option<Fee>,
        ) {
            let contract_state = self.get_contract();
            contract_state.pausable.assert_not_paused();
        }

        fn after_deposit(
            ref self: ERC4626Component::ComponentState<ContractState>,
            caller: ContractAddress,
            receiver: ContractAddress,
            assets: u256,
            shares: u256,
            fee: Option<Fee>,
        ) {}

        fn before_withdraw(
            ref self: ERC4626Component::ComponentState<ContractState>,
            caller: ContractAddress,
            receiver: ContractAddress,
            owner: ContractAddress,
            assets: u256,
            shares: u256,
            fee: Option<Fee>,
        ) {
            let contract_state = self.get_contract();
            contract_state.pausable.assert_not_paused();

            let locked = InternalImpl::_locked_balance_of(contract_state, owner);
            if locked > 0 {
                let user_shares = contract_state.erc20.ERC20_balances.entry(owner).read();
                let user_assets = self._convert_to_assets(user_shares, Rounding::Floor);
                let withdrawable = if user_assets > locked {
                    user_assets - locked
                } else {
                    0
                };
                assert(assets <= withdrawable, 'Liquidity locked');
            }
        }

        fn after_withdraw(
            ref self: ERC4626Component::ComponentState<ContractState>,
            caller: ContractAddress,
            receiver: ContractAddress,
            owner: ContractAddress,
            assets: u256,
            shares: u256,
            fee: Option<Fee>,
        ) {}
    }

    #[abi(embed_v0)]
    pub impl VaultMetadataImpl of IERC20Metadata<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Returns the effective (diluted) locked balance for a user.
        /// After a payout, locked_liquidity decreases but total_raw_locked stays
        /// the same, so each LP's effective lock shrinks proportionally.
        fn _locked_balance_of(self: @ContractState, user: ContractAddress) -> u256 {
            let lock_count = self.lp_lock_count.entry(user).read();
            let now = get_block_timestamp();
            let mut raw_total: u256 = 0;
            let mut i: u32 = 0;
            loop {
                if i >= lock_count {
                    break;
                }
                let lock = self.lp_locks.entry(user).entry(i);
                let amount = lock.amount.read();
                if amount > 0 && now < lock.unlock_time.read() {
                    raw_total += amount;
                }
                i += 1;
            };

            let total_raw = self.total_raw_locked.read();
            if total_raw.is_zero() || raw_total.is_zero() {
                return 0;
            }

            let locked = self.locked_liquidity.read();
            raw_total * locked / total_raw
        }

        fn _total_assets(self: @ContractState) -> u256 {
            let vault_address = starknet::get_contract_address();
            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.erc4626.ERC4626_asset.read(),
            };
            asset_dispatcher.balance_of(vault_address)
        }
    }

    #[abi(embed_v0)]
    pub impl LstVaultImpl of super::ILstVault<ContractState> {
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.pausable.unpause();
        }

        fn set_deposit_limit(ref self: ContractState, limit: u256) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.deposit_limit.write(limit);
        }

        fn get_deposit_limit(self: @ContractState) -> u256 {
            self.deposit_limit.read()
        }

        fn set_claims_manager(ref self: ContractState, claims_manager: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            let old = self.claims_manager.read();
            if old.is_non_zero() {
                self.access_control._revoke_role(CLAIMS_MANAGER_ROLE, old);
            }
            self.claims_manager.write(claims_manager);
            self.access_control._grant_role(CLAIMS_MANAGER_ROLE, claims_manager);
        }

        fn get_claims_manager(self: @ContractState) -> ContractAddress {
            self.claims_manager.read()
        }

        /// Pulls BTC-LST from vault for a verified claim. Reduces locked liquidity.
        fn withdraw_for_payout(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.access_control.assert_only_role(CLAIMS_MANAGER_ROLE);
            assert(amount.is_non_zero(), 'Amount cannot be 0');
            assert(to.is_non_zero(), 'Invalid recipient');

            let current_locked = self.locked_liquidity.read();
            assert(amount <= current_locked, 'Exceeds locked liquidity');

            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.erc4626.ERC4626_asset.read(),
            };
            assert(asset_dispatcher.transfer(to, amount), 'Payout transfer failed');

            self.locked_liquidity.write(current_locked - amount);

            let new_total = self.total_payouts.read() + amount;
            self.total_payouts.write(new_total);

            self.emit(PayoutWithdrawn { to, amount, total_payouts: new_total });
        }

        fn lock_liquidity(ref self: ContractState, amount: u256, duration: u64) {
            let caller = get_caller_address();
            assert(amount.is_non_zero(), 'Amount must be > 0');

            let shares = self.erc20.ERC20_balances.entry(caller).read();
            let user_assets = self.erc4626._convert_to_assets(shares, Rounding::Floor);
            let locked = self._locked_balance_of(caller);
            assert(user_assets >= locked, 'Assets below locked amount');
            let unlocked = user_assets - locked;
            assert(unlocked >= amount, 'Insufficient unlocked assets');

            let unlock_time = get_block_timestamp() + duration;
            let lock_id = self.lp_lock_count.entry(caller).read();

            let lock = self.lp_locks.entry(caller).entry(lock_id);
            lock.amount.write(amount);
            lock.unlock_time.write(unlock_time);

            self.lp_lock_count.entry(caller).write(lock_id + 1);
            self.locked_liquidity.write(self.locked_liquidity.read() + amount);
            self.total_raw_locked.write(self.total_raw_locked.read() + amount);

            self.emit(LiquidityLocked { user: caller, amount, unlock_time, lock_id });
        }

        fn unlock_liquidity(ref self: ContractState, lock_id: u32) {
            let caller = get_caller_address();
            let lock_count = self.lp_lock_count.entry(caller).read();
            assert(lock_id < lock_count, 'Invalid lock id');

            let lock = self.lp_locks.entry(caller).entry(lock_id);
            let raw_amount = lock.amount.read();

            assert(raw_amount.is_non_zero(), 'Lock already unlocked');
            assert(get_block_timestamp() >= lock.unlock_time.read(), 'Lock not expired');

            lock.amount.write(0);
            lock.unlock_time.write(0);

            // Compute effective (diluted) amount this lock is worth
            let current_locked = self.locked_liquidity.read();
            let total_raw = self.total_raw_locked.read();
            let effective = if total_raw.is_non_zero() {
                raw_amount * current_locked / total_raw
            } else {
                0
            };

            // Decrement locked_liquidity by effective, total_raw_locked by raw
            if effective <= current_locked {
                self.locked_liquidity.write(current_locked - effective);
            } else {
                self.locked_liquidity.write(0);
            }

            if raw_amount <= total_raw {
                self.total_raw_locked.write(total_raw - raw_amount);
            } else {
                self.total_raw_locked.write(0);
            }

            self.emit(LiquidityUnlocked { user: caller, amount: raw_amount, lock_id });
        }

        fn locked_balance(self: @ContractState, user: ContractAddress) -> u256 {
            self._locked_balance_of(user)
        }

        fn total_locked_liquidity(self: @ContractState) -> u256 {
            self.locked_liquidity.read()
        }

        fn available_liquidity(self: @ContractState) -> u256 {
            let total = self._total_assets();
            let locked = self.locked_liquidity.read();
            if total > locked {
                total - locked
            } else {
                0
            }
        }

        fn solvency_assets(self: @ContractState) -> u256 {
            self._total_assets()
        }

        fn solvency_locked(self: @ContractState) -> u256 {
            self.locked_liquidity.read()
        }

        fn coverage_capacity(self: @ContractState, leverage: u256) -> u256 {
            self.locked_liquidity.read() * leverage
        }

        fn total_payouts(self: @ContractState) -> u256 {
            self.total_payouts.read()
        }
    }
}
