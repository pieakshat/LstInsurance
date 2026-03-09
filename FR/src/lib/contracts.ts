import { Contract, type Abi, type ProviderInterface } from "starknet";

export const CONTRACTS = {
  registry:      "0x0493ff23ec196924e7facfba6b351b9e40c906c280f48dc1892b113b6442ad0a",
  factory:       "0x0293d696a31a5755e5e625e83f797a8e9075037bd868f51d3eee8480a099fc02",
  coverageToken: "0x0648a1f37af0adeea21180c08e1ddd5002561f50cee547ed9bf56588153c9319",
  claimsManager: "0x0",
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
