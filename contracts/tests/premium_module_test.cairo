use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starknet::ContractAddress;
use core::traits::TryInto;
use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use contracts::premium_module::{IPremiumModuleDispatcher, IPremiumModuleDispatcherTrait};
use contracts::coverage_token::{ICoverageTokenDispatcher, ICoverageTokenDispatcherTrait};
use contracts::protocol_registry::{
    IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
};
use contracts::vault::{ILstVaultDispatcher, ILstVaultDispatcherTrait};

// ERC4626 deposit dispatcher
#[starknet::interface]
trait ITestERC4626<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn total_assets(self: @TContractState) -> u256;
}

// --- Addresses ---
fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}
fn LP1() -> ContractAddress {
    0x2.try_into().unwrap()
}
fn LP2() -> ContractAddress {
    0x3.try_into().unwrap()
}
fn BUYER() -> ContractAddress {
    0x4.try_into().unwrap()
}
fn PROTOCOL_ADDR() -> ContractAddress {
    0x100.try_into().unwrap()
}

// --- Constants ---
// Needs to cover LP deposits (200e18) + buyer premiums (7500e18 per 100e18 coverage)
const INITIAL_SUPPLY: u256 = 100_000_000_000_000_000_000_000; // 100,000e18
const COVERAGE_CAP: u256 = 1_000_000_000_000_000_000_000; // 1000e18
const PREMIUM_RATE: u256 = 500; // 5% for 90-day base
const COVERAGE_AMOUNT: u256 = 100_000_000_000_000_000_000; // 100e18
const DURATION_90_DAYS: u64 = 7776000;
const LP_DEPOSIT: u256 = 200_000_000_000_000_000_000; // 200e18
const BASE_TIME: u64 = 1000000;

// ───────────────────────────────────────────────
// Deploy helpers
// ───────────────────────────────────────────────

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    let name: ByteArray = "Mock BTC-LST";
    let symbol: ByteArray = "mBTC";
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
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

fn deploy_premium_module(
    protocol_id: u256,
    vault: ContractAddress,
    registry: ContractAddress,
    coverage_token: ContractAddress,
    asset: ContractAddress,
) -> ContractAddress {
    let contract = declare("PremiumModule").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    protocol_id.serialize(ref calldata);
    vault.serialize(ref calldata);
    registry.serialize(ref calldata);
    coverage_token.serialize(ref calldata);
    asset.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

/// Full premium module setup.
/// Returns (asset, vault, registry, coverage_token, premium_module).
fn setup_premium() -> (
    ContractAddress, ContractAddress, ContractAddress, ContractAddress, ContractAddress,
) {
    start_cheat_block_timestamp_global(BASE_TIME);

    let asset_addr = deploy_mock_erc20();
    let vault_addr = deploy_vault(asset_addr);
    let registry_addr = deploy_registry();
    let cov_addr = deploy_coverage_token();

    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };

    // Register protocol (id=1)
    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(OWNER());
    registry.register_protocol(PROTOCOL_ADDR(), vault_addr, COVERAGE_CAP, PREMIUM_RATE);
    stop_cheat_caller_address(registry_addr);

    // Deploy premium module
    let pm_addr = deploy_premium_module(1, vault_addr, registry_addr, cov_addr, asset_addr);

    // Grant MINTER_ROLE on CoverageToken to premium module
    let cov = ICoverageTokenDispatcher { contract_address: cov_addr };
    start_cheat_caller_address(cov_addr, OWNER());
    cov.set_minter(pm_addr);
    stop_cheat_caller_address(cov_addr);

    // Grant COVERAGE_MANAGER_ROLE on vault to premium module
    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(pm_addr);
    stop_cheat_caller_address(vault_addr);

    (asset_addr, vault_addr, registry_addr, cov_addr, pm_addr)
}

/// Transfers `amount` tokens from OWNER to `who` and approves `spender`.
fn fund_and_approve(
    asset_addr: ContractAddress, who: ContractAddress, spender: ContractAddress, amount: u256,
) {
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };
    start_cheat_caller_address(asset_addr, OWNER());
    asset.transfer(who, amount);
    stop_cheat_caller_address(asset_addr);

    start_cheat_caller_address(asset_addr, who);
    asset.approve(spender, amount);
    stop_cheat_caller_address(asset_addr);
}

/// Deposits into vault (no lock step needed).
fn deposit_lp(
    asset_addr: ContractAddress, vault_addr: ContractAddress, lp: ContractAddress, amount: u256,
) {
    fund_and_approve(asset_addr, lp, vault_addr, amount);

    let vault = ITestERC4626Dispatcher { contract_address: vault_addr };
    start_cheat_caller_address(vault_addr, lp);
    vault.deposit(amount, lp);
    stop_cheat_caller_address(vault_addr);
}

