// ═══════════════════════════════════════════════════════════════════════════════
//
// INSURANCE RECEIVER (Starknet OApp)
//
// Starknet-side LayerZero V2 OApp receiver for the cross-chain insurance
// protocol. Receives messages from Base (EVM) and dispatches vault operations.
//
// Message Types:
//   0x01 LOCK_COVERAGE   → vault.lock_for_coverage(amount)
//   0x02 UNLOCK_COVERAGE → vault.unlock_from_coverage(amount)
//   0x03 PAYOUT_CLAIM    → vault.withdraw_for_payout(user, amount)
//
// Message Encoding (packed, big-endian):
//   LOCK/UNLOCK: [msg_type: 1B][protocol_id: 32B][amount: 32B][token_id: 32B]
//   PAYOUT:      [msg_type: 1B][protocol_id: 32B][user_addr: 32B][amount: 32B]
//
// This contract must be registered as both coverage_manager and claims_manager
// on the vault contract after deployment.
//
// ═══════════════════════════════════════════════════════════════════════════════

#[starknet::interface]
pub trait IInsuranceReceiver<TContractState> {
    fn set_vault(ref self: TContractState, vault: starknet::ContractAddress);
    fn set_registry(ref self: TContractState, registry: starknet::ContractAddress);
    fn get_vault(self: @TContractState) -> starknet::ContractAddress;
    fn get_registry(self: @TContractState) -> starknet::ContractAddress;
}

#[starknet::contract]
pub mod InsuranceReceiver {
    use lz_utils::bytes::Bytes32;
    use lz_utils::byte_array_ext::byte_array_ext::ByteArrayTraitExt;
    use openzeppelin::access::ownable::OwnableComponent;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::ContractAddress;
    use layerzero::common::structs::packet::Origin;
    use layerzero::oapps::oapp::oapp_core::OAppCoreComponent;

    // ── Message type constants ──
    pub const MSG_LOCK_COVERAGE: u8 = 0x01;
    pub const MSG_UNLOCK_COVERAGE: u8 = 0x02;
    pub const MSG_PAYOUT_CLAIM: u8 = 0x03;


    component!(path: OAppCoreComponent, storage: oapp_core, event: OAppCoreEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);


    #[abi(embed_v0)]
    impl OAppCoreImpl = OAppCoreComponent::OAppCoreImpl<ContractState>;
    impl OAppCoreInternalImpl = OAppCoreComponent::InternalImpl<ContractState>;


    #[abi(embed_v0)]
    impl ILayerZeroReceiverImpl =
        OAppCoreComponent::LayerZeroReceiverImpl<ContractState>;


    #[abi(embed_v0)]
    impl IOAppReceiverImpl = OAppCoreComponent::OAppReceiverImpl<ContractState>;


    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;


    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        oapp_core: OAppCoreComponent::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        vault: ContractAddress,
        registry: ContractAddress,
    }


    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OAppCoreEvent: OAppCoreComponent::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        CoverageLockReceived: CoverageLockReceived,
        CoverageUnlockReceived: CoverageUnlockReceived,
        PayoutReceived: PayoutReceived,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageLockReceived {
        #[key]
        pub src_eid: u32,
        pub protocol_id: u256,
        pub amount: u256,
        pub token_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageUnlockReceived {
        #[key]
        pub src_eid: u32,
        pub protocol_id: u256,
        pub amount: u256,
        pub token_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutReceived {
        #[key]
        pub src_eid: u32,
        pub protocol_id: u256,
        pub user: ContractAddress,
        pub amount: u256,
    }


    #[starknet::interface]
    trait IVaultCoverage<T> {
        fn lock_for_coverage(ref self: T, amount: u256);
        fn unlock_from_coverage(ref self: T, amount: u256);
        fn withdraw_for_payout(ref self: T, to: ContractAddress, amount: u256);
    }


    #[constructor]
    fn constructor(
        ref self: ContractState,
        endpoint: ContractAddress,
        owner: ContractAddress,
        native_token: ContractAddress,
        vault_address: ContractAddress,
        registry_address: ContractAddress,
    ) {
        self.oapp_core.initializer(endpoint, owner, native_token);
        self.ownable.initializer(owner);
        self.vault.write(vault_address);
        self.registry.write(registry_address);
    }


    #[abi(embed_v0)]
    pub impl InsuranceReceiverImpl of super::IInsuranceReceiver<ContractState> {
        fn set_vault(ref self: ContractState, vault: ContractAddress) {
            self.oapp_core._assert_only_owner();
            self.vault.write(vault);
        }

        fn set_registry(ref self: ContractState, registry: ContractAddress) {
            self.oapp_core._assert_only_owner();
            self.registry.write(registry);
        }

        fn get_vault(self: @ContractState) -> ContractAddress {
            self.vault.read()
        }

        fn get_registry(self: @ContractState) -> ContractAddress {
            self.registry.read()
        }
    }

    // ── OAppHooks: incoming message handler ──
    impl OAppHooks of OAppCoreComponent::OAppHooks<ContractState> {
        fn _lz_receive(
            ref self: OAppCoreComponent::ComponentState<ContractState>,
            origin: Origin,
            guid: Bytes32,
            message: ByteArray,
            executor: ContractAddress,
            extra_data: ByteArray,
            value: u256,
        ) {
            let mut contract = self.get_contract_mut();

            let (offset, msg_type) = message.read_u8(0);

            if msg_type == MSG_LOCK_COVERAGE {
                // [msg_type: 1B][protocol_id: 32B][amount: 32B][token_id: 32B]
                let (offset, protocol_id) = message.read_u256(offset);
                let (offset, amount) = message.read_u256(offset);
                let (_, token_id) = message.read_u256(offset);

                let vault = IVaultCoverageDispatcher {
                    contract_address: contract.vault.read(),
                };
                vault.lock_for_coverage(amount);

                contract
                    .emit(
                        CoverageLockReceived {
                            src_eid: origin.src_eid, protocol_id, amount, token_id,
                        },
                    );
            } else if msg_type == MSG_UNLOCK_COVERAGE {
                // [msg_type: 1B][protocol_id: 32B][amount: 32B][token_id: 32B]
                let (offset, protocol_id) = message.read_u256(offset);
                let (offset, amount) = message.read_u256(offset);
                let (_, token_id) = message.read_u256(offset);

                let vault = IVaultCoverageDispatcher {
                    contract_address: contract.vault.read(),
                };
                vault.unlock_from_coverage(amount);

                contract
                    .emit(
                        CoverageUnlockReceived {
                            src_eid: origin.src_eid, protocol_id, amount, token_id,
                        },
                    );
            } else if msg_type == MSG_PAYOUT_CLAIM {
                // [msg_type: 1B][protocol_id: 32B][user_starknet_addr: 32B][amount: 32B]
                let (offset, protocol_id) = message.read_u256(offset);
                let (offset, user_addr_raw) = message.read_u256(offset);
                let (_, amount) = message.read_u256(offset);

                let user_felt: felt252 = user_addr_raw.try_into().expect('Invalid user address');
                let user: ContractAddress = user_felt.try_into().expect('Invalid user address');

                let vault = IVaultCoverageDispatcher {
                    contract_address: contract.vault.read(),
                };
                vault.withdraw_for_payout(user, amount);

                contract
                    .emit(
                        PayoutReceived {
                            src_eid: origin.src_eid, protocol_id, user, amount,
                        },
                    );
            } else {
                panic!("InsuranceReceiver: unknown message type");
            }
        }
    }
}
