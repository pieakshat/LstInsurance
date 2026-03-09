// ═══════════════════════════════════════════════════════════════════════════════
//
// FULL SYSTEM FLOW TEST
//
// Tests the entire protocol lifecycle end-to-end using the factory to deploy
// all contracts, exactly as it happens in production.
//
// Scenarios covered:
//   1. Happy path: LP deposits, buyer gets coverage, epoch advances, LPs claim premiums, coverage expires
//   2. Claim approval: buyer submits claim, governor approves, vault pays out, NFT burned
//   3. Claim rejection -> resubmit -> approval on second attempt
//   4. Two buyers: one claims payout, one expires normally — correct accounting
//   5. Multi-epoch: proportional premiums across two epochs, LP misses epoch 2
//   6. Protocol pause blocks new coverage purchases
//   7. LP partial withdrawal with active coverage locks
//   8. Factory query functions (get_vault, get_pm, get_cm, reverse lookup, etc.)
//
// ═══════════════════════════════════════════════════════════════════════════════

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starknet::ContractAddress;
use core::traits::TryInto;
use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use contracts::vault::{ILstVaultDispatcher, ILstVaultDispatcherTrait};
use contracts::vault_factory::{
    IInsuranceVaultFactoryDispatcher, IInsuranceVaultFactoryDispatcherTrait,
};
use contracts::premium_module::{IPremiumModuleDispatcher, IPremiumModuleDispatcherTrait};
use contracts::claims_manager::{IClaimsManagerDispatcher, IClaimsManagerDispatcherTrait};
use contracts::coverage_token::{ICoverageTokenDispatcher, ICoverageTokenDispatcherTrait};
use contracts::protocol_registry::{
    IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
};

#[starknet::interface]
trait ITestERC4626<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn total_assets(self: @TContractState) -> u256;
}

// ── Actors ──
fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}
fn GOVERNOR() -> ContractAddress {
    0x2.try_into().unwrap()
}
fn LP1() -> ContractAddress {
    0x10.try_into().unwrap()
}
fn LP2() -> ContractAddress {
    0x11.try_into().unwrap()
}
fn BUYER1() -> ContractAddress {
    0x20.try_into().unwrap()
}
fn BUYER2() -> ContractAddress {
    0x21.try_into().unwrap()
}
fn PROTOCOL_ADDR() -> ContractAddress {
    0xABC.try_into().unwrap()
}

// ── Constants ──
const TOKEN_SUPPLY: u256 = 10_000_000_000_000_000_000_000_000; // 10M e18
const NINETY_DAYS: u64 = 7_776_000;
const THIRTY_DAYS: u64 = 2_592_000;
const BASE_TIME: u64 = 1_700_000_000;

// ═══════════════════════════════════════════════
// Deploy helpers
// ═══════════════════════════════════════════════

fn deploy_erc20(name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut cd: Array<felt252> = array![];
    name.serialize(ref cd);
    symbol.serialize(ref cd);
    TOKEN_SUPPLY.serialize(ref cd);
    OWNER().serialize(ref cd);
    let (addr, _) = contract.deploy(@cd).unwrap();
    addr
}

fn deploy_registry() -> ContractAddress {
    let contract = declare("ProtocolRegistry").unwrap().contract_class();
    let mut cd: Array<felt252> = array![];
    OWNER().serialize(ref cd);
    let (addr, _) = contract.deploy(@cd).unwrap();
    addr
}

fn deploy_coverage_token() -> ContractAddress {
    let contract = declare("CoverageToken").unwrap().contract_class();
    let mut cd: Array<felt252> = array![];
    let name: ByteArray = "Insurance Coverage";
    let symbol: ByteArray = "iCOV";
    name.serialize(ref cd);
    symbol.serialize(ref cd);
    OWNER().serialize(ref cd);
    let (addr, _) = contract.deploy(@cd).unwrap();
    addr
}

fn fund_and_approve(
    token: ContractAddress, recipient: ContractAddress, spender: ContractAddress, amount: u256,
) {
    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, OWNER());
    erc20.transfer(recipient, amount);
    stop_cheat_caller_address(token);
    start_cheat_caller_address(token, recipient);
    erc20.approve(spender, amount);
    stop_cheat_caller_address(token);
}

