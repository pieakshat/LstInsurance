// ═══════════════════════════════════════════════════════════════════════════════
//
// CLAIMS MANAGER TESTS
//
// Tests the full claim lifecycle:
//   - User submits claim with Coverage NFT
//   - Governor approves → vault pays out, NFT burned, PM notified
//   - Governor rejects → user can re-submit
//   - Access control & edge cases
//
// ═══════════════════════════════════════════════════════════════════════════════

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp_global,
};
use starknet::ContractAddress;
use core::traits::TryInto;
use openzeppelin::interfaces::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};
use contracts::claims_manager::{IClaimsManagerDispatcher, IClaimsManagerDispatcherTrait, ClaimData};
use contracts::coverage_token::{ICoverageTokenDispatcher, ICoverageTokenDispatcherTrait};
use contracts::vault::{ILstVaultDispatcher, ILstVaultDispatcherTrait};
use contracts::premium_module::{IPremiumModuleDispatcher, IPremiumModuleDispatcherTrait};
use contracts::protocol_registry::{IProtocolRegistryDispatcher, IProtocolRegistryDispatcherTrait};

#[starknet::interface]
trait ITestERC4626<TContractState> {
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn total_assets(self: @TContractState) -> u256;
}

// ── Addresses ──
fn OWNER() -> ContractAddress {
    0x1.try_into().unwrap()
}
fn GOVERNOR() -> ContractAddress {
    0x2.try_into().unwrap()
}
fn LP1() -> ContractAddress {
    0x3.try_into().unwrap()
}
fn USER() -> ContractAddress {
    0x4.try_into().unwrap()
}
fn RANDOM() -> ContractAddress {
    0x5.try_into().unwrap()
}
fn PROTOCOL_ADDR() -> ContractAddress {
    0x100.try_into().unwrap()
}

// ── Constants ──
const TOKEN_SUPPLY: u256 = 10_000_000_000_000_000_000_000; // 10,000e18
const BASE_TIME: u64 = 1_700_000_000;
const NINETY_DAYS: u64 = 7_776_000;

// ── Deploy helpers ──

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

fn deploy_registry() -> ContractAddress {
    let contract = declare("ProtocolRegistry").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
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

fn deploy_claims_manager(
    vault: ContractAddress, coverage_token: ContractAddress, premium_module: ContractAddress,
) -> ContractAddress {
    let contract = declare("ClaimsManager").unwrap().contract_class();
    let mut calldata: Array<felt252> = array![];
    vault.serialize(ref calldata);
    coverage_token.serialize(ref calldata);
    premium_module.serialize(ref calldata);
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

/// Full setup: deploys LST, vault, coverage token, premium module, claims manager.
/// Funds vault with LP deposit, locks liquidity via coverage manager, mints a coverage NFT to USER.
/// Returns (claims_manager, vault, coverage_token, lst, token_id, premium_module).
fn setup_full() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress, u256, ContractAddress) {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let registry_addr = deploy_registry();

    // Register protocol
    let registry = IProtocolRegistryDispatcher { contract_address: registry_addr };
    start_cheat_caller_address(registry_addr, OWNER());
    registry.set_governance(OWNER());
    registry.register_protocol(PROTOCOL_ADDR(), vault_addr, TOKEN_SUPPLY, 500);
    stop_cheat_caller_address(registry_addr);

    // Deploy premium module
    let pm_addr = deploy_premium_module(1, vault_addr, registry_addr, cov_addr, lst);

    // Deploy claims manager with premium_module address
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, pm_addr);

    // Set claims manager on premium module
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    start_cheat_caller_address(pm_addr, OWNER());
    pm.set_claims_manager(cm_addr);
    stop_cheat_caller_address(pm_addr);

    // Grant CLAIMS_MANAGER_ROLE to claims manager on vault
    let vault = ILstVaultDispatcher { contract_address: vault_addr };
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_claims_manager(cm_addr);
    stop_cheat_caller_address(vault_addr);

    // Grant COVERAGE_MANAGER_ROLE to premium module on vault
    start_cheat_caller_address(vault_addr, OWNER());
    vault.set_coverage_manager(pm_addr);
    stop_cheat_caller_address(vault_addr);

    // Grant BURNER_ROLE to claims manager on coverage token
    let cov = ICoverageTokenDispatcher { contract_address: cov_addr };
    start_cheat_caller_address(cov_addr, OWNER());
    cov.set_burner(cm_addr);
    stop_cheat_caller_address(cov_addr);

    // Grant MINTER_ROLE to premium module on coverage token
    start_cheat_caller_address(cov_addr, OWNER());
    cov.set_minter(pm_addr);
    stop_cheat_caller_address(cov_addr);

    // Add GOVERNOR
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    start_cheat_caller_address(cm_addr, OWNER());
    cm.add_governor(GOVERNOR());
    stop_cheat_caller_address(cm_addr);

    // LP deposits 1000 LST into vault
    let lp_deposit: u256 = 1_000_000_000_000_000_000_000; // 1000e18
    fund_and_approve(lst, LP1(), vault_addr, lp_deposit);
    let vault_4626 = ITestERC4626Dispatcher { contract_address: vault_addr };
    start_cheat_caller_address(vault_addr, LP1());
    vault_4626.deposit(lp_deposit, LP1());
    stop_cheat_caller_address(vault_addr);

    // Buy coverage via premium module — this auto-locks vault capital
    let coverage_amount: u256 = 500_000_000_000_000_000_000; // 500e18
    let premium = pm.preview_cost(coverage_amount, NINETY_DAYS);
    fund_and_approve(lst, USER(), pm_addr, premium);

    start_cheat_caller_address(pm_addr, USER());
    let token_id = pm.buy_coverage(coverage_amount, NINETY_DAYS);
    stop_cheat_caller_address(pm_addr);

    (cm_addr, vault_addr, cov_addr, lst, token_id, pm_addr)
}

