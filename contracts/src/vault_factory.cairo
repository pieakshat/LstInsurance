// ═══════════════════════════════════════════════════════════════════════════════
//
// INSURANCE VAULT FACTORY
//
// Deploys protocol-specific BTC-LST underwriting vaults, their paired
// premium modules, and a ClaimsManager — then links them to the Protocol
// Registry. Each protocol gets exactly one vault + premium module + claims
// manager. The factory uses deploy_syscall to instantiate all three from
// stored class hashes and automatically calls registry.set_vault() to wire
// the vault into the registry.
//
// Deployment flow:
//   1. Governance registers protocol in registry
//   2. Deployer calls factory.create_vault(protocol_id, ...)
//   3. Factory deploys vault + premium module + claims manager
//   4. Factory calls registry.set_vault() to register the vault
//   5. Admin panel grants MINTER/BURNER roles and wires permissions
//   6. System is live for LP deposits and coverage purchases
//
// ═══════════════════════════════════════════════════════════════════════════════

#[starknet::interface]
pub trait IInsuranceVaultFactory<TContractState> {
    fn create_vault(
        ref self: TContractState,
        protocol_id: u256,
        name: ByteArray,
        symbol: ByteArray,
        underlying_asset: starknet::ContractAddress,
    ) -> starknet::ContractAddress;

    fn set_vault_class_hash(ref self: TContractState, new_hash: starknet::ClassHash);
    fn set_premium_class_hash(ref self: TContractState, new_hash: starknet::ClassHash);
    fn set_claims_class_hash(ref self: TContractState, new_hash: starknet::ClassHash);
    fn set_registry(ref self: TContractState, new_registry: starknet::ContractAddress);
    fn set_coverage_token(ref self: TContractState, token: starknet::ContractAddress);
    fn set_premium_asset(ref self: TContractState, asset: starknet::ContractAddress);

    fn get_vault(self: @TContractState, protocol_id: u256) -> starknet::ContractAddress;
    fn get_premium_module(self: @TContractState, protocol_id: u256) -> starknet::ContractAddress;
    fn get_claims_manager(self: @TContractState, protocol_id: u256) -> starknet::ContractAddress;
    fn get_protocol(self: @TContractState, vault: starknet::ContractAddress) -> u256;
    fn get_premium_asset(self: @TContractState) -> starknet::ContractAddress;
    fn all_vaults(self: @TContractState) -> Array<starknet::ContractAddress>;
    fn vault_count(self: @TContractState) -> u32;
}