// ═══════════════════════════════════════════════
// DEPLOY & VIEW TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_premium_deploy() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    assert(pm.protocol_id() == 1, 'Wrong protocol id');
    assert(pm.current_epoch() == 1, 'Should start at epoch 1');
    assert(pm.total_active_coverage() == 0, 'No active coverage');
    assert(pm.pending_premiums() == 0, 'No pending premiums');
}

#[test]
fn test_preview_cost() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // 100e18 * 1500e18 * 500 / (1e18 * 10000) = 100 * 75 = 7500 USDC
    let cost = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    let expected: u256 = 7_500_000_000_000_000_000_000; // 7500e18
    assert(cost == expected, 'Preview cost wrong');

    // Half duration = half cost
    let half = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS / 2);
    assert(half == expected / 2, 'Half duration wrong');
}

#[test]
fn test_claimable_returns_zero_before_finalize() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // Epoch 1 not finalized
    assert(pm.claimable(1, LP1()) == 0, 'Not finalized = 0');
    assert(pm.claimable(0, LP1()) == 0, 'No epoch 0 = 0');
}

// ═══════════════════════════════════════════════
// BUY COVERAGE TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_buy_coverage() {
    let (asset_addr, vault_addr, _reg, cov_addr, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };
    let cov = ICoverageTokenDispatcher { contract_address: cov_addr };

    // LP deposits to provide vault liquidity
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    let token_id = pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(token_id == 1, 'First token should be 1');
    assert(pm.is_subscribed(BUYER()), 'Should be subscribed');
    assert(pm.total_active_coverage() == COVERAGE_AMOUNT, 'Active coverage wrong');
    assert(pm.pending_premiums() == premium, 'Pending premiums wrong');

    // Premium transferred to PM
    assert(asset.balance_of(pm_addr) == premium, 'PM should hold premium');
    // NFT minted to buyer
    assert(cov.is_active(token_id), 'NFT should be active');

    // Vault should have locked the coverage amount
    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    assert(vault.total_locked_liquidity() == COVERAGE_AMOUNT, 'Vault should lock coverage');
}

#[test]
#[should_panic(expected: 'Coverage must be > 0')]
fn test_buy_coverage_zero_amount_fails() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(0, DURATION_90_DAYS);
}

#[test]
#[should_panic(expected: 'Duration must be > 0')]
fn test_buy_coverage_zero_duration_fails() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, 0);
}

#[test]
#[should_panic(expected: 'Exceeds coverage cap')]
fn test_buy_coverage_exceeds_cap() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // Deposit liquidity
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    let huge = COVERAGE_CAP + 1;
    let premium = pm.preview_cost(huge, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(huge, DURATION_90_DAYS);
}

#[test]
#[should_panic(expected: 'Exceeds vault liquidity')]
fn test_buy_coverage_exceeds_vault_liquidity() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // Only deposit 50e18 but try to buy 100e18 coverage
    let small_deposit: u256 = 50_000_000_000_000_000_000;
    deposit_lp(asset_addr, vault_addr, LP1(), small_deposit);

    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS); // 100e18 > 50e18 available
}

// ═══════════════════════════════════════════════
// CHECKPOINT TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_checkpoint() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // LP1 deposits (gets vault shares — auto-enrolled)
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    // Checkpoint records vault share balance
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);
    // No panic = success
}

#[test]
#[should_panic(expected: 'No vault shares')]
fn test_checkpoint_no_shares_fails() {
    let (_asset_addr, _vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // LP1 has NOT deposited — has no vault shares
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
}

#[test]
#[should_panic(expected: 'Already checkpointed')]
fn test_checkpoint_duplicate_fails() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    pm.checkpoint(); // duplicate — should panic
}

// ═══════════════════════════════════════════════
// EPOCH & CLAIM TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_advance_epoch() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // LP deposits so vault has liquidity
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    // Buy some coverage to generate premiums
    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(pm.pending_premiums() == premium, 'Pending before advance');

    // Advance
    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    assert(pm.current_epoch() == 2, 'Should be epoch 2');
    assert(pm.epoch_premiums(1) == premium, 'Epoch 1 premiums wrong');
    assert(pm.pending_premiums() == 0, 'Pending should reset');
}

