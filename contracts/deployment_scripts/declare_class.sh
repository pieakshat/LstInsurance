#!/usr/bin/env bash
# Declares all contract classes on Starknet Sepolia.
# Run from the contracts/ directory: bash deployment_scripts/declare_class.sh

set -euo pipefail

URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/ObRBmbXEtBVr6aVMb4XE4yPd7FajQh63"

declare_class() {
  local name="$1"
  local output hash
  echo "Declaring $name..."
  if output=$(sncast declare --contract-name "$name" --url "$URL" 2>&1); then
    hash=$(echo "$output" | grep "Class Hash:" | awk '{print $NF}')
    echo "  $name -> $hash"
  else
    hash=$(echo "$output" | grep -oE '0x[0-9a-f]{60,64}' | head -1)
    if [[ -n "$hash" ]]; then
      echo "  $name already declared -> $hash"
    else
      echo "$output" >&2
      echo "  ERROR: failed to declare $name" >&2
      exit 1
    fi
  fi
}

declare_class MockERC20
declare_class ProtocolRegistry
declare_class CoverageToken
declare_class LstVault
declare_class PremiumModule
declare_class InsuranceVaultFactory
declare_class ClaimsManager

echo ""
echo "Known class hashes (from last successful declaration run):"
echo "  MockERC20:             0x149729072ed51b3a3fcf73671e7b54492c4aa89f96d68906afd6794ea565626"
echo "  ProtocolRegistry:      0x00a0f72536abce9cd219498db119c46b2636920bf03508f95d39216af29ad8da"
echo "  CoverageToken:         0x06aededc2b55174462d21a10b09ab3bb329b4fa909372ba56c7c79944030037b"
echo "  LstVault:              0x6267345c81110cf7707959a9ff8adc91d63965ed8ba55234dd78ec1c96e65e3"
echo "  PremiumModule:         0x07650862ea26aa86d519fa11eb1e3657e9485be161b71172f4a0650e86f22a1b"
echo "  InsuranceVaultFactory: 0x4661d3bf0883817b7b6e55ab9806fa1ccaabb5d08f3d0abf5628e72b4401e00"
echo "  ClaimsManager:         0x04b830daee7cec37e3c3ea1db53f999dd58f3f3eb779e2dc446683786e6b4dcf"