// ═══════════════════════════════════════════════
// Deploy & View Tests
// ═══════════════════════════════════════════════

#[test]
fn test_deploy_initial_state() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    // Use zero address for PM in simple deploy test
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    assert(cm.next_claim_id() == 1, 'Starts at 1');
    assert(!cm.is_governor(GOVERNOR()), 'No governors yet');
}

#[test]
fn test_add_governor() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, OWNER());
    cm.add_governor(GOVERNOR());
    stop_cheat_caller_address(cm_addr);

    assert(cm.is_governor(GOVERNOR()), 'Governor added');
}

#[test]
fn test_remove_governor() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, OWNER());
    cm.add_governor(GOVERNOR());
    cm.remove_governor(GOVERNOR());
    stop_cheat_caller_address(cm_addr);

    assert(!cm.is_governor(GOVERNOR()), 'Governor removed');
}

#[test]
#[should_panic]
fn test_add_governor_non_owner_fails() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, RANDOM());
    cm.add_governor(GOVERNOR());
    stop_cheat_caller_address(cm_addr);
}

// ═══════════════════════════════════════════════
// Submit Claim Tests
// ═══════════════════════════════════════════════

#[test]
fn test_submit_claim() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    assert(claim_id == 1, 'First claim = 1');
    assert(cm.next_claim_id() == 2, 'Next = 2');
    assert(cm.is_token_claimed(token_id), 'Token marked claimed');

    let claim: ClaimData = cm.get_claim(claim_id);
    assert(claim.claimant == USER(), 'Claimant is USER');
    assert(claim.token_id == token_id, 'Correct token');
    assert(claim.protocol_id == 1, 'Protocol 1');
    assert(claim.coverage_amount == 500_000_000_000_000_000_000, '500e18 coverage');
    assert(claim.status == 0, 'Status = pending');
    assert(claim.submitted_at == BASE_TIME, 'Submitted now');
    assert(claim.resolved_at == 0, 'Not resolved');
}

#[test]
#[should_panic(expected: 'Not NFT owner')]
fn test_submit_claim_not_owner_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    // RANDOM doesn't own the NFT
    start_cheat_caller_address(cm_addr, RANDOM());
    cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);
}

#[test]
#[should_panic(expected: 'Already claimed')]
fn test_submit_claim_double_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    cm.submit_claim(token_id);
    // Submit again — should fail
    cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);
}

// ═══════════════════════════════════════════════
// Approve Claim Tests
// ═══════════════════════════════════════════════

