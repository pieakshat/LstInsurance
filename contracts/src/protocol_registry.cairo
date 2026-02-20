// ═══════════════════════════════════════════════════════════════════════════════
//
// PROTOCOL REGISTRY
//
// Onboards and manages partner protocols for the insurance infrastructure.
// Each protocol is linked to a BTC-LST vault and configured with coverage
// parameters (cap, premium rate). Governance controls registration and updates.
//
// ═══════════════════════════════════════════════════════════════════════════════

/// Return type for protocol queries. Mirrors the on-chain storage fields.
#[derive(Drop, Copy, Serde)]
pub struct ProtocolInfo {
    pub protocol_id: u256,
    pub protocol_address: starknet::ContractAddress, // Protocol contract users deposit into
    pub vault: starknet::ContractAddress, // LST-4626 vault 
    pub active: bool, // status of the insurance vault of that particular protocol 
    pub coverage_cap: u256, // maximum insurance coverage allowed for this protocol 
    pub premium_rate: u256, // Base insurance pricing parameter... example: 5% premium for 90 day coverage
}

#[starknet::interface]
pub trait IProtocolRegistry<TContractState> {
    // --- Governance ---
    fn register_protocol(
        ref self: TContractState,
        protocol_address: starknet::ContractAddress,
        vault: starknet::ContractAddress,
        coverage_cap: u256,
        premium_rate: u256,
    ) -> u256;
    fn set_vault(ref self: TContractState, protocol_id: u256, vault: starknet::ContractAddress);
    fn set_coverage_params(
        ref self: TContractState, protocol_id: u256, coverage_cap: u256, premium_rate: u256,
    );
    fn pause_protocol(ref self: TContractState, protocol_id: u256);
    fn activate_protocol(ref self: TContractState, protocol_id: u256);

    // --- Admin ---
    fn set_governance(ref self: TContractState, account: starknet::ContractAddress);

