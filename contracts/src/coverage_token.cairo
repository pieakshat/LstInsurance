// ═══════════════════════════════════════════════════════════════════════════════
//
// COVERAGE TOKEN (Insurance Policy NFT)
//
// ERC-721 NFT representing individual insurance coverage positions.
// Each token stores policy metadata: protocol, coverage amount, duration,
// and premium paid. Minted by the Premium Purchase Module on coverage buy,
// burned by the Claims Manager on claim or expiry.
//
// ═══════════════════════════════════════════════════════════════════════════════

#[derive(Drop, Copy, Serde)]
pub struct CoveragePosition {
    pub protocol_id: u256,
    pub coverage_amount: u256,
    pub start_time: u64,
    pub end_time: u64,
    pub premium_paid: u256,
}

#[starknet::interface]
pub trait ICoverageToken<TContractState> {
    fn mint_coverage(
        ref self: TContractState,
        to: starknet::ContractAddress,
        protocol_id: u256,
        coverage_amount: u256,
        duration: u64,
        premium_paid: u256,
    ) -> u256;
    fn burn_coverage(ref self: TContractState, token_id: u256);

    fn get_coverage(self: @TContractState, token_id: u256) -> CoveragePosition;
    fn is_active(self: @TContractState, token_id: u256) -> bool;
    fn coverage_amount(self: @TContractState, token_id: u256) -> u256;
    fn coverage_protocol(self: @TContractState, token_id: u256) -> u256;

    fn get_tokens_of(self: @TContractState, owner: starknet::ContractAddress) -> Array<u256>;

    fn set_minter(ref self: TContractState, account: starknet::ContractAddress);
    fn set_burner(ref self: TContractState, account: starknet::ContractAddress);
}

