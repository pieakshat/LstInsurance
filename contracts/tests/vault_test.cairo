use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use core::num::traits::Zero;
use core::traits::TryInto;
use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use contracts::vault::{ILstVaultDispatcher, ILstVaultDispatcherTrait};
use contracts::vault_factory::{
    IInsuranceVaultFactoryDispatcher, IInsuranceVaultFactoryDispatcherTrait,
};
use contracts::protocol_registry::{
    IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
};

// Minimal ERC4626 dispatcher for testing deposit/withdraw
#[starknet::interface]
trait ITestERC4626<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn total_assets(self: @TContractState) -> u256;
    fn asset(self: @TContractState) -> ContractAddress;
}

// --- Address constants ---
fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}

fn USER1() -> ContractAddress {
    0x2.try_into().unwrap()
}

fn USER2() -> ContractAddress {
    0x3.try_into().unwrap()
}

fn PROTOCOL_ADDR() -> ContractAddress {
    0x100.try_into().unwrap()
}

fn CLAIMS_MANAGER() -> ContractAddress {
    0x200.try_into().unwrap()
}

fn COVERAGE_MANAGER() -> ContractAddress {
    0x300.try_into().unwrap()
}

const INITIAL_SUPPLY: u256 = 1_000_000_000_000_000_000_000; // 1000e18
const DEPOSIT_AMOUNT: u256 = 100_000_000_000_000_000_000; // 100e18

// ───────────────────────────────────────────────
// Deploy helpers
// ───────────────────────────────────────────────

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    INITIAL_SUPPLY.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

fn deploy_vault(asset: ContractAddress) -> ContractAddress {
    let contract = declare("LstVault").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    let name: ByteArray = "Test Vault";
    let symbol: ByteArray = "tVLT";
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    asset.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

fn deploy_registry() -> ContractAddress {
    let contract = declare("ProtocolRegistry").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

fn deploy_coverage_token() -> ContractAddress {
    let contract = declare("CoverageToken").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    let name: ByteArray = "Coverage NFT";
    let symbol: ByteArray = "COV";
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

/// Deploys asset + vault, funds USER1, and approves vault.
fn setup_vault() -> (ContractAddress, ContractAddress) {
    let asset_addr = deploy_mock_erc20();
    let vault_addr = deploy_vault(asset_addr);
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    // Fund USER1
    start_cheat_caller_address(asset_addr, OWNER());
    asset.transfer(USER1(), DEPOSIT_AMOUNT * 3);
    stop_cheat_caller_address(asset_addr);

    // USER1 approves vault
    start_cheat_caller_address(asset_addr, USER1());
    asset.approve(vault_addr, DEPOSIT_AMOUNT * 3);
    stop_cheat_caller_address(asset_addr);

    (asset_addr, vault_addr)
}

/// Full factory setup: registry with a registered protocol, coverage token,
/// and factory with class hashes. Returns (asset, registry, coverage_token, factory).
fn setup_factory() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let asset_addr = deploy_mock_erc20();
    let registry_addr = deploy_registry();
    let coverage_token_addr = deploy_coverage_token();

    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };

    // Grant governance to OWNER and register a protocol
    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(OWNER());
    registry.register_protocol(
        PROTOCOL_ADDR(),
        Zero::zero(), // vault TBD
        1_000_000_000_000_000_000_000, // coverage cap = 1000e18
        500, // 5% premium rate (basis points)
    );
    stop_cheat_caller_address(registry_addr);

    // Declare contract classes for factory to deploy
    let vault_class = declare("LstVault").unwrap().contract_class();
    let premium_class = declare("PremiumModule").unwrap().contract_class();
    let factory_class = declare("InsuranceVaultFactory").unwrap().contract_class();

    let mut calldata: Array<felt252> = array![];
    registry_addr.serialize(ref calldata);
    (*vault_class.class_hash).serialize(ref calldata);
    (*premium_class.class_hash).serialize(ref calldata);
    coverage_token_addr.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (factory_addr, _) = factory_class.deploy(@calldata).unwrap();

    // Grant GOVERNANCE_ROLE to factory so it can call registry.set_vault()
    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(factory_addr);
    stop_cheat_caller_address(registry_addr);

    (asset_addr, registry_addr, coverage_token_addr, factory_addr)
}

// ═══════════════════════════════════════════════
// VAULT TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_vault_deploy() {
    let asset_addr = deploy_mock_erc20();
    let vault_addr = deploy_vault(asset_addr);

    let vault = ITestERC4626Dispatcher { contract_address: vault_addr };
    let vault_custom = ILstVaultDispatcher { contract_address: vault_addr };

    assert(vault.asset() == asset_addr, 'Wrong asset');
    assert(vault.total_assets() == 0, 'Should start with 0 assets');
    assert(vault_custom.total_locked_liquidity() == 0, 'No locked liquidity');
    assert(vault_custom.total_payouts() == 0, 'No payouts');
}

