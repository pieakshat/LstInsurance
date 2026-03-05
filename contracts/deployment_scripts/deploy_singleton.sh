#!/usr/bin/env bash
# Deploys all singleton contracts to Starknet Sepolia.
# Run from the contracts/ directory: bash deployment_scripts/deploy_singleton.sh

set -euo pipefail

URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/ObRBmbXEtBVr6aVMb4XE4yPd7FajQh63"
OWNER="0x027C634b51996243FF0f9b516E1E5D24432be0eB9118114c9a356C0378D60770"

# ─── Class Hashes (last declared: 2026-03-03) ─────────────────────────────────
MOCK_ERC20_CLASS="0x02b488f63133e09edb0e1af1103562e5bbc5644bc1cda6828af71b5c31454c2b"
REGISTRY_CLASS="0x00a0f72536abce9cd219498db119c46b2636920bf03508f95d39216af29ad8da"
COVERAGE_TOKEN_CLASS="0x02523afe7a6986ee126ba69ece78efa5b36969130fd5bb7aab18f0824cf091e4"
VAULT_CLASS="0x06267345c81110cf7707959a9ff8adc91d63965ed8ba55234dd78ec1c96e65e3"
PREMIUM_CLASS="0x044c997eecd488f907ec431db749aa867c4a47546853870841d6e8a295214ae5"
CLAIMS_CLASS="0x04b830daee7cec37e3c3ea1db53f999dd58f3f3eb779e2dc446683786e6b4dcf"
FACTORY_CLASS="0x00d01045eaeefd225e4efefff23f0e0d6ef76a63776f0c042947d743a3bb543b"

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
# Constructor: registry, vault_class_hash, premium_class_hash, claims_class_hash,
#              coverage_token, premium_asset (USDC), owner
# Paste deployed addresses from steps 3 and 4 above before running.
REGISTRY_ADDR="0x0563e74e88ce4cdf5ddf734e62fff92057a52a910d7d9b000c539dd41154ffb9"
COVERAGE_TOKEN_ADDR="0x07a14e6784c54b06fafcb3242da1e12ed4ea8dbfca2fa36acae2ecdcf0bae118"
USDC_ADDR="0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a"

echo "Deploying InsuranceVaultFactory..."
sncast deploy \
  --class-hash "$FACTORY_CLASS" \
  --arguments "$REGISTRY_ADDR, $VAULT_CLASS, $PREMIUM_CLASS, $CLAIMS_CLASS, $COVERAGE_TOKEN_ADDR, $USDC_ADDR, $OWNER" \
  --url "$URL"

echo ""
echo "Deployed singleton addresses (last run — 2026-03-03):"
echo "  MockUSDC:              0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a"
echo "  LSTBTC:                0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee"
echo "  ProtocolRegistry:      0x0563e74e88ce4cdf5ddf734e62fff92057a52a910d7d9b000c539dd41154ffb9"
echo "  CoverageToken:         0x07a14e6784c54b06fafcb3242da1e12ed4ea8dbfca2fa36acae2ecdcf0bae118"
echo "  InsuranceVaultFactory: 0x01c96db2bb1b22769d99bac9f1a65f93a21ac8e6fc264bb400971054a5971a6c"