#[starknet::contract]
pub mod CoverageToken {
    use core::num::traits::Zero;
    use openzeppelin::access::accesscontrol::AccessControlComponent;
    use openzeppelin::interfaces::upgrades::IUpgradeable;
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use openzeppelin::upgrades::upgradeable::UpgradeableComponent;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp};
    use super::CoveragePosition;

    pub const OWNER_ROLE: felt252 = selector!("OWNER_ROLE");
    pub const MINTER_ROLE: felt252 = selector!("MINTER_ROLE");
    pub const BURNER_ROLE: felt252 = selector!("BURNER_ROLE");

    #[starknet::storage_node]
    struct CoverageNode {
        protocol_id: u256,
        coverage_amount: u256,
        start_time: u64,
        end_time: u64,
        premium_paid: u256,
    }

    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;
    impl ERC721TokenOwnerImpl of ERC721Component::ERC721TokenOwnerTrait<ContractState> {}

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        coverage: Map<u256, CoverageNode>,
        next_token_id: u256,
        // Per-owner token index (ERC721Enumerable pattern)
        owner_token_count: Map<ContractAddress, u64>,
        owner_token_at: Map<ContractAddress, Map<u64, u256>>,  // (owner, idx) -> token_id
        token_owner_index: Map<u256, u64>,                     // token_id -> idx in owner list
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        CoverageMinted: CoverageMinted,
        CoverageBurned: CoverageBurned,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageMinted {
        #[key]
        pub token_id: u256,
        #[key]
        pub user: ContractAddress,
        pub protocol_id: u256,
        pub coverage_amount: u256,
        pub start_time: u64,
        pub end_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CoverageBurned {
        #[key]
        pub token_id: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, name: ByteArray, symbol: ByteArray, owner: ContractAddress,
    ) {
        self.erc721.initializer(name, symbol, "");
        self.access_control.initializer();

        self.access_control.set_role_admin(OWNER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(MINTER_ROLE, OWNER_ROLE);
        self.access_control.set_role_admin(BURNER_ROLE, OWNER_ROLE);

        self.access_control._grant_role(OWNER_ROLE, owner);
        self.access_control._grant_role(MINTER_ROLE, owner);

        // Token IDs start at 1 (0 = non-existent)
        self.next_token_id.write(1);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: starknet::ClassHash) {
            self.access_control.assert_only_role(OWNER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl ERC721MetadataImpl of openzeppelin::interfaces::erc721::IERC721Metadata<
        ContractState,
    > {
        fn name(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc721.ERC721_symbol.read()
        }

        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            ""
        }
    }

    #[abi(embed_v0)]
    pub impl CoverageTokenImpl of super::ICoverageToken<ContractState> {
        fn mint_coverage(
            ref self: ContractState,
            to: ContractAddress,
            protocol_id: u256,
            coverage_amount: u256,
            duration: u64,
            premium_paid: u256,
        ) -> u256 {
            self.access_control.assert_only_role(MINTER_ROLE);
            assert(to.is_non_zero(), 'Invalid recipient');
            assert(coverage_amount.is_non_zero(), 'Coverage amount must be > 0');
            assert(duration > 0, 'Duration must be > 0');

            let token_id = self.next_token_id.read();
            self.next_token_id.write(token_id + 1);

            let start_time = get_block_timestamp();
            let end_time = start_time + duration;

            self.erc721.mint(to, token_id);

            // Update owner index
            let idx = self.owner_token_count.entry(to).read();
            self.owner_token_at.entry(to).entry(idx).write(token_id);
            self.token_owner_index.entry(token_id).write(idx);
            self.owner_token_count.entry(to).write(idx + 1);

            let node = self.coverage.entry(token_id);
            node.protocol_id.write(protocol_id);
            node.coverage_amount.write(coverage_amount);
            node.start_time.write(start_time);
            node.end_time.write(end_time);
            node.premium_paid.write(premium_paid);

            self
                .emit(
                    CoverageMinted {
                        token_id, user: to, protocol_id, coverage_amount, start_time, end_time,
                    },
                );

            token_id
        }

        fn burn_coverage(ref self: ContractState, token_id: u256) {
            self.access_control.assert_only_role(BURNER_ROLE);
            assert(self.erc721.exists(token_id), 'Token does not exist');

            // Swap-and-pop: move last token into the burned slot, shrink count
            let owner = self.erc721.ERC721_owners.entry(token_id).read();
            let burn_idx = self.token_owner_index.entry(token_id).read();
            let last_idx = self.owner_token_count.entry(owner).read() - 1;
            if burn_idx != last_idx {
                let last_token = self.owner_token_at.entry(owner).entry(last_idx).read();
                self.owner_token_at.entry(owner).entry(burn_idx).write(last_token);
                self.token_owner_index.entry(last_token).write(burn_idx);
            }
            self.owner_token_at.entry(owner).entry(last_idx).write(0);
            self.token_owner_index.entry(token_id).write(0);
            self.owner_token_count.entry(owner).write(last_idx);

            self.erc721.burn(token_id);

            let node = self.coverage.entry(token_id);
            node.protocol_id.write(0);
            node.coverage_amount.write(0);
            node.start_time.write(0);
            node.end_time.write(0);
            node.premium_paid.write(0);

            self.emit(CoverageBurned { token_id });
        }

        fn get_coverage(self: @ContractState, token_id: u256) -> CoveragePosition {
            assert(self.erc721.exists(token_id), 'Token does not exist');
            let node = self.coverage.entry(token_id);
            CoveragePosition {
                protocol_id: node.protocol_id.read(),
                coverage_amount: node.coverage_amount.read(),
                start_time: node.start_time.read(),
                end_time: node.end_time.read(),
                premium_paid: node.premium_paid.read(),
            }
        }

        fn is_active(self: @ContractState, token_id: u256) -> bool {
            if !self.erc721.exists(token_id) {
                return false;
            }
            let node = self.coverage.entry(token_id);
            let now = get_block_timestamp();
            now >= node.start_time.read() && now <= node.end_time.read()
        }

        fn coverage_amount(self: @ContractState, token_id: u256) -> u256 {
            assert(self.erc721.exists(token_id), 'Token does not exist');
            self.coverage.entry(token_id).coverage_amount.read()
        }

        fn coverage_protocol(self: @ContractState, token_id: u256) -> u256 {
            assert(self.erc721.exists(token_id), 'Token does not exist');
            self.coverage.entry(token_id).protocol_id.read()
        }

        fn get_tokens_of(self: @ContractState, owner: ContractAddress) -> Array<u256> {
            let count = self.owner_token_count.entry(owner).read();
            let mut result: Array<u256> = ArrayTrait::new();
            let mut i: u64 = 0;
            loop {
                if i >= count { break; }
                result.append(self.owner_token_at.entry(owner).entry(i).read());
                i += 1;
            };
            result
        }

        fn set_minter(ref self: ContractState, account: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(account.is_non_zero(), 'Invalid address');
            self.access_control._grant_role(MINTER_ROLE, account);
        }

        fn set_burner(ref self: ContractState, account: ContractAddress) {
            self.access_control.assert_only_role(OWNER_ROLE);
            assert(account.is_non_zero(), 'Invalid address');
            self.access_control._grant_role(BURNER_ROLE, account);
        }
    }
}
