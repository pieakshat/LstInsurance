import { Contract, type Abi, type ProviderInterface } from "starknet";

export const CONTRACTS = {
  registry:      "0x0563e74e88ce4cdf5ddf734e62fff92057a52a910d7d9b000c539dd41154ffb9",
  factory:       "0x01c96db2bb1b22769d99bac9f1a65f93a21ac8e6fc264bb400971054a5971a6c",
  coverageToken: "0x07a14e6784c54b06fafcb3242da1e12ed4ea8dbfca2fa36acae2ecdcf0bae118",
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