#[test]
#[should_panic]
fn test_advance_epoch_non_governance_fails() {
    let (_asset, _vault, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    start_cheat_caller_address(pm_addr, LP1());
    pm.advance_epoch();
}

#[test]
fn test_full_epoch_lifecycle() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    // 1. LP deposits (auto-enrolled via vault shares)
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    // 2. LP checkpoints (records vault share balance)
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    // 3. Buyer purchases coverage
    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    // 4. Governance advances epoch
    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    // 5. Verify claimable
    let claimable = pm.claimable(1, LP1());
    assert(claimable > 0, 'Should have claimable');

    // 6. LP claims
    let lp_bal_before = asset.balance_of(LP1());
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);

    let received = asset.balance_of(LP1()) - lp_bal_before;
    assert(received == claimable, 'Claim amount wrong');

    // 7. claimable is now 0 (already claimed)
    assert(pm.claimable(1, LP1()) == 0, 'Already claimed = 0');
}

#[test]
#[should_panic(expected: 'Epoch not finalized')]
fn test_claim_not_finalized_fails() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    // Epoch 1 is current (not finalized) — should panic
    pm.claim_premiums(1);
}

#[test]
#[should_panic(expected: 'Already claimed')]
fn test_double_claim_fails() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    // Buy coverage to generate premiums
    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    // Advance epoch
    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    // First claim OK, second panics
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    pm.claim_premiums(1);
}

#[test]
fn test_two_lps_proportional_claims() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let asset = ERC20ABIDispatcher { contract_address: asset_addr };

    // LP1 deposits 200e18
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    // LP2 deposits 100e18
    let lp2_deposit: u256 = 100_000_000_000_000_000_000;
    deposit_lp(asset_addr, vault_addr, LP2(), lp2_deposit);

    // Both checkpoint
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(pm_addr, LP2());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    // Buyer purchases coverage
    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER());
    pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    // Advance epoch
    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    // Verify proportional claims (based on vault shares = deposits)
    let c1 = pm.claimable(1, LP1());
    let c2 = pm.claimable(1, LP2());
    assert(c1 > 0, 'LP1 should have claimable');
    assert(c2 > 0, 'LP2 should have claimable');
    assert(c1 > c2, 'LP1 deposited more, gets more');

    // LP1 claims
    let bal1_before = asset.balance_of(LP1());
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    assert(asset.balance_of(LP1()) - bal1_before == c1, 'LP1 claim wrong');

    // LP2 claims
    let bal2_before = asset.balance_of(LP2());
    start_cheat_caller_address(pm_addr, LP2());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    assert(asset.balance_of(LP2()) - bal2_before == c2, 'LP2 claim wrong');
}

// ═══════════════════════════════════════════════
// EXPIRE COVERAGE TESTS
// ═══════════════════════════════════════════════

#[test]
fn test_expire_coverage() {
    let (asset_addr, vault_addr, _reg, cov_addr, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let cov = ICoverageTokenDispatcher { contract_address: cov_addr };
    let vault = ILstVaultDispatcher { contract_address: vault_addr };

    // LP deposits to provide vault liquidity
    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    let token_id = pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(pm.total_active_coverage() == COVERAGE_AMOUNT, 'Active coverage set');
    assert(vault.total_locked_liquidity() == COVERAGE_AMOUNT, 'Vault locked');

    // Advance time past coverage end
    start_cheat_block_timestamp_global(BASE_TIME + DURATION_90_DAYS + 1);
    assert(!cov.is_active(token_id), 'Should be expired');

    // Anyone can call expire
    pm.expire_coverage(token_id);
    assert(pm.total_active_coverage() == 0, 'Coverage should be freed');
    assert(vault.total_locked_liquidity() == 0, 'Vault should be unlocked');
}

#[test]
#[should_panic(expected: 'Coverage still active')]
fn test_expire_active_coverage_fails() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    let token_id = pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    // Coverage is still active at BASE_TIME — should panic
    pm.expire_coverage(token_id);
}

#[test]
#[should_panic(expected: 'Not tracked or already expired')]
fn test_expire_already_expired_fails() {
    let (asset_addr, vault_addr, _reg, _cov, pm_addr) = setup_premium();
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    deposit_lp(asset_addr, vault_addr, LP1(), LP_DEPOSIT);

    let premium = pm.preview_cost(COVERAGE_AMOUNT, DURATION_90_DAYS);
    fund_and_approve(asset_addr, BUYER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER());
    let token_id = pm.buy_coverage(COVERAGE_AMOUNT, DURATION_90_DAYS);
    stop_cheat_caller_address(pm_addr);

    // Advance past expiry
    start_cheat_block_timestamp_global(BASE_TIME + DURATION_90_DAYS + 1);

    // First expire succeeds
    pm.expire_coverage(token_id);
    // Second expire fails — already zeroed out
    pm.expire_coverage(token_id);
}
