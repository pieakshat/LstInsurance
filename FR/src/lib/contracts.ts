import { Contract, type Abi, type ProviderInterface } from "starknet";

export const CONTRACTS = {
  registry: "0x063496b0409b179d6ec465f6e0c9936a41d3a71d4e4e0f3f743d78ca258a17cb",
  factory: "0x05a1cf3518bb1ea5e9eb9c8d62c58087062d3f566c65849f2343eeaed8df4359",
  coverageToken: "0x07cf16f16fe7e96d66cf063739bf8d8f078ca944a271723dca5403f8c946ff5d",
  claimsManager: "0x0", // not yet deployed
} as const;

// Per-protocol addresses (vault, premiumModule) come from Protocol type
// (stored in MongoDB: protocol.vault_address, protocol.premium_module_address)

export const TOKENS = {
  // LSTBTC: vault collateral token — LPs deposit this, payouts are denominated in this
  btcLst: "0x02579f9dc11305ff5b300babde1ee79176a6d58c0f0a022c992ce3f8195b65ee",
  // MockUSDC: premium payment token — users pay premiums in this when buying coverage
  usdc: "0x04621e68e8784928870a619f405e807cf061096f301eb8b7c1fee7dc35bef91a",
} as const;

export function getContract(
  address: string,
  abi: Abi,
  provider: ProviderInterface,
): Contract {
  return new Contract(abi, address, provider);
}
