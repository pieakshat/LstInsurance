#!/usr/bin/env bash
# =============================================================================
# STRK Insurance Protocol — Deployment Script
# Phases: declare → deploy singletons → wire roles → onboard demo protocol
# =============================================================================
# Usage:
#   1. Set UNDERLYING_ASSET to the BTC-LST token address on Sepolia
#   2. Set DEMO_PROTOCOL to the protocol address you want to insure
#   3. cd to project root and run: bash deploy.sh
# =============================================================================

set -euo pipefail

# ─── COLORS ──────────────────────────────────────────────────────────────────
GRN='\033[0;32m'; BLU='\033[0;34m'; YLW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()     { echo -e "${BLU}▶${NC} $*"; }
success() { echo -e "${GRN}✓${NC} $*"; }
warn()    { echo -e "${YLW}⚠${NC} $*"; }
die()     { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
section() { echo -e "\n${BLU}━━━ $* ━━━${NC}"; }

# ─── CONFIG — Edit these before running ──────────────────────────────────────

# BTC-LST token address on Sepolia (the underlying asset for the vault)
UNDERLYING_ASSET=""  # e.g. 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d

# Protocol contract to insure (the address users deposit into)
DEMO_PROTOCOL="0x1"  # Replace with actual protocol address

# Owner / deployer address
OWNER="0x01951c7e2bac182bc2340d5c143d8dc060191c9be1f8484c0341372d86cd71e1"

# Demo vault parameters
VAULT_NAME="Insured Nostra Vault"
VAULT_SYMBOL="ivNOSTRA"
COVERAGE_CAP="100000000000000000000"     # 100 tokens (18 decimals)
PREMIUM_RATE="500"                        # 5% = 500 basis points
DEPOSIT_LIMIT="1000000000000000000000"   # 1000 tokens

# ─── SETUP ───────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR/contracts"

[[ -z "$UNDERLYING_ASSET" ]] && die "Set UNDERLYING_ASSET before running"
[[ ! -d "$CONTRACTS_DIR" ]]  && die "contracts/ directory not found at $SCRIPT_DIR"

cd "$CONTRACTS_DIR"

# sncast using the 'sepolia' profile defined in contracts/snfoundry.toml
SC="sncast --profile sepolia"

echo ""
echo "════════════════════════════════════════════════════"
echo "  STRK Insurance — Deploy to Starknet Sepolia"
echo "════════════════════════════════════════════════════"
echo "  Owner:    $OWNER"
echo "  Asset:    $UNDERLYING_ASSET"
echo "  Protocol: $DEMO_PROTOCOL"
echo "════════════════════════════════════════════════════"

# ─── HELPERS ─────────────────────────────────────────────────────────────────

# Declare a contract; returns class hash. Handles "already declared" gracefully.
declare_class() {
  local name="$1"
  local output hash
  log "Declaring $name..."
  if output=$($SC declare --contract-name "$name" 2>&1); then
    hash=$(echo "$output" | grep "Class Hash:" | awk '{print $NF}')
    success "$name → $hash"
    echo "$hash"
  else
    # Already declared — extract hash from the error message
    hash=$(echo "$output" | grep -oE '0x[0-9a-f]{60,64}' | head -1)
    if [[ -n "$hash" ]]; then
      warn "$name already declared → $hash"
      echo "$hash"
    else
      echo "$output" >&2
      die "Failed to declare $name"
    fi
  fi
}

# Deploy a contract; returns contract address.
deploy_contract() {
  local class_hash="$1" args="$2" label="$3"
  local output addr
  log "Deploying $label..."
  output=$($SC deploy --class-hash "$class_hash" --arguments "$args" 2>&1)
  addr=$(echo "$output" | grep "Contract Address:" | awk '{print $NF}')
  [[ -z "$addr" ]] && { echo "$output" >&2; die "Deploy failed for $label"; }
  success "$label → $addr"
  echo "$addr"
}

# Invoke a write function (fire-and-forget, waits for tx).
invoke_fn() {
  local addr="$1" fn="$2" args="$3" label="$4"
  local output
  log "Invoking $label..."
  output=$($SC invoke --contract-address "$addr" --function "$fn" --arguments "$args" 2>&1)
  echo "$output" | grep -E "Transaction Hash:|transaction_hash:" || true
  success "$label done"
}

# Call a read function; returns first hex value from response.
call_fn() {
  local addr="$1" fn="$2" args="$3"
  local output
  output=$($SC call --contract-address "$addr" --function "$fn" --arguments "$args" 2>&1)
  echo "$output" | grep -oE '0x[0-9a-f]+' | head -1
}

# ─── PHASE 1 — DECLARE CLASS HASHES ─────────────────────────────────────────
section "Phase 1 — Declare class hashes"

# LstVault: already declared on Sepolia — hardcode the known class hash
VAULT_CLASS_HASH="0x6267345c81110cf7707959a9ff8adc91d63965ed8ba55234dd78ec1c96e65e3"
success "LstVault (pre-declared) → $VAULT_CLASS_HASH"

REGISTRY_CLASS_HASH=$(declare_class "ProtocolRegistry")
COVERAGE_TOKEN_CLASS_HASH=$(declare_class "CoverageToken")
FACTORY_CLASS_HASH=$(declare_class "InsuranceVaultFactory")
PREMIUM_CLASS_HASH=$(declare_class "PremiumModule")

# ─── PHASE 2 — DEPLOY SINGLETONS ─────────────────────────────────────────────
section "Phase 2 — Deploy singletons"

# ProtocolRegistry(owner)
REGISTRY_ADDR=$(deploy_contract \
  "$REGISTRY_CLASS_HASH" \
  "$OWNER" \
  "ProtocolRegistry")

# CoverageToken(name, symbol, owner)
COVERAGE_TOKEN_ADDR=$(deploy_contract \
  "$COVERAGE_TOKEN_CLASS_HASH" \
  "str:\"Insurance Coverage Position\", str:\"COVER\", $OWNER" \
  "CoverageToken")

# InsuranceVaultFactory(registry, vault_class_hash, premium_class_hash, coverage_token, owner)
FACTORY_ADDR=$(deploy_contract \
  "$FACTORY_CLASS_HASH" \
  "$REGISTRY_ADDR, $VAULT_CLASS_HASH, $PREMIUM_CLASS_HASH, $COVERAGE_TOKEN_ADDR, $OWNER" \
  "InsuranceVaultFactory")

# ─── PHASE 3 — WIRE CROSS-CONTRACT ROLES ─────────────────────────────────────
section "Phase 3 — Wire roles"

# Grant factory GOVERNANCE_ROLE on registry so it can call set_vault()
invoke_fn "$REGISTRY_ADDR" "set_governance" "$FACTORY_ADDR" \
  "Registry.set_governance(factory)"

# ─── PHASE 4 — ONBOARD DEMO PROTOCOL ─────────────────────────────────────────
section "Phase 4 — Onboard demo protocol"

# register_protocol(protocol_address, vault=0x0, coverage_cap: u256, premium_rate: u256)
# u256 args: each value needs (low, high) — sncast --arguments handles this automatically
invoke_fn "$REGISTRY_ADDR" "register_protocol" \
  "$DEMO_PROTOCOL, 0x0, $COVERAGE_CAP, 0, $PREMIUM_RATE, 0" \
  "Registry.register_protocol"

PROTOCOL_ID="1"

# factory.create_vault(protocol_id: u256, name, symbol, underlying_asset)
invoke_fn "$FACTORY_ADDR" "create_vault" \
  "$PROTOCOL_ID, 0, str:\"$VAULT_NAME\", str:\"$VAULT_SYMBOL\", $UNDERLYING_ASSET" \
  "Factory.create_vault (protocol_id=$PROTOCOL_ID)"

# Wait for txs to land before reading back addresses
log "Waiting for transactions to be accepted..."
sleep 15

VAULT_ADDR=$(call_fn "$FACTORY_ADDR" "get_vault" "$PROTOCOL_ID, 0")
PM_ADDR=$(call_fn "$FACTORY_ADDR" "get_premium_module" "$PROTOCOL_ID, 0")

[[ -z "$VAULT_ADDR" ]] && die "Could not read vault address from factory — check tx on Starkscan"
[[ -z "$PM_ADDR" ]]    && die "Could not read premium module address from factory"

success "LstVault (demo)      → $VAULT_ADDR"
success "PremiumModule (demo) → $PM_ADDR"

# Grant PremiumModule MINTER_ROLE on CoverageToken
invoke_fn "$COVERAGE_TOKEN_ADDR" "set_minter" "$PM_ADDR" \
  "CoverageToken.set_minter(pm)"

# Set vault deposit cap
invoke_fn "$VAULT_ADDR" "set_deposit_limit" "$DEPOSIT_LIMIT, 0" \
  "Vault.set_deposit_limit"

# Grant PremiumModule COVERAGE_MANAGER_ROLE on vault
invoke_fn "$VAULT_ADDR" "set_coverage_manager" "$PM_ADDR" \
  "Vault.set_coverage_manager(pm)"

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  Deployment Complete"
echo "════════════════════════════════════════════════════"
echo ""
echo "  Class Hashes:"
echo "    LstVault:              $VAULT_CLASS_HASH"
echo "    PremiumModule:         $PREMIUM_CLASS_HASH"
echo "    ProtocolRegistry:      $REGISTRY_CLASS_HASH"
echo "    CoverageToken:         $COVERAGE_TOKEN_CLASS_HASH"
echo "    InsuranceVaultFactory: $FACTORY_CLASS_HASH"
echo ""
echo "  Deployed Contracts:"
echo "    ProtocolRegistry:      $REGISTRY_ADDR"
echo "    CoverageToken:         $COVERAGE_TOKEN_ADDR"
echo "    InsuranceVaultFactory: $FACTORY_ADDR"
echo "    LstVault [demo]:       $VAULT_ADDR"
echo "    PremiumModule [demo]:  $PM_ADDR"
echo ""
echo "  Next steps:"
echo "    • Set UNDERLYING_ASSET approval before LP deposits"
echo "    • coverage_token.set_burner(<claims_manager>) when CM is deployed"
echo "    • vault.set_claims_manager(<claims_manager>) per vault"
echo "    • premium_module.set_claims_manager(<claims_manager>) per vault"
echo "════════════════════════════════════════════════════"
