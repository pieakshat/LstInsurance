// ═══════════════════════════════════════════════════════════════════════════════
//
// PARTIAL INTEGRATION TEST — Full insurance flow
//
// LPs deposit LST → vault
// Coverage seekers pay USDC premium → get Coverage NFT
// Governance advances epoch
// LPs claim earned USDC premiums
//
// ═══════════════════════════════════════════════════════════════════════════════

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starknet::ContractAddress;
use core::traits::TryInto;
use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use contracts::premium_module::{IPremiumModuleDispatcher, IPremiumModuleDispatcherTrait};
use contracts::coverage_token::{
    ICoverageTokenDispatcher, ICoverageTokenDispatcherTrait, CoveragePosition,
};
use contracts::protocol_registry::{
    IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait,
};
use contracts::vault::{ILstVaultDispatcher, ILstVaultDispatcherTrait};

#[starknet::interface]
trait ITestERC4626<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn total_assets(self: @TContractState) -> u256;
    fn asset(self: @TContractState) -> ContractAddress;
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
fn COVERAGE_BUYER() -> ContractAddress {
    0x4.try_into().unwrap()
}
fn XYZ_PROTOCOL() -> ContractAddress {
    0xABC.try_into().unwrap()
}

// --- Constants ---
const TOKEN_SUPPLY: u256 = 10_000_000_000_000_000_000_000; // 10,000e18
const BASE_TIME: u64 = 1_700_000_000;
const NINETY_DAYS: u64 = 7_776_000;

// ───────────────────────────────────────────────
// Deploy helpers
// ───────────────────────────────────────────────

fn deploy_erc20(supply: u256) -> ContractAddress {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    supply.serialize(ref calldata);
    OWNER().serialize(ref calldata);
    let (addr, _) = contract.deploy(@calldata).unwrap();
    addr
}

