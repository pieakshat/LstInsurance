import { Contract, type Abi, type ProviderInterface } from "starknet";

export const CONTRACTS = {
  registry: "0x07569427aef9c02a6735e163b031391b0d6fd75802cc79dacfa0ca8c6dff8042",
  factory: "0x07bfa4cfd2aa95bcce182e720b7d6488aa083708584489b44513ff37bf182b6b",
  coverageToken: "0x0691854648653bbfe39097a2b939e0c9fdc722c274a1b17afd52581df76156d1",
  claimsManager: "0x0", // not yet deployed
} as const;

// Per-protocol addresses (vault, premiumModule) come from Protocol type
// (stored in MongoDB: protocol.vault_address, protocol.premium_module_address)

export const TOKENS = {
  // BTC-LST: vault collateral token — LPs deposit this, payouts are denominated in this
  btcLst: "0x03a796c96835c5b8ace116314af06cd6064b0ea0ce0d59e48db3d3421c9e0591",
  // USDC: premium payment token — users pay premiums in this when buying coverage.
  // Update this address after deploying MockUSDC (or use a Sepolia USDC address).
  usdc: "0x0",
} as const;

export function getContract(
  address: string,
  abi: Abi,
  provider: ProviderInterface,
): Contract {
  return new Contract(abi, address, provider);
}