#[starknet::contract]
pub mod InsuranceVaultFactory {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::interfaces::upgrades::IUpgradeable;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::upgradeable::UpgradeableComponent;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_caller_address,
        syscalls::deploy_syscall,
    };

    use contracts::protocol_registry::{
        IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
    };

    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const DEPLOYER_ROLE: felt252 = selector!("DEPLOYER_ROLE");

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
        registry: ContractAddress,
        vault_class_hash: ClassHash,
        premium_class_hash: ClassHash,
        claims_class_hash: ClassHash,
        coverage_token: ContractAddress,
        // Token users pay premiums in (e.g. USDC). Separate from the vault's
        // underlying_asset (BTC-LST) which backs the coverage pool.
        premium_asset: ContractAddress,
        vault_by_protocol: Map<u256, ContractAddress>,
        premium_by_protocol: Map<u256, ContractAddress>,
        claims_by_protocol: Map<u256, ContractAddress>,
        protocol_by_vault: Map<ContractAddress, u256>,
        vault_count: u32,
        vault_list: Map<u32, ContractAddress>,
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
        VaultCreated: VaultCreated,
        VaultClassUpdated: VaultClassUpdated,
        PremiumClassUpdated: PremiumClassUpdated,
        ClaimsClassUpdated: ClaimsClassUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultCreated {
        #[key]
        pub protocol_id: u256,
        pub vault: ContractAddress,
        pub premium_module: ContractAddress,
        pub claims_manager: ContractAddress,
        pub asset: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultClassUpdated {
        pub new_class_hash: ClassHash,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PremiumClassUpdated {
        pub new_class_hash: ClassHash,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClaimsClassUpdated {
        pub new_class_hash: ClassHash,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        registry: ContractAddress,
        vault_class_hash: ClassHash,
        premium_class_hash: ClassHash,
        claims_class_hash: ClassHash,
        coverage_token: ContractAddress,
        premium_asset: ContractAddress,
        owner: ContractAddress,
    ) {
        assert(registry.is_non_zero(), 'Invalid registry');
        assert(coverage_token.is_non_zero(), 'Invalid coverage token');
        assert(premium_asset.is_non_zero(), 'Invalid premium asset');

        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(DEPLOYER_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(DEPLOYER_ROLE, owner);

        self.registry.write(registry);
        self.vault_class_hash.write(vault_class_hash);
        self.premium_class_hash.write(premium_class_hash);
        self.claims_class_hash.write(claims_class_hash);
        self.coverage_token.write(coverage_token);
        self.premium_asset.write(premium_asset);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    pub impl InsuranceVaultFactoryImpl of super::IInsuranceVaultFactory<ContractState> {
        fn create_vault(
            ref self: ContractState,
            protocol_id: u256,
            name: ByteArray,
            symbol: ByteArray,
            underlying_asset: ContractAddress,
        ) -> ContractAddress {
            self.access_control.assert_only_role(DEPLOYER_ROLE);
            assert(underlying_asset.is_non_zero(), 'Invalid asset address');

            let existing = self.vault_by_protocol.entry(protocol_id).read();
            assert(existing.is_zero(), 'Vault already deployed');

            let registry_addr = self.registry.read();
            let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };
            let count = registry.protocol_count();
            assert(protocol_id >= 1 && protocol_id <= count, 'Protocol does not exist');

            let owner = get_caller_address();

            // --- Deploy vault ---
            let mut vault_calldata: Array<felt252> = array![];
            name.serialize(ref vault_calldata);
            symbol.serialize(ref vault_calldata);
            underlying_asset.serialize(ref vault_calldata);
            owner.serialize(ref vault_calldata);

            let vault_salt: felt252 = protocol_id.low.into();
            let (vault_address, _) = deploy_syscall(
                self.vault_class_hash.read(), vault_salt, vault_calldata.span(), false,
            )
                .unwrap_syscall();

            // --- Deploy premium module ---
            // NOTE: premium_asset (e.g. USDC) is separate from underlying_asset (BTC-LST).
            // The vault holds BTC-LST for coverage payouts; the PM pulls USDC from users
            // as the premium payment token.
            let coverage_token = self.coverage_token.read();
            let premium_asset = self.premium_asset.read();
            let mut pm_calldata: Array<felt252> = array![];
            protocol_id.serialize(ref pm_calldata);
            vault_address.serialize(ref pm_calldata);
            registry_addr.serialize(ref pm_calldata);
            coverage_token.serialize(ref pm_calldata);
            premium_asset.serialize(ref pm_calldata);
            owner.serialize(ref pm_calldata);

            let pm_salt: felt252 = (protocol_id.low + 0x50524D).into();
            let (pm_address, _) = deploy_syscall(
                self.premium_class_hash.read(), pm_salt, pm_calldata.span(), false,
            )
                .unwrap_syscall();

            // --- Deploy claims manager ---
            let mut cm_calldata: Array<felt252> = array![];
            vault_address.serialize(ref cm_calldata);
            coverage_token.serialize(ref cm_calldata);
            pm_address.serialize(ref cm_calldata);
            owner.serialize(ref cm_calldata);

            let cm_salt: felt252 = (protocol_id.low + 0x434D).into();
            let (cm_address, _) = deploy_syscall(
                self.claims_class_hash.read(), cm_salt, cm_calldata.span(), false,
            )
                .unwrap_syscall();

            // --- Store mappings ---
            self.vault_by_protocol.entry(protocol_id).write(vault_address);
            self.premium_by_protocol.entry(protocol_id).write(pm_address);
            self.claims_by_protocol.entry(protocol_id).write(cm_address);
            self.protocol_by_vault.entry(vault_address).write(protocol_id);

            let idx = self.vault_count.read();
            self.vault_list.entry(idx).write(vault_address);
            self.vault_count.write(idx + 1);

            // Wire vault to registry
            registry.set_vault(protocol_id, vault_address);

            self
                .emit(
                    VaultCreated {
                        protocol_id,
                        vault: vault_address,
                        premium_module: pm_address,
                        claims_manager: cm_address,
                        asset: underlying_asset,
                    },
                );

            vault_address
        }

        fn set_vault_class_hash(ref self: ContractState, new_hash: ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.vault_class_hash.write(new_hash);
            self.emit(VaultClassUpdated { new_class_hash: new_hash });
        }

        fn set_premium_class_hash(ref self: ContractState, new_hash: ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.premium_class_hash.write(new_hash);
            self.emit(PremiumClassUpdated { new_class_hash: new_hash });
        }

        fn set_claims_class_hash(ref self: ContractState, new_hash: ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.claims_class_hash.write(new_hash);
            self.emit(ClaimsClassUpdated { new_class_hash: new_hash });
        }

        fn set_registry(ref self: ContractState, new_registry: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(new_registry.is_non_zero(), 'Invalid registry');
            self.registry.write(new_registry);
        }

        fn set_coverage_token(ref self: ContractState, token: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(token.is_non_zero(), 'Invalid coverage token');
            self.coverage_token.write(token);
        }

        fn set_premium_asset(ref self: ContractState, asset: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(asset.is_non_zero(), 'Invalid premium asset');
            self.premium_asset.write(asset);
        }

        fn get_vault(self: @ContractState, protocol_id: u256) -> ContractAddress {
            self.vault_by_protocol.entry(protocol_id).read()
        }

        fn get_premium_module(self: @ContractState, protocol_id: u256) -> ContractAddress {
            self.premium_by_protocol.entry(protocol_id).read()
        }

        fn get_claims_manager(self: @ContractState, protocol_id: u256) -> ContractAddress {
            self.claims_by_protocol.entry(protocol_id).read()
        }

        fn get_protocol(self: @ContractState, vault: ContractAddress) -> u256 {
            self.protocol_by_vault.entry(vault).read()
        }

        fn get_premium_asset(self: @ContractState) -> ContractAddress {
            self.premium_asset.read()
        }

        fn all_vaults(self: @ContractState) -> Array<ContractAddress> {
            let count = self.vault_count.read();
            let mut vaults: Array<ContractAddress> = array![];
            let mut i: u32 = 0;
            loop {
                if i >= count {
                    break;
                }
                vaults.append(self.vault_list.entry(i).read());
                i += 1;
            };
            vaults
        }

        fn vault_count(self: @ContractState) -> u32 {
            self.vault_count.read()
        }
    }
}
