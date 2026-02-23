#!/usr/bin/env bash
# Deploys all singleton contracts to Starknet Sepolia.
# Run from the contracts/ directory: bash deployment_scripts/deploy_singleton.sh

set -euo pipefail

URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/ObRBmbXEtBVr6aVMb4XE4yPd7FajQh63"
OWNER="0x027C634b51996243FF0f9b516E1E5D24432be0eB9118114c9a356C0378D60770"

# ─── Class Hashes ─────────────────────────────────────────────────────────────
MOCK_ERC20_CLASS="0x2b488f63133e09edb0e1af1103562e5bbc5644bc1cda6828af71b5c31454c2b"
REGISTRY_CLASS="0xa0f72536abce9cd219498db119c46b2636920bf03508f95d39216af29ad8da"
COVERAGE_TOKEN_CLASS="0x6aededc2b55174462d21a10b09ab3bb329b4fa909372ba56c7c79944030037b"
VAULT_CLASS="0x6267345c81110cf7707959a9ff8adc91d63965ed8ba55234dd78ec1c96e65e3"
PREMIUM_CLASS="0x44c997eecd488f907ec431db749aa867c4a47546853870841d6e8a295214ae5"
FACTORY_CLASS="0x512985e99d2384462643688471ae2b7f112ef9fa9e30935f366243f2da52217"

# ─── 1. MockUSDC (name, symbol, initial_supply u256, recipient) ───────────────
# ByteArray encoding: [0, felt_of_string, len]
# "MockUSDC" = 0x4d6f636b55534443 (len 8)
# "mUSDC"    = 0x6d55534443       (len 5)
# Supply: 10,000,000 USDC (18 decimals) = 10000000000000000000000000
echo "Deploying MockUSDC..."
sncast deploy \
  --class-hash "$MOCK_ERC20_CLASS" \
  --constructor-calldata \
      0 0x4d6f636b55534443 8 \
      0 0x6d55534443 5 \
      10000000000000000000000000 0 \
      "$OWNER" \
  --url "$URL"

# ─── 2. LSTBTC (name, symbol, initial_supply u256, recipient) ────────────────
# "LSTBTC" = 0x4c5354425443 (len 6)
# "xyBTC"  = 0x7879425443   (len 5)
# Supply: 5,000,000 (18 decimals) = 5000000000000000000000000
echo "Deploying LSTBTC..."
sncast deploy \
  --class-hash "$MOCK_ERC20_CLASS" \
  --constructor-calldata \
      0 0x4c5354425443 6 \
      0 0x7879425443 5 \
      5000000000000000000000000 0 \
      "$OWNER" \
  --url "$URL"

# ─── 3. ProtocolRegistry (owner) ─────────────────────────────────────────────
echo "Deploying ProtocolRegistry..."
sncast deploy \
  --class-hash "$REGISTRY_CLASS" \
  --arguments "$OWNER" \
  --url "$URL"

# ─── 4. CoverageToken (name, symbol, owner) ───────────────────────────────────
echo "Deploying CoverageToken..."
sncast deploy \
  --class-hash "$COVERAGE_TOKEN_CLASS" \
  --arguments '"Coverage", "crvg", '"$OWNER" \
  --url "$URL"

# ─── 5. InsuranceVaultFactory ─────────────────────────────────────────────────
# Constructor: registry, vault_class_hash, premium_class_hash,
#              coverage_token, premium_asset (USDC), owner
# Paste deployed addresses from steps 3, 4, and 1 above before running.
REGISTRY_ADDR="0x063496b0409b179d6ec465f6e0c9936a41d3a71d4e4e0f3f743d78ca258a17cb"
COVERAGE_TOKEN_ADDR="0x07cf16f16fe7e96d66cf063739bf8d8f078ca944a271723dca5403f8c946ff5d"
USDC_ADDR="0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a"

echo "Deploying InsuranceVaultFactory..."
sncast deploy \
  --class-hash "$FACTORY_CLASS" \
  --arguments "$REGISTRY_ADDR, $VAULT_CLASS, $PREMIUM_CLASS, $COVERAGE_TOKEN_ADDR, $USDC_ADDR, $OWNER" \
  --url "$URL"

echo ""
echo "Deployed singleton addresses (last run — 2026-02-23):"
echo "  MockUSDC:              0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a"
echo "  LSTBTC:                0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee"
echo "  ProtocolRegistry:      0x063496b0409b179d6ec465f6e0c9936a41d3a71d4e4e0f3f743d78ca258a17cb"
echo "  CoverageToken:         0x07cf16f16fe7e96d66cf063739bf8d8f078ca944a271723dca5403f8c946ff5d"
echo "  InsuranceVaultFactory: 0x05a1cf3518bb1ea5e9eb9c8d62c58087062d3f566c65849f2343eeaed8df4359"