#[test]
fn test_approve_claim_full_flow() {
    let (cm_addr, vault_addr, cov_addr, lst, token_id, pm_addr) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    let lst_token = ERC20ABIDispatcher { contract_address: lst };
    let cov = ICoverageTokenDispatcher { contract_address: cov_addr };
    let pm = IPremiumModuleDispatcher { contract_address: pm_addr };
    let vault = ILstVaultDispatcher { contract_address: vault_addr };

    let coverage_amount: u256 = 500_000_000_000_000_000_000;

    // Verify vault locked before claim
    assert(vault.total_locked_liquidity() == coverage_amount, 'Vault locked 500');
    assert(pm.total_active_coverage() == coverage_amount, 'PM active 500');

    // User submits claim
    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    // Governor approves
    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.approve_claim(claim_id);
    stop_cheat_caller_address(cm_addr);

    // Verify: user received LST payout
    let user_balance_after = lst_token.balance_of(USER());
    assert(user_balance_after == coverage_amount, 'User got 500 LST payout');

    // Verify: claim status is approved
    let claim: ClaimData = cm.get_claim(claim_id);
    assert(claim.status == 1, 'Status = approved');
    assert(claim.resolved_at == BASE_TIME, 'Resolved now');

    // Verify: NFT was burned
    assert(!cov.is_active(token_id), 'NFT should be burned');

    // Verify: vault paid out and locked decreased
    assert(vault.total_payouts() == coverage_amount, 'Vault tracked payout');
    assert(vault.total_locked_liquidity() == 0, 'Vault lock cleared by payout');

    // Verify: PM state cleaned via notify_claim_payout
    assert(pm.total_active_coverage() == 0, 'PM coverage cleared');
}

#[test]
#[should_panic]
fn test_approve_claim_non_governor_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    // RANDOM is not a governor
    start_cheat_caller_address(cm_addr, RANDOM());
    cm.approve_claim(claim_id);
    stop_cheat_caller_address(cm_addr);
}

#[test]
#[should_panic(expected: 'Claim not pending')]
fn test_approve_already_approved_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.approve_claim(claim_id);
    // Approve again — should fail
    cm.approve_claim(claim_id);
    stop_cheat_caller_address(cm_addr);
}

// ═══════════════════════════════════════════════
// Reject Claim Tests
// ═══════════════════════════════════════════════

#[test]
fn test_reject_claim() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.reject_claim(claim_id);
    stop_cheat_caller_address(cm_addr);

    let claim: ClaimData = cm.get_claim(claim_id);
    assert(claim.status == 2, 'Status = rejected');
    assert(claim.resolved_at == BASE_TIME, 'Resolved now');

    // Token should be un-marked so user can re-submit
    assert(!cm.is_token_claimed(token_id), 'Token un-marked');
}

#[test]
fn test_reject_then_resubmit() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    // Submit
    start_cheat_caller_address(cm_addr, USER());
    let claim_id_1 = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    // Reject
    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.reject_claim(claim_id_1);
    stop_cheat_caller_address(cm_addr);

    // Re-submit — should work since rejection un-marks the token
    start_cheat_caller_address(cm_addr, USER());
    let claim_id_2 = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    assert(claim_id_2 == 2, 'New claim id');
    assert(cm.is_token_claimed(token_id), 'Re-marked');
}

#[test]
#[should_panic]
fn test_reject_non_governor_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    start_cheat_caller_address(cm_addr, RANDOM());
    cm.reject_claim(claim_id);
    stop_cheat_caller_address(cm_addr);
}

#[test]
#[should_panic(expected: 'Claim not pending')]
fn test_reject_already_rejected_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    start_cheat_caller_address(cm_addr, USER());
    let claim_id = cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);

    start_cheat_caller_address(cm_addr, GOVERNOR());
    cm.reject_claim(claim_id);
    cm.reject_claim(claim_id);
    stop_cheat_caller_address(cm_addr);
}

// ═══════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════

#[test]
#[should_panic(expected: 'Coverage expired')]
fn test_submit_claim_expired_coverage_fails() {
    let (cm_addr, _, _, _, token_id, _) = setup_full();
    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };

    // Advance past coverage expiry (BASE_TIME + NINETY_DAYS)
    start_cheat_block_timestamp_global(BASE_TIME + NINETY_DAYS + 1);

    start_cheat_caller_address(cm_addr, USER());
    cm.submit_claim(token_id);
    stop_cheat_caller_address(cm_addr);
}

#[test]
#[should_panic(expected: 'Claim does not exist')]
fn test_get_nonexistent_claim_fails() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    cm.get_claim(999);
}

#[test]
fn test_get_claim_status_nonexistent_returns_zero() {
    start_cheat_block_timestamp_global(BASE_TIME);

    let lst = deploy_erc20(TOKEN_SUPPLY);
    let vault_addr = deploy_vault(lst);
    let cov_addr = deploy_coverage_token();
    let cm_addr = deploy_claims_manager(vault_addr, cov_addr, 0x999.try_into().unwrap());

    let cm = IClaimsManagerDispatcher { contract_address: cm_addr };
    // Non-existent claim returns 0 (which happens to be STATUS_PENDING, but claimant is zero)
    assert(cm.get_claim_status(999) == 0, 'Default is 0');
}
