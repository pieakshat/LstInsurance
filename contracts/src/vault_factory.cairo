// ═══════════════════════════════════════════════════════════════════════════════
//
// INSURANCE VAULT FACTORY
//
// Deploys protocol-specific BTC-LST underwriting vaults and links them to the
// Protocol Registry. Each protocol gets exactly one vault. The factory uses
// deploy_syscall to instantiate vaults from a stored class hash and
// automatically calls registry.set_vault() to wire everything together.
//
// Deployment flow:
//   1. Governance registers protocol in registry
//   2. Deployer calls factory.create_vault(protocol_id, ...)
//   3. Factory deploys vault + calls registry.set_vault()
//   4. Vault is live for LP deposits
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
    fn set_registry(ref self: TContractState, new_registry: starknet::ContractAddress);

    fn get_vault(self: @TContractState, protocol_id: u256) -> starknet::ContractAddress;
    fn get_protocol(self: @TContractState, vault: starknet::ContractAddress) -> u256;
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
        vault_by_protocol: Map<u256, ContractAddress>,
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
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultCreated {
        #[key]
        pub protocol_id: u256,
        pub vault: ContractAddress,
        pub asset: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultClassUpdated {
        pub new_class_hash: ClassHash,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        registry: ContractAddress,
        vault_class_hash: ClassHash,
        owner: ContractAddress,
    ) {
        assert(registry.is_non_zero(), 'Invalid registry');

        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(DEPLOYER_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(DEPLOYER_ROLE, owner);

        self.registry.write(registry);
        self.vault_class_hash.write(vault_class_hash);
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

            let registry = IProtocolRegistryDispatcher {
                contract_address: self.registry.read(),
            };
            let count = registry.protocol_count();
            assert(protocol_id >= 1 && protocol_id <= count, 'Protocol does not exist');

            // Vault owner = caller (deployer)
            let owner = get_caller_address();
            let mut calldata: Array<felt252> = array![];
            name.serialize(ref calldata);
            symbol.serialize(ref calldata);
            underlying_asset.serialize(ref calldata);
            owner.serialize(ref calldata);

            let salt: felt252 = protocol_id.low.into();
            let (vault_address, _) = deploy_syscall(
                self.vault_class_hash.read(), salt, calldata.span(), false,
            )
                .unwrap_syscall();

            self.vault_by_protocol.entry(protocol_id).write(vault_address);
            self.protocol_by_vault.entry(vault_address).write(protocol_id);

            let idx = self.vault_count.read();
            self.vault_list.entry(idx).write(vault_address);
            self.vault_count.write(idx + 1);

            registry.set_vault(protocol_id, vault_address);

            self.emit(VaultCreated { protocol_id, vault: vault_address, asset: underlying_asset });

            vault_address
        }

        fn set_vault_class_hash(ref self: ContractState, new_hash: ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.vault_class_hash.write(new_hash);
            self.emit(VaultClassUpdated { new_class_hash: new_hash });
        }

        fn set_registry(ref self: ContractState, new_registry: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(new_registry.is_non_zero(), 'Invalid registry');
            self.registry.write(new_registry);
        }

        fn get_vault(self: @ContractState, protocol_id: u256) -> ContractAddress {
            self.vault_by_protocol.entry(protocol_id).read()
        }

        fn get_protocol(self: @ContractState, vault: ContractAddress) -> u256 {
            self.protocol_by_vault.entry(vault).read()
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
