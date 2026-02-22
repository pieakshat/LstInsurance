#!/usr/bin/env bash
# Deploys all singleton contracts to Starknet Sepolia.
# Run from the contracts/ directory: bash deployment_scripts/deploy_singleton.sh

set -euo pipefail

URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/ObRBmbXEtBVr6aVMb4XE4yPd7FajQh63"
OWNER="0x02d6a1ea40e3cb95a061ff9b1923ba549499be08bf3e26b1b21366b6d83abdde"

# ─── Class Hashes ─────────────────────────────────────────────────────────────
MOCK_ERC20_CLASS="0x149729072ed51b3a3fcf73671e7b54492c4aa89f96d68906afd6794ea565626"
REGISTRY_CLASS="0xa0f72536abce9cd219498db119c46b2636920bf03508f95d39216af29ad8da"
COVERAGE_TOKEN_CLASS="0x6aededc2b55174462d21a10b09ab3bb329b4fa909372ba56c7c79944030037b"
VAULT_CLASS="0x6267345c81110cf7707959a9ff8adc91d63965ed8ba55234dd78ec1c96e65e3"
PREMIUM_CLASS="0x7650862ea26aa86d519fa11eb1e3657e9485be161b71172f4a0650e86f22a1b"
FACTORY_CLASS="0x4661d3bf0883817b7b6e55ab9806fa1ccaabb5d08f3d0abf5628e72b4401e00"

# ─── 1. MockERC20 (initial_supply, recipient) ──────────────────────────────────
echo "Deploying MockERC20..."
sncast deploy \
  --class-hash "$MOCK_ERC20_CLASS" \
  --arguments "1000000, $OWNER" \
  --url "$URL"

# ─── 2. ProtocolRegistry (owner) ─────────────────────────────────────────────
echo "Deploying ProtocolRegistry..."
sncast deploy \
  --class-hash "$REGISTRY_CLASS" \
  --arguments "$OWNER" \
  --url "$URL"

# ─── 3. CoverageToken (name, symbol, owner) ───────────────────────────────────
echo "Deploying CoverageToken..."
sncast deploy \
  --class-hash "$COVERAGE_TOKEN_CLASS" \
  --arguments '"Coverage", "crvg", '"$OWNER" \
  --url "$URL"

# ─── 4. InsuranceVaultFactory (registry, vault_class_hash, premium_class_hash, coverage_token, owner)
# NOTE: paste the deployed addresses from steps 2 and 3 above before running step 4
REGISTRY_ADDR="0x07569427aef9c02a6735e163b031391b0d6fd75802cc79dacfa0ca8c6dff8042"
COVERAGE_TOKEN_ADDR="0x0691854648653bbfe39097a2b939e0c9fdc722c274a1b17afd52581df76156d1"

echo "Deploying InsuranceVaultFactory..."
sncast deploy \
  --class-hash "$FACTORY_CLASS" \
  --arguments "$REGISTRY_ADDR, $VAULT_CLASS, $PREMIUM_CLASS, $COVERAGE_TOKEN_ADDR, $OWNER" \
  --url "$URL"

echo ""
echo "Deployed singleton addresses (from last run):"
echo "  MockERC20:             0x02b2392f405feba76ec54294f5920b29e055fc3bf18f480d229795d7f0e04a11"
echo "  ProtocolRegistry:      0x07569427aef9c02a6735e163b031391b0d6fd75802cc79dacfa0ca8c6dff8042"
echo "  CoverageToken:         0x0691854648653bbfe39097a2b939e0c9fdc722c274a1b17afd52581df76156d1"
echo "  InsuranceVaultFactory: 0x07bfa4cfd2aa95bcce182e720b7d6488aa083708584489b44513ff37bf182b6b"
