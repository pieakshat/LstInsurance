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
//
// ═══════════════════════════════════════════════════════════════════════════════

#[starknet::interface]
pub trait ILstVault<TContractState> {
    // --- Admin ---
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn set_deposit_limit(ref self: TContractState, limit: u256);
    fn get_deposit_limit(self: @TContractState) -> u256;

    // --- Claims Manager ---
    fn set_claims_manager(ref self: TContractState, claims_manager: starknet::ContractAddress);
    fn get_claims_manager(self: @TContractState) -> starknet::ContractAddress;
    fn withdraw_for_payout(
        ref self: TContractState, to: starknet::ContractAddress, amount: u256,
    );

    // --- View ---
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
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};

    // --- Access Control Roles ---
    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");
    pub const CLAIMS_MANAGER_ROLE: felt252 = selector!("CLAIMS_MANAGER_ROLE");

    // --- OpenZeppelin Component Integrations ---
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: ERC4626Component, storage: erc4626, event: ERC4626Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    // --- ERC4626 Implementation ---
    #[abi(embed_v0)]
    impl ERC4626Impl = ERC4626Component::ERC4626Impl<ContractState>;
    impl ERC4626InternalImpl = ERC4626Component::InternalImpl<ContractState>;

    // No fees on deposit/mint/withdraw/redeem
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

    // --- Deposit/Withdraw Limits ---
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
            Option::None
        }

        fn redeem_limit(
            self: @ERC4626Component::ComponentState<ContractState>, owner: ContractAddress,
        ) -> Option<u256> {
            Option::None
        }
    }

    // --- ERC20 Implementation ---
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20CamelOnlyImpl = ERC20Component::ERC20CamelOnlyImpl<ContractState>;

    // --- Access Control Implementation ---
    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    // --- Pausable Implementation ---
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // =========================================================================
    // Storage
    // =========================================================================

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
    }

    // =========================================================================
    // Events
    // =========================================================================

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
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutWithdrawn {
        pub to: ContractAddress,
        pub amount: u256,
        pub total_payouts: u256,
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying_asset: ContractAddress,
        owner: ContractAddress,
    ) {
        // Init components
        self.erc20.initializer(name, symbol);
        self.erc4626.initializer(underlying_asset);
        self.access_control.initializer();

        // Role hierarchy
        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(PAUSER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(CLAIMS_MANAGER_ROLE, OWNER_ROLE);

        // Grant owner all roles
        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(PAUSER_ROLE, owner);

        // Match underlying asset decimals
        self.decimals.write(ERC20ABIDispatcher { contract_address: underlying_asset }.decimals());

        // Unlimited deposits by default
        self.deposit_limit.write(Bounded::MAX);
    }

    // =========================================================================
    // Upgradeable
    // =========================================================================

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: starknet::ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    // =========================================================================
    // ERC4626 Asset Management
    // =========================================================================

    /// Total assets = underlying token balance held by this vault contract.
    /// When payouts happen, balance decreases → share price drops → LPs absorb the loss.
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

    // =========================================================================
    // ERC4626 Hooks
    // =========================================================================

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

    // =========================================================================
    // Token Metadata
    // =========================================================================

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

    // =========================================================================
    // Vault Implementation
    // =========================================================================

    #[abi(embed_v0)]
    pub impl LstVaultImpl of super::ILstVault<ContractState> {
        // --- Admin ---

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

        // --- Claims Manager ---

        fn set_claims_manager(ref self: ContractState, claims_manager: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            // Revoke old role if set
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

        /// Pull BTC-LST from vault to pay a verified claim.
        /// Only callable by the claims manager contract.
        fn withdraw_for_payout(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.access_control.assert_only_role(CLAIMS_MANAGER_ROLE);
            assert(amount.is_non_zero(), 'Amount cannot be 0');
            assert(to.is_non_zero(), 'Invalid recipient');

            let asset_dispatcher = ERC20ABIDispatcher {
                contract_address: self.erc4626.asset(),
            };
            assert(asset_dispatcher.transfer(to, amount), 'Payout transfer failed');

            let new_total = self.total_payouts.read() + amount;
            self.total_payouts.write(new_total);

            self.emit(PayoutWithdrawn { to, amount, total_payouts: new_total });
        }

        // --- View ---

        fn total_payouts(self: @ContractState) -> u256 {
            self.total_payouts.read()
        }
    }
}