    // --- Views ---
    fn get_protocol(self: @TContractState, protocol_id: u256) -> ProtocolInfo;
    fn get_vault(self: @TContractState, protocol_id: u256) -> starknet::ContractAddress;
    fn get_protocol_id(self: @TContractState, protocol_address: starknet::ContractAddress) -> u256;
    fn is_active(self: @TContractState, protocol_id: u256) -> bool;
    fn protocol_count(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod ProtocolRegistry {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::interfaces::upgrades::IUpgradeable;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::upgradeable::UpgradeableComponent;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::ContractAddress;
    use super::ProtocolInfo;

    // --- Access Control Roles ---
    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const GOVERNANCE_ROLE: felt252 = selector!("GOVERNANCE_ROLE");

    // --- Protocol Storage Node ---
    #[starknet::storage_node]
    struct ProtocolNode {
        protocol_address: ContractAddress,
        vault: ContractAddress,
        active: bool,
        coverage_cap: u256,
        premium_rate: u256,
    }

    // --- Components ---
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
        protocols: Map<u256, ProtocolNode>,
        protocol_id_by_address: Map<ContractAddress, u256>,
        protocol_count: u256,
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
        ProtocolRegistered: ProtocolRegistered,
        ProtocolPaused: ProtocolPaused,
        ProtocolActivated: ProtocolActivated,
        VaultUpdated: VaultUpdated,
        CoverageParamsUpdated: CoverageParamsUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProtocolRegistered {
        #[key]
        pub protocol_id: u256,
        pub protocol_address: ContractAddress,
        pub vault: ContractAddress,
        pub coverage_cap: u256,
        pub premium_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProtocolPaused {
        #[key]
        pub protocol_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProtocolActivated {
        #[key]
        pub protocol_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct VaultUpdated {
        #[key]
        pub protocol_id: u256,
        pub vault: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageParamsUpdated {
        #[key]
        pub protocol_id: u256,
        pub coverage_cap: u256,
        pub premium_rate: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(GOVERNANCE_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: starknet::ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }


    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Asserts that a protocol_id has been registered (id >= 1 && id <= count).
        fn _assert_valid_protocol(self: @ContractState, protocol_id: u256) {
            let count = self.protocol_count.read();
            assert(protocol_id >= 1 && protocol_id <= count, 'Protocol does not exist');
        }

        /// Reads all fields from a ProtocolNode into a ProtocolInfo return struct.
        fn _read_protocol(self: @ContractState, protocol_id: u256) -> ProtocolInfo {
            let node = self.protocols.entry(protocol_id);
            ProtocolInfo {
                protocol_id,
                protocol_address: node.protocol_address.read(),
                vault: node.vault.read(),
                active: node.active.read(),
                coverage_cap: node.coverage_cap.read(),
                premium_rate: node.premium_rate.read(),
            }
        }
    }

    #[abi(embed_v0)]
    pub impl ProtocolRegistryImpl of super::IProtocolRegistry<ContractState> {
        // --- Governance ---

        fn register_protocol(
            ref self: ContractState,
            protocol_address: ContractAddress, // address of the protocol vault that the insurance will cover 
            vault: ContractAddress, // address of the lst vault
            coverage_cap: u256,
            premium_rate: u256,
        ) -> u256 {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);

            assert(protocol_address.is_non_zero(), 'Invalid protocol address');
            assert(coverage_cap.is_non_zero(), 'Coverage cap must be > 0');
            assert(premium_rate.is_non_zero(), 'Premium rate must be > 0');

            let existing_id = self.protocol_id_by_address.entry(protocol_address).read();
            assert(existing_id.is_zero(), 'Protocol already registered');

            let protocol_id = self.protocol_count.read() + 1;
            self.protocol_count.write(protocol_id);

            let node = self.protocols.entry(protocol_id);
            node.protocol_address.write(protocol_address);
            node.vault.write(vault);
            node.active.write(true);
            node.coverage_cap.write(coverage_cap);
            node.premium_rate.write(premium_rate);

            self.protocol_id_by_address.entry(protocol_address).write(protocol_id);

            self
                .emit(
                    ProtocolRegistered {
                        protocol_id, protocol_address, vault, coverage_cap, premium_rate,
                    },
                );

            protocol_id
        }

        fn set_vault(ref self: ContractState, protocol_id: u256, vault: ContractAddress) {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);
            self._assert_valid_protocol(protocol_id);
            assert(vault.is_non_zero(), 'Invalid vault address');

            self.protocols.entry(protocol_id).vault.write(vault);

            self.emit(VaultUpdated { protocol_id, vault });
        }

        fn set_coverage_params(
            ref self: ContractState, protocol_id: u256, coverage_cap: u256, premium_rate: u256,
        ) {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);
            self._assert_valid_protocol(protocol_id);
            assert(coverage_cap.is_non_zero(), 'Coverage cap must be > 0');
            assert(premium_rate.is_non_zero(), 'Premium rate must be > 0');

            let node = self.protocols.entry(protocol_id);
            node.coverage_cap.write(coverage_cap);
            node.premium_rate.write(premium_rate);

            self.emit(CoverageParamsUpdated { protocol_id, coverage_cap, premium_rate });
        }

        fn pause_protocol(ref self: ContractState, protocol_id: u256) {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);
            self._assert_valid_protocol(protocol_id);

            let node = self.protocols.entry(protocol_id);
            assert(node.active.read(), 'Protocol already paused');
            node.active.write(false);

            self.emit(ProtocolPaused { protocol_id });
        }

        fn activate_protocol(ref self: ContractState, protocol_id: u256) {
            self.access_control.assert_only_role(GOVERNANCE_ROLE);
            self._assert_valid_protocol(protocol_id);

            let node = self.protocols.entry(protocol_id);
            assert(!node.active.read(), 'Protocol already active');
            node.active.write(true);

            self.emit(ProtocolActivated { protocol_id });
        }

        // --- Admin ---

        fn set_governance(ref self: ContractState, account: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(account.is_non_zero(), 'Invalid address');
            self.access_control._grant_role(GOVERNANCE_ROLE, account);
        }

        // --- Views ---

        fn get_protocol(self: @ContractState, protocol_id: u256) -> ProtocolInfo {
            self._assert_valid_protocol(protocol_id);
            self._read_protocol(protocol_id)
        }

        fn get_vault(self: @ContractState, protocol_id: u256) -> ContractAddress {
            self._assert_valid_protocol(protocol_id);
            self.protocols.entry(protocol_id).vault.read()
        }

        fn get_protocol_id(self: @ContractState, protocol_address: ContractAddress) -> u256 {
            let id = self.protocol_id_by_address.entry(protocol_address).read();
            assert(id.is_non_zero(), 'Protocol not registered');
            id
        }

        fn is_active(self: @ContractState, protocol_id: u256) -> bool {
            self._assert_valid_protocol(protocol_id);
            self.protocols.entry(protocol_id).active.read()
        }

        fn protocol_count(self: @ContractState) -> u256 {
            self.protocol_count.read()
        }
    }
}