fn deploy_vault(asset: ContractAddress) -> ContractAddress {
    let contract = declare("LstVault").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    let name: ByteArray = "BTC-LST Vault";
    let symbol: ByteArray = "vBTCLST";
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
    let name: ByteArray = "Insurance Coverage";
    let symbol: ByteArray = "iCOV";
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

fn fund_and_approve(
    token: ContractAddress, who: ContractAddress, spender: ContractAddress, amount: u256,
) {
    let erc20 = ERC20ABIDispatcher { contract_address: token };
    start_cheat_caller_address(token, OWNER());
    erc20.transfer(who, amount);
    stop_cheat_caller_address(token);

    start_cheat_caller_address(token, who);
    erc20.approve(spender, amount);
    stop_cheat_caller_address(token);
}

// ═══════════════════════════════════════════════
// INTEGRATION TEST
// ═══════════════════════════════════════════════

#[test]
fn test_full_insurance_flow() {
    start_cheat_block_timestamp_global(BASE_TIME);

    // ─────────────────────────────────────────────
    // Phase 1: Deploy the entire system
    // ─────────────────────────────────────────────

    // Two separate tokens:
    //   MockLST  → what LPs stake into the vault
    //   MockUSDC → what coverage buyers pay as premium
    let lst = deploy_erc20(TOKEN_SUPPLY);
    let usdc = deploy_erc20(TOKEN_SUPPLY);

    let vault_addr = deploy_vault(lst);
    let registry_addr = deploy_registry();
    let cov_addr = deploy_coverage_token();

    // Register "XYZ Protocol" with 5,000 LST coverage cap, 5% premium rate
    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };
    let coverage_cap: u256 = 5_000_000_000_000_000_000_000; // 5,000e18
    let premium_rate: u256 = 500; // 5% for 90-day base

    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(OWNER());
    registry.register_protocol(XYZ_PROTOCOL(), vault_addr, coverage_cap, premium_rate);
    stop_cheat_caller_address(registry_addr);

    // Deploy premium module — premiums are paid in USDC
    let pm_addr = deploy_premium_module(1, vault_addr, registry_addr, cov_addr, usdc);

    // Grant MINTER_ROLE to premium module so it can mint Coverage NFTs
    let cov_token = ICoverageTokenDispatcher { contract_address: cov_addr };
    start_cheat_caller_address(cov_addr, OWNER());
    cov_token.set_minter(pm_addr);
    stop_cheat_caller_address(cov_addr);

    // Dispatchers we'll use throughout
    let _lst_token = ERC20ABIDispatcher { contract_address: lst };
    let usdc_token = ERC20ABIDispatcher { contract_address: usdc };
    let vault = ITestERC4626Dispatcher { contract_address: vault_addr };
    let vault_shares = ERC20ABIDispatcher { contract_address: vault_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };

    // ─────────────────────────────────────────────
    // Phase 2: LPs deposit LST into the vault
    // ─────────────────────────────────────────────

    let lp1_deposit: u256 = 500_000_000_000_000_000_000; // 500 LST
    let lp2_deposit: u256 = 300_000_000_000_000_000_000; // 300 LST

    fund_and_approve(lst, LP1(), vault_addr, lp1_deposit);
    fund_and_approve(lst, LP2(), vault_addr, lp2_deposit);

    start_cheat_caller_address(vault_addr, LP1());
    let lp1_shares = vault.deposit(lp1_deposit, LP1());
    stop_cheat_caller_address(vault_addr);

    start_cheat_caller_address(vault_addr, LP2());
    let lp2_shares = vault.deposit(lp2_deposit, LP2());
    stop_cheat_caller_address(vault_addr);

    assert(lp1_shares > 0, 'LP1 got shares');
    assert(lp2_shares > 0, 'LP2 got shares');
    assert(vault.total_assets() == lp1_deposit + lp2_deposit, 'Vault holds 800 LST');
    assert(vault_shares.balance_of(LP1()) == lp1_shares, 'LP1 share bal');
    assert(vault_shares.balance_of(LP2()) == lp2_shares, 'LP2 share bal');

    // ─────────────────────────────────────────────
    // Phase 2b: Grant coverage manager role to PM
    //           so buy_coverage can lock vault capital
    // ─────────────────────────────────────────────

    let vault_lock = ILstVaultDispatcher { contract_address: vault_addr };

    start_cheat_caller_address(vault_addr, OWNER());
    vault_lock.set_coverage_manager(pm_addr);
    stop_cheat_caller_address(vault_addr);

    // ─────────────────────────────────────────────
    // Phase 3: LPs checkpoint their vault shares
    //          (records share balance for premium distribution)
    // ─────────────────────────────────────────────

    start_cheat_caller_address(pm_addr, LP1());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    start_cheat_caller_address(pm_addr, LP2());
    pm.checkpoint();
    stop_cheat_caller_address(pm_addr);

    // ─────────────────────────────────────────────
    // Phase 4: Coverage seeker buys insurance
    //          for depositing into XYZ Protocol
    // ─────────────────────────────────────────────

    let coverage_amount: u256 = 800_000_000_000_000_000_000; // 800 LST worth of coverage
    let duration: u64 = NINETY_DAYS;

    // Preview the USDC cost first
    // Formula: coverage * rate * duration / (RATE_DENOM * BASE_DURATION)
    //        = 800e18 * 500 * 90d / (10000 * 90d) = 800e18 * 0.05 = 40e18 USDC
    let premium_cost = pm.preview_cost(coverage_amount, duration);
    let expected_cost: u256 = 40_000_000_000_000_000_000; // 40 USDC
    assert(premium_cost == expected_cost, 'Premium should be 40 USDC');

    // Fund buyer with USDC and approve premium module
    fund_and_approve(usdc, COVERAGE_BUYER(), pm_addr, premium_cost);

    // Buy coverage — pays USDC, receives Coverage NFT
    start_cheat_caller_address(pm_addr, COVERAGE_BUYER());
    let token_id = pm.buy_coverage(coverage_amount, duration);
    stop_cheat_caller_address(pm_addr);

    // ── Verify: Coverage NFT minted correctly ──
    assert(cov_token.is_active(token_id), 'NFT should be active');

    let position: CoveragePosition = cov_token.get_coverage(token_id);
    assert(position.protocol_id == 1, 'Covers XYZ protocol (id=1)');
    assert(position.coverage_amount == coverage_amount, 'Coverage = 800 LST');
    assert(position.premium_paid == premium_cost, 'Paid 40 USDC');
    assert(position.start_time == BASE_TIME, 'Starts now');
    assert(position.end_time == BASE_TIME + NINETY_DAYS, 'Ends in 90 days');

    // ── Verify: USDC moved from buyer to premium module ──
    assert(usdc_token.balance_of(COVERAGE_BUYER()) == 0, 'Buyer spent all USDC');
    assert(usdc_token.balance_of(pm_addr) == premium_cost, 'PM holds 40 USDC');

    // ── Verify: Premium module state updated ──
    assert(pm.is_subscribed(COVERAGE_BUYER()), 'Buyer is subscribed');
    assert(pm.total_active_coverage() == coverage_amount, '800 LST active coverage');
    assert(pm.pending_premiums() == premium_cost, '40 USDC pending');

    // ─────────────────────────────────────────────
    // Phase 5: Governance advances epoch
    //          (finalizes premiums, snapshots total shares)
    // ─────────────────────────────────────────────

    start_cheat_caller_address(pm_addr, OWNER());
    pm.advance_epoch();
    stop_cheat_caller_address(pm_addr);

    assert(pm.current_epoch() == 2, 'Now epoch 2');
    assert(pm.epoch_premiums(1) == premium_cost, 'Epoch 1 = 40 USDC');
    assert(pm.pending_premiums() == 0, 'Pending reset to 0');

    // ─────────────────────────────────────────────
    // Phase 6: LPs claim their earned USDC premiums
    //          proportional to their vault share
    // ─────────────────────────────────────────────

    let lp1_claimable = pm.claimable(1, LP1());
    let lp2_claimable = pm.claimable(1, LP2());

    assert(lp1_claimable > 0, 'LP1 earned premiums');
    assert(lp2_claimable > 0, 'LP2 earned premiums');
    // LP1 deposited 500 LST vs LP2's 300 LST → LP1 gets larger share
    assert(lp1_claimable > lp2_claimable, 'LP1 gets more (500 > 300)');

    // LP1 claims
    let lp1_usdc_before = usdc_token.balance_of(LP1());
    start_cheat_caller_address(pm_addr, LP1());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    let lp1_received = usdc_token.balance_of(LP1()) - lp1_usdc_before;
    assert(lp1_received == lp1_claimable, 'LP1 received correct USDC');

    // LP2 claims
    let lp2_usdc_before = usdc_token.balance_of(LP2());
    start_cheat_caller_address(pm_addr, LP2());
    pm.claim_premiums(1);
    stop_cheat_caller_address(pm_addr);
    let lp2_received = usdc_token.balance_of(LP2()) - lp2_usdc_before;
    assert(lp2_received == lp2_claimable, 'LP2 received correct USDC');

    // ── Final invariant: total claimed ≤ total premium (rounding dust) ──
    let total_claimed = lp1_received + lp2_received;
    assert(total_claimed <= premium_cost, 'Cannot claim > collected');

    // ── LPs still hold their vault shares (LST stays in vault) ──
    assert(vault_shares.balance_of(LP1()) == lp1_shares, 'LP1 shares untouched');
    assert(vault_shares.balance_of(LP2()) == lp2_shares, 'LP2 shares untouched');
    assert(vault.total_assets() == lp1_deposit + lp2_deposit, 'Vault LST untouched');

    // ── Claimable is now 0 for both (already claimed) ──
    assert(pm.claimable(1, LP1()) == 0, 'LP1 fully claimed');
    assert(pm.claimable(1, LP2()) == 0, 'LP2 fully claimed');
}