#[test]
fn test_vault_deposit_withdraw_cycle() {
    let (asset_addr, vault_addr) = setup_vault();

    let vault = ITestERC4626Dispatcher { contract_address: vault_addr };
    let vault_shares = ERC20ABIDispatcher { contract_address: vault_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    let user_balance_before = asset.balance_of(USER1());

    // Deposit
    start_cheat_caller_address(vault_addr, USER1());
    let shares = vault.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    assert(shares > 0, 'Must receive shares');
    assert(vault_shares.balance_of(USER1()) == shares, 'Share balance wrong');
    assert(vault.total_assets() == DEPOSIT_AMOUNT, 'Total assets wrong');

    // Withdraw all
    start_cheat_caller_address(vault_addr, USER1());
    vault.withdraw(DEPOSIT_AMOUNT, USER1(), USER1());
    stop_cheat_caller_address(vault_addr);

    assert(vault_shares.balance_of(USER1()) == 0, 'Shares not burned');
    assert(asset.balance_of(USER1()) == user_balance_before, 'Assets not returned');
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_vault_pause_blocks_deposit() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
}

#[test]
fn test_vault_unpause_allows_deposit() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, OWNER());
    vault.pause();
    vault.unpause();
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, USER1());
    let shares = vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    assert(shares > 0, 'Should receive shares');
}

#[test]
fn test_vault_deposit_limit_enforced() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    let limit = DEPOSIT_AMOUNT / 2;
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_deposit_limit(limit);
    stop_cheat_caller_address(vault_addr);

    assert(vault.get_deposit_limit() == limit, 'Limit not set');

    // Deposit within limit succeeds
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(limit, USER1());
    stop_cheat_caller_address(vault_addr);

    assert(vault_erc4626.total_assets() == limit, 'Assets should equal limit');
}

#[test]
#[should_panic]
fn test_vault_deposit_exceeds_limit() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    let limit: u256 = 10_000_000_000_000_000_000; // 10e18
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_deposit_limit(limit);
    stop_cheat_caller_address(vault_addr);

    // 100e18 > 10e18 limit — should panic
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
}

// ═══════════════════════════════════════════════
// COVERAGE LOCK TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_lock_for_coverage() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    // Deposit
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    // Set coverage manager
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Coverage manager locks capital
    let lock_amount = DEPOSIT_AMOUNT / 2;
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(lock_amount);
    stop_cheat_caller_address(vault_addr);

    assert(vault.total_locked_liquidity() == lock_amount, 'Locked liquidity wrong');
    assert(vault.available_liquidity() == DEPOSIT_AMOUNT - lock_amount, 'Available wrong');
}

#[test]
fn test_unlock_from_coverage() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Lock then unlock
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT / 2);
    vault.unlock_from_coverage(DEPOSIT_AMOUNT / 2);
    stop_cheat_caller_address(vault_addr);

    assert(vault.total_locked_liquidity() == 0, 'Should be unlocked');
    assert(vault.available_liquidity() == DEPOSIT_AMOUNT, 'All available');
}

#[test]
#[should_panic(expected: 'Exceeds total assets')]
fn test_lock_exceeds_assets_fails() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Try to lock more than total assets
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT + 1);
}

#[test]
#[should_panic]
fn test_lock_non_coverage_manager_fails() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    // Random caller tries to lock — should fail
    start_cheat_caller_address(vault_addr, USER1());
    vault.lock_for_coverage(DEPOSIT_AMOUNT / 2);
}