// ═══════════════════════════════════════════════
// Full system setup via factory
//
// Returns: (lst, usdc, registry, cov_token, factory, vault, pm, cm)
// ═══════════════════════════════════════════════

fn setup_system() -> (
    ContractAddress, // lst
    ContractAddress, // usdc
    ContractAddress, // registry
    ContractAddress, // coverage_token
    ContractAddress, // factory
    ContractAddress, // vault
    ContractAddress, // pm
    ContractAddress, // cm
) {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20("BTC-LST", "xyBTC");
    let usdc = deploy_erc20("MockUSDC", "mUSDC");
    let registry_addr = deploy_registry();
    let cov_addr = deploy_coverage_token();

    // Declare class hashes
    let vault_class = declare("LstVault").unwrap().contract_class();
    let pm_class = declare("PremiumModule").unwrap().contract_class();
    let cm_class = declare("ClaimsManager").unwrap().contract_class();
    let factory_class = declare("InsuranceVaultFactory").unwrap().contract_class();

    // Deploy factory
    let mut cd: Array<felt252> = array![];
    registry_addr.serialize(ref cd);
    (*vault_class.class_hash).serialize(ref cd);
    (*pm_class.class_hash).serialize(ref cd);
    (*cm_class.class_hash).serialize(ref cd);
    cov_addr.serialize(ref cd);
    usdc.serialize(ref cd); // premium asset = USDC
    OWNER().serialize(ref cd);
    let (factory_addr, _) = factory_class.deploy(@cd).unwrap();

    // Register protocol (owner and factory both need governance)
    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };
    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(OWNER());
    registry.register_protocol(
        PROTOCOL_ADDR(),
        0x0.try_into().unwrap(), // vault TBD
        5_000_000_000_000_000_000_000, // 5,000e18 coverage cap
        500, // 5% rate
    );
    // Grant factory governance so it can call registry.set_vault on create_vault
    registry.set_governance(factory_addr);
    stop_cheat_caller_address(registry_addr);

    // Deploy vault + PM + CM via factory
    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };
    start_cheat_caller_address(factory_addr, OWNER());
    let vault_addr = factory.create_vault(1, "BTC-LST Vault", "vBTCLST", lst);
    stop_cheat_caller_address(factory_addr);

    let pm_addr = factory.get_premium_module(1);
    let cm_addr = factory.get_claims_manager(1);

    // Wire permissions
    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let cov_token = ICoverageTokenDispatcher { contract_address: cov_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(pm_addr);
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_claims_manager(cm_addr);
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(cov_addr, OWNER());
    cov_token.set_minter(pm_addr);
    stop_cheat_caller_address(cov_addr);

    start_cheat_caller_address(cov_addr, OWNER());
    cov_token.set_burner(cm_addr);
    stop_cheat_caller_address(cov_addr);

    start_cheat_caller_address(pm_addr, OWNER());
    pm.set_claims_manager(cm_addr);
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(cm_addr, OWNER());
    cm.add_governor(GOVERNOR());
    stop_cheat_caller_address(cm_addr);

    (lst, usdc, registry_addr, cov_addr, factory_addr, vault_addr, pm_addr, cm_addr)
}

// ═══════════════════════════════════════════════
// TEST 1 — Happy path: full lifecycle
//
// LP1 + LP2 deposit -> checkpoint -> BUYER1 buys coverage ->
// epoch advances -> LPs claim premiums -> coverage expires -> vault unlocked
// ═══════════════════════════════════════════════

