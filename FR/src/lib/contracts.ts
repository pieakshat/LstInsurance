import { Contract, type Abi, type ProviderInterface } from "starknet";

export const CONTRACTS = {
  registry: "0x0",
  factory: "0x0",
  coverageToken: "0x0",
  claimsManager: "0x0",
} as const;

// Per-protocol addresses (vault, premiumModule) come from Protocol type
// (stored in MongoDB: protocol.vault_address, protocol.premium_module_address)

export const TOKENS = {
  usdc: "0x0",   // Sepolia USDC
  btcLst: "0x0", // Sepolia BTC-LST
} as const;

export function getContract(
  address: string,
  abi: Abi,
  provider: ProviderInterface,
): Contract {
  return new Contract(abi, address, provider);
}