#[test]
#[should_panic(expected: 'ERC4626: exceeds max withdraw')]
fn test_withdraw_blocked_by_coverage_lock() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Lock all capital
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT);
    stop_cheat_caller_address(vault_addr);

    // Try to withdraw full amount — should fail
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.withdraw(DEPOSIT_AMOUNT, USER1(), USER1());
}

#[test]
fn test_withdraw_partial_with_coverage_lock() {
    let (asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Lock 60e18
    let lock_amount: u256 = 60_000_000_000_000_000_000;
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(lock_amount);
    stop_cheat_caller_address(vault_addr);

    // Withdraw 40e18 (100 - 60 = 40 available) — should succeed
    let withdraw_amount: u256 = 40_000_000_000_000_000_000;
    let bal_before = asset.balance_of(USER1());
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.withdraw(withdraw_amount, USER1(), USER1());
    stop_cheat_caller_address(vault_addr);

    assert(asset.balance_of(USER1()) == bal_before + withdraw_amount, 'Partial withdraw works');
}

#[test]
fn test_payout_reduces_locked() {
    let (asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    // Deposit
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    // Set claims manager and coverage manager
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_claims_manager(CLAIMS_MANAGER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Lock 100e18 via coverage
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT);
    stop_cheat_caller_address(vault_addr);

    assert(vault.total_locked_liquidity() == DEPOSIT_AMOUNT, 'Locked = 100');

    // Payout 30e18
    let payout: u256 = 30_000_000_000_000_000_000;
    start_cheat_caller_address(vault_addr, CLAIMS_MANAGER());
    vault.withdraw_for_payout(USER2(), payout);
    stop_cheat_caller_address(vault_addr);

    // Verify locked reduced
    assert(vault.total_locked_liquidity() == DEPOSIT_AMOUNT - payout, 'Locked = 70');
    assert(asset.balance_of(USER2()) == payout, 'Payout received');
    assert(vault.total_payouts() == payout, 'Payout tracking');
}

#[test]
fn test_vault_claims_manager_payout() {
    let (asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    // Deposit
    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    // Set claims manager and coverage manager
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_claims_manager(CLAIMS_MANAGER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    // Lock via coverage manager
    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT / 2);
    stop_cheat_caller_address(vault_addr);

    // Claims manager sends payout
    let payout = DEPOSIT_AMOUNT / 4;
    start_cheat_caller_address(vault_addr, CLAIMS_MANAGER());
    vault.withdraw_for_payout(USER2(), payout);
    stop_cheat_caller_address(vault_addr);

    assert(asset.balance_of(USER2()) == payout, 'Payout not received');
    assert(vault.total_payouts() == payout, 'Payout tracking wrong');
    assert(vault.total_locked_liquidity() == DEPOSIT_AMOUNT / 4, 'Locked should be reduced');
}

#[test]
#[should_panic]
fn test_vault_non_owner_cannot_pause() {
    let (_asset_addr, vault_addr) = setup_vault();
    let vault = ILstVaultDispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault.pause();
}

#[test]
#[should_panic]
fn test_vault_non_owner_cannot_set_limit() {
    let (_asset_addr, vault_addr) = setup_vault();
    let vault = ILstVaultDispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault.set_deposit_limit(100);
}

#[test]
fn test_vault_available_liquidity() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    assert(vault.available_liquidity() == DEPOSIT_AMOUNT, 'All liquidity available');

    // Lock half via coverage manager
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT / 2);
    stop_cheat_caller_address(vault_addr);

    assert(vault.available_liquidity() == DEPOSIT_AMOUNT / 2, 'Half available');
}

#[test]
fn test_vault_solvency_views() {
    let (_asset_addr, vault_addr) = setup_vault();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_erc4626 = ITestERC4626Dispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, USER1());
    vault_erc4626.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(COVERAGE_MANAGER());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, COVERAGE_MANAGER());
    vault.lock_for_coverage(DEPOSIT_AMOUNT / 2);
    stop_cheat_caller_address(vault_addr);

    assert(vault.solvency_assets() == DEPOSIT_AMOUNT, 'Solvency assets wrong');
    assert(vault.solvency_locked() == DEPOSIT_AMOUNT / 2, 'Solvency locked wrong');
    // coverage_capacity = total_assets * leverage (all deposits back coverage)
    assert(vault.coverage_capacity(2) == DEPOSIT_AMOUNT * 2, 'Coverage capacity wrong');
}