#[test]
fn test_full_happy_path() {
    let (lst, usdc, _, cov_addr, _, vault_addr, pm_addr, _) = setup_system();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let vault_shares = ERC20ABIDispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let usdc_tok = ERC20ABIDispatcher { contract_address: usdc };
    let cov_token = ICoverageTokenDispatcher { contract_address: cov_addr };

    // ── Phase 1: LP deposits ──
    let lp1_dep: u256 = 2_000_000_000_000_000_000_000; // 2,000 LST
    let lp2_dep: u256 = 1_000_000_000_000_000_000_000; // 1,000 LST

    fund_and_approve(lst, LP1(), vault_addr, lp1_dep);
    fund_and_approve(lst, LP2(), vault_addr, lp2_dep);

    start_cheat_caller_address(vault_addr, LP1());
    let lp1_shares = vault_4626.deposit(lp1_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, LP2());
    let lp2_shares = vault_4626.deposit(lp2_dep, LP2());
    stop_cheat_caller_address(vault_addr);

    assert(vault_4626.total_assets() == lp1_dep + lp2_dep, 'vault holds all LST');
    assert(vault.available_liquidity() == lp1_dep + lp2_dep, 'all liquidity available');

    // ── Phase 2: LPs checkpoint shares for epoch 1 ──
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(pm_addr, LP2());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    // ── Phase 3: BUYER1 buys 1,000 BTC-LST coverage for 90 days ──
    // premium = 1000 BTC-LST * $1500 * 5% = $75,000 USDC
    let coverage: u256 = 1_000_000_000_000_000_000_000;
    let premium = pm.preview_cost(coverage, NINETY_DAYS);
    let expected_premium: u256 = 75_000_000_000_000_000_000_000; // 75,000e18
    assert(premium == expected_premium, 'preview cost correct');

    fund_and_approve(usdc, BUYER1(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER1());
    let token_id = pm.buy_coverage(coverage, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(vault.total_locked_liquidity() == coverage, 'coverage locked in vault');
    assert(vault.available_liquidity() == lp1_dep + lp2_dep - coverage, 'avail = total - locked');
    assert(pm.total_active_coverage() == coverage, 'PM tracks active coverage');
    assert(pm.pending_premiums() == premium, 'premium is pending');
    assert(pm.is_subscribed(BUYER1()), 'buyer is subscribed');
    assert(cov_token.is_active(token_id), 'NFT is active');

    // ── Phase 4: Advance epoch ──
    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    assert(pm.current_epoch() == 2, 'advanced to epoch 2');
    assert(pm.epoch_premiums(1) == premium, 'epoch 1 premiums finalized');
    assert(pm.pending_premiums() == 0, 'pending premiums reset');

    // ── Phase 5: LPs claim proportional premiums ──
    // LP1 deposited 2000, LP2 deposited 1000 -> LP1 gets ~2/3, LP2 ~1/3
    let lp1_claimable = pm.claimable(1, LP1());
    let lp2_claimable = pm.claimable(1, LP2());

    assert(lp1_claimable > lp2_claimable, 'LP1 earns more (2:1 ratio)');
    assert(lp1_claimable + lp2_claimable <= premium, 'sum <= total collected');

    let lp1_before = usdc_tok.balance_of(LP1());
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    assert(usdc_tok.balance_of(LP1()) - lp1_before == lp1_claimable, 'LP1 got correct USDC');

    let lp2_before = usdc_tok.balance_of(LP2());
    start_cheat_caller_address(pm_addr, LP2());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    assert(usdc_tok.balance_of(LP2()) - lp2_before == lp2_claimable, 'LP2 got correct USDC');

    // LP vault shares untouched
    assert(vault_shares.balance_of(LP1()) == lp1_shares, 'LP1 shares intact');
    assert(vault_shares.balance_of(LP2()) == lp2_shares, 'LP2 shares intact');

    // Already claimed -> claimable = 0
    assert(pm.claimable(1, LP1()) == 0, 'LP1 fully claimed');
    assert(pm.claimable(1, LP2()) == 0, 'LP2 fully claimed');

    // ── Phase 6: Coverage expires -> unlock vault capital ──
    start_cheat_block_timestamp_global(BASE_TIME + NINETY_DAYS + 1);
    assert(!cov_token.is_active(token_id), 'NFT expired');

    pm.expire_coverage(token_id);

    assert(vault.total_locked_liquidity() == 0, 'lock freed after expiry');
    assert(vault.available_liquidity() == lp1_dep + lp2_dep, 'full liquidity restored');
    assert(pm.total_active_coverage() == 0, 'PM: no active coverage');
}

// ═══════════════════════════════════════════════
// TEST 2 — Claim approval: full payout flow
//
// BUYER1 buys coverage -> submits claim -> governor approves ->
// vault pays out LST -> NFT burned -> PM state cleaned up
// ═══════════════════════════════════════════════

#[test]
fn test_claim_approval_flow() {
    let (lst, usdc, _, cov_addr, _, vault_addr, pm_addr, cm_addr) = setup_system();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    let lst_tok = ERC20ABIDispatcher { contract_address: lst };
    let cov_token = ICoverageTokenDispatcher { contract_address: cov_addr };

    // LP provides 2000 LST liquidity
    let lp_dep: u256 = 2_000_000_000_000_000_000_000;
    fund_and_approve(lst, LP1(), vault_addr, lp_dep);
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    // BUYER1 buys 500 LST coverage
    let coverage: u256 = 500_000_000_000_000_000_000;
    let premium = pm.preview_cost(coverage, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER1());
    let token_id = pm.buy_coverage(coverage, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(vault.total_locked_liquidity() == coverage, 'vault locked');
    assert(pm.total_active_coverage() == coverage, 'PM: 500 LST active');

    // BUYER1 submits claim
    start_cheat_caller_address(cm_addr, BUYER1());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    assert(cm.get_claim_status(claim_id) == 0, 'status: pending');

    let buyer_before = lst_tok.balance_of(BUYER1());

    // Governor approves -> vault pays out coverage amount in LST
    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.approve_claim(claim_id);
    stop_cheat_caller_address(cm_addr);

    assert(cm.get_claim_status(claim_id) == 1, 'status: approved');
    assert(lst_tok.balance_of(BUYER1()) - buyer_before == coverage, 'buyer got full payout');
    assert(vault.total_locked_liquidity() == 0, 'vault lock cleared');
    assert(pm.total_active_coverage() == 0, 'PM coverage cleaned up');
    assert(!cov_token.is_active(token_id), 'NFT burned after claim');
}

// ═══════════════════════════════════════════════
// TEST 3 — Claim rejection -> resubmit -> approval
// ═══════════════════════════════════════════════

#[test]
fn test_claim_reject_then_approve() {
    let (lst, usdc, _, _, _, vault_addr, pm_addr, cm_addr) = setup_system();

    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    let lst_tok = ERC20ABIDispatcher { contract_address: lst };

    let lp_dep: u256 = 2_000_000_000_000_000_000_000;
    fund_and_approve(lst, LP1(), vault_addr, lp_dep);
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    let coverage: u256 = 300_000_000_000_000_000_000;
    let premium = pm.preview_cost(coverage, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, BUYER1());
    let token_id = pm.buy_coverage(coverage, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    // First submit + rejection
    start_cheat_caller_address(cm_addr, BUYER1());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.reject_claim(claim_id);
    stop_cheat_caller_address(cm_addr);

    assert(cm.get_claim_status(claim_id) == 2, 'status: rejected');

    // Resubmit after rejection
    start_cheat_caller_address(cm_addr, BUYER1());
    let claim_id2 = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    assert(claim_id2 != claim_id, 'new claim id issued');
    assert(cm.get_claim_status(claim_id2) == 0, 'new claim: pending');

    // Approve second attempt
    let buyer_before = lst_tok.balance_of(BUYER1());
    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.approve_claim(claim_id2);
    stop_cheat_caller_address(cm_addr);

    assert(cm.get_claim_status(claim_id2) == 1, 'second claim approved');
    assert(lst_tok.balance_of(BUYER1()) - buyer_before == coverage, 'payout received');
}

// ═══════════════════════════════════════════════
// TEST 4 — Two buyers: one claims, one expires
//
// BUYER1 gets approved claim (payout), BUYER2's coverage expires naturally.
// Verifies correct vault lock accounting when two coverages are live.
// ═══════════════════════════════════════════════

#[test]
fn test_two_buyers_claim_and_expire() {
    let (lst, usdc, _, cov_addr, _, vault_addr, pm_addr, cm_addr) = setup_system();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    let lst_tok = ERC20ABIDispatcher { contract_address: lst };
    let cov_token = ICoverageTokenDispatcher { contract_address: cov_addr };

    // LP provides 3,000 LST
    let lp_dep: u256 = 3_000_000_000_000_000_000_000;
    fund_and_approve(lst, LP1(), vault_addr, lp_dep);
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    // BUYER1: 1,000 LST coverage, 90 days
    let cov1: u256 = 1_000_000_000_000_000_000_000;
    let prem1 = pm.preview_cost(cov1, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, prem1);
    start_cheat_caller_address(pm_addr, BUYER1());
    let token1 = pm.buy_coverage(cov1, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    // BUYER2: 500 LST coverage, 30 days
    let cov2: u256 = 500_000_000_000_000_000_000;
    let prem2 = pm.preview_cost(cov2, THIRTY_DAYS);
    fund_and_approve(usdc, BUYER2(), pm_addr, prem2);
    start_cheat_caller_address(pm_addr, BUYER2());
    let token2 = pm.buy_coverage(cov2, THIRTY_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(vault.total_locked_liquidity() == cov1 + cov2, 'both coverages locked');
    assert(pm.total_active_coverage() == cov1 + cov2, 'PM: both active');

    // BUYER1 claims and gets approved
    start_cheat_caller_address(cm_addr, BUYER1());
    let claim1 = cm.submit_claim(token1);
    stop_cheat_caller_address(cm_addr);

    let buyer1_before = lst_tok.balance_of(BUYER1());
    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.approve_claim(claim1);
    stop_cheat_caller_address(cm_addr);

    assert(lst_tok.balance_of(BUYER1()) - buyer1_before == cov1, 'buyer1 got payout');
    assert(vault.total_locked_liquidity() == cov2, 'only cov2 still locked');
    assert(pm.total_active_coverage() == cov2, 'PM: only cov2 active');

    // BUYER2's coverage expires (30 days pass)
    start_cheat_block_timestamp_global(BASE_TIME + THIRTY_DAYS + 1);
    assert(!cov_token.is_active(token2), 'cov2 NFT expired');

    pm.expire_coverage(token2);

    assert(vault.total_locked_liquidity() == 0, 'all locks cleared');
    assert(pm.total_active_coverage() == 0, 'PM: no active coverage');
    // Vault lost cov1 to payout; cov2 was returned on expiry
    assert(vault.available_liquidity() == lp_dep - cov1, 'avail = deposit - payout');
}

// ═══════════════════════════════════════════════
// TEST 5 — Multi-epoch premium distribution
//
// Epoch 1: LP1+LP2 checkpoint, BUYER1 buys -> advance -> both LPs claim
// Epoch 2: only LP1 checkpoints, BUYER2 buys -> advance -> LP1 claims all
// ═══════════════════════════════════════════════

#[test]
fn test_multi_epoch_premium_distribution() {
    let (lst, usdc, _, _, _, vault_addr, pm_addr, _) = setup_system();

    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let usdc_tok = ERC20ABIDispatcher { contract_address: usdc };

    let lp1_dep: u256 = 1_500_000_000_000_000_000_000; // 1,500 LST
    let lp2_dep: u256 = 500_000_000_000_000_000_000; // 500 LST
    fund_and_approve(lst, LP1(), vault_addr, lp1_dep);
    fund_and_approve(lst, LP2(), vault_addr, lp2_dep);

    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp1_dep, LP1());
    stop_cheat_caller_address(vault_addr);
    start_cheat_caller_address(vault_addr, LP2());
    vault_4626.deposit(lp2_dep, LP2());
    stop_cheat_caller_address(vault_addr);

    // ── Epoch 1: both LPs checkpoint ──
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);
    start_cheat_caller_address(pm_addr, LP2());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    let cov1: u256 = 500_000_000_000_000_000_000;
    let prem1 = pm.preview_cost(cov1, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, prem1);
    start_cheat_caller_address(pm_addr, BUYER1());
    pm.buy_coverage(cov1, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    assert(pm.current_epoch() == 2, 'epoch 2');
    assert(pm.epoch_premiums(1) == prem1, 'epoch1 premiums correct');

    // LP1 (1500 LST) gets 75%, LP2 (500 LST) gets 25%
    let lp1_ep1 = pm.claimable(1, LP1());
    let lp2_ep1 = pm.claimable(1, LP2());
    assert(lp1_ep1 > lp2_ep1, 'LP1 gets 3x of LP2');
    assert(lp1_ep1 + lp2_ep1 <= prem1, 'no more than collected');

    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    start_cheat_caller_address(pm_addr, LP2());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);

    // ── Epoch 2: only LP1 checkpoints ──
    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);
    // LP2 does NOT checkpoint this epoch

    let cov2: u256 = 300_000_000_000_000_000_000;
    let prem2 = pm.preview_cost(cov2, THIRTY_DAYS);
    fund_and_approve(usdc, BUYER2(), pm_addr, prem2);
    start_cheat_caller_address(pm_addr, BUYER2());
    pm.buy_coverage(cov2, THIRTY_DAYS);
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    assert(pm.current_epoch() == 3, 'epoch 3');

    // LP2 missed checkpoint -> gets 0 from epoch 2
    assert(pm.claimable(2, LP2()) == 0, 'LP2 no checkpoint epoch2');

    // LP1 gets everything from epoch 2
    let lp1_ep2 = pm.claimable(2, LP1());
    assert(lp1_ep2 > 0, 'LP1 earned in epoch2');
    assert(lp1_ep2 <= prem2, 'LP1 ep2 <= total collected');

    let lp1_usdc_before = usdc_tok.balance_of(LP1());
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(2);
    stop_cheat_caller_address(pm_addr);
    assert(usdc_tok.balance_of(LP1()) - lp1_usdc_before == lp1_ep2, 'LP1 claimed epoch2');
}

// ═══════════════════════════════════════════════
// TEST 6 — Protocol pause blocks coverage purchases
// ═══════════════════════════════════════════════

#[test]
#[should_panic(expected: ('Protocol not active',))]
fn test_paused_protocol_blocks_buy() {
    let (lst, usdc, registry_addr, _, _, vault_addr, pm_addr, _) = setup_system();

    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };

    let lp_dep: u256 = 1_000_000_000_000_000_000_000;
    fund_and_approve(lst, LP1(), vault_addr, lp_dep);
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    // Governance pauses the protocol
    start_cheat_caller_address(registry_addr, OWNER());
    registry.pause_protocol(1);
    stop_cheat_caller_address(registry_addr);

    // Buy attempt should panic with 'Protocol not active'
    let coverage: u256 = 100_000_000_000_000_000_000;
    let premium = pm.preview_cost(coverage, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER1());
    pm.buy_coverage(coverage, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);
}

// ═══════════════════════════════════════════════
// TEST 7 — LP partial withdrawal with active coverage
//
// LP can withdraw unlocked liquidity even while coverage locks exist.
// ═══════════════════════════════════════════════

#[test]
fn test_lp_withdrawal_with_active_coverage() {
    let (lst, usdc, _, _, _, vault_addr, pm_addr, _) = setup_system();

    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let lst_tok = ERC20ABIDispatcher { contract_address: lst };

    // LP deposits 2,000 LST
    let lp_dep: u256 = 2_000_000_000_000_000_000_000;
    fund_and_approve(lst, LP1(), vault_addr, lp_dep);
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_dep, LP1());
    stop_cheat_caller_address(vault_addr);

    // BUYER1 locks 500 LST via coverage
    let coverage: u256 = 500_000_000_000_000_000_000;
    let premium = pm.preview_cost(coverage, NINETY_DAYS);
    fund_and_approve(usdc, BUYER1(), pm_addr, premium);
    start_cheat_caller_address(pm_addr, BUYER1());
    pm.buy_coverage(coverage, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    assert(vault.available_liquidity() == lp_dep - coverage, '1500 available');

    // LP1 withdraws 1,000 LST (within the unlocked 1,500)
    let withdraw_amt: u256 = 1_000_000_000_000_000_000_000;
    let lst_before = lst_tok.balance_of(LP1());

    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.withdraw(withdraw_amt, LP1(), LP1());
    stop_cheat_caller_address(vault_addr);

    assert(lst_tok.balance_of(LP1()) - lst_before == withdraw_amt, 'LP1 withdrew 1000 LST');
    assert(vault.available_liquidity() == lp_dep - coverage - withdraw_amt, '500 avail remaining');
}

// ═══════════════════════════════════════════════
// TEST 8 — Factory query functions
// ═══════════════════════════════════════════════

#[test]
fn test_factory_query_functions() {
    let (lst, usdc, _, _, factory_addr, vault_addr, pm_addr, cm_addr) = setup_system();

    let factory = IInsuranceVaultFactoryDispatcher { contract_address: factory_addr };

    assert(factory.get_vault(1) == vault_addr, 'get_vault correct');
    assert(factory.get_premium_module(1) == pm_addr, 'get_premium_module correct');
    assert(factory.get_claims_manager(1) == cm_addr, 'get_claims_manager correct');
    assert(factory.get_protocol(vault_addr) == 1, 'reverse lookup vault->1');
    assert(factory.get_premium_asset() == usdc, 'premium asset = USDC');
    assert(factory.vault_count() == 1, 'one vault deployed');

    let all = factory.all_vaults();
    assert(*all.at(0) == vault_addr, 'all_vaults[0] = vault');

    let _ = lst; // suppress unused warning
}