// ═══════════════════════════════════════════════
// VAULT FACTORY TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_factory_create_vault() {
    let (asset_addr, _registry_addr, _cov_addr, factory_addr) = setup_factory();
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };

    start_cheat_caller_address(factory_addr, OWNER());
    let vault_addr = factory.create_vault(1, "Proto Vault", "pVLT", asset_addr);
    stop_cheat_caller_address(factory_addr);

    assert(vault_addr.is_non_zero(), 'Vault not deployed');
    assert(factory.get_vault(1) == vault_addr, 'Vault mapping wrong');
    assert(factory.get_protocol(vault_addr) == 1, 'Protocol mapping wrong');
    assert(factory.vault_count() == 1, 'Vault count wrong');

    let pm_addr = factory.get_premium_module(1);
    assert(pm_addr.is_non_zero(), 'Premium module not deployed');
}

#[test]
fn test_factory_vault_list() {
    let (asset_addr, registry_addr, _cov_addr, factory_addr) = setup_factory();
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };
    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };

    // Register a second protocol
    start_cheat_caller_address(registry_addr, OWNER());
    registry.register_protocol(
        0x101.try_into().unwrap(),
        Zero::zero(),
        1_000_000_000_000_000_000_000,
        500,
    );
    stop_cheat_caller_address(registry_addr);

    // Create two vaults
    start_cheat_caller_address(factory_addr, OWNER());
    let v1 = factory.create_vault(1, "Vault 1", "V1", asset_addr);
    let v2 = factory.create_vault(2, "Vault 2", "V2", asset_addr);
    stop_cheat_caller_address(factory_addr);

    assert(factory.vault_count() == 2, 'Should have 2 vaults');
    let vaults = factory.all_vaults();
    assert(*vaults.at(0) == v1, 'First vault wrong');
    assert(*vaults.at(1) == v2, 'Second vault wrong');
}

#[test]
#[should_panic(expected: 'Vault already deployed')]
fn test_factory_duplicate_vault_fails() {
    let (asset_addr, _registry_addr, _cov_addr, factory_addr) = setup_factory();
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };

    start_cheat_caller_address(factory_addr, OWNER());
    factory.create_vault(1, "Vault A", "VA", asset_addr);
    factory.create_vault(1, "Vault B", "VB", asset_addr); // duplicate protocol_id
}

#[test]
#[should_panic]
fn test_factory_non_deployer_fails() {
    let (asset_addr, _registry_addr, _cov_addr, factory_addr) = setup_factory();
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };

    start_cheat_caller_address(factory_addr, USER1());
    factory.create_vault(1, "Vault", "VLT", asset_addr);
}

#[test]
fn test_factory_deployed_vault_is_functional() {
    let (asset_addr, _registry_addr, _cov_addr, factory_addr) = setup_factory();
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    start_cheat_caller_address(factory_addr, OWNER());
    let vault_addr = factory.create_vault(1, "Proto Vault", "pVLT", asset_addr);
    stop_cheat_caller_address(factory_addr);

    let vault = ITestERC4626Dispatcher { contract_address: vault_addr };

    // Verify the vault is wired to the correct asset
    assert(vault.asset() == asset_addr, 'Wrong asset on deployed vault');
    assert(vault.total_assets() == 0, 'Should start empty');

    // Fund USER1 and deposit into the factory-deployed vault
    start_cheat_caller_address(asset_addr, OWNER());
    asset.transfer(USER1(), DEPOSIT_AMOUNT);
    stop_cheat_caller_address(asset_addr);

    start_cheat_caller_address(asset_addr, USER1());
    asset.approve(vault_addr, DEPOSIT_AMOUNT);
    stop_cheat_caller_address(asset_addr);

    start_cheat_caller_address(vault_addr, USER1());
    let shares = vault.deposit(DEPOSIT_AMOUNT, USER1());
    stop_cheat_caller_address(vault_addr);

    assert(shares > 0, 'Deposit should mint shares');
    assert(vault.total_assets() == DEPOSIT_AMOUNT, 'Assets should match deposit');
}
