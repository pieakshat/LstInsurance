import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const CONTRACTS_DIR = resolve(__dirname, "../../contracts/target/dev");
const ABIS_DIR = resolve(__dirname, "../src/lib/abis");

const CONTRACTS = [
  {
    artifact: "contracts_LstVault",
    outFile: "vault.ts",
    exportName: "VAULT_ABI",
  },
  {
    artifact: "contracts_PremiumModule",
    outFile: "premium-module.ts",
    exportName: "PREMIUM_MODULE_ABI",
  },
  {
    artifact: "contracts_CoverageToken",
    outFile: "coverage-token.ts",
    exportName: "COVERAGE_TOKEN_ABI",
  },
  {
    artifact: "contracts_ClaimsManager",
    outFile: "claims-manager.ts",
    exportName: "CLAIMS_MANAGER_ABI",
  },
  {
    artifact: "contracts_ProtocolRegistry",
    outFile: "registry.ts",
    exportName: "REGISTRY_ABI",
  },
  {
    artifact: "contracts_InsuranceVaultFactory",
    outFile: "factory.ts",
    exportName: "FACTORY_ABI",
  },
] as const;

for (const { artifact, outFile, exportName } of CONTRACTS) {
  const jsonPath = resolve(CONTRACTS_DIR, `${artifact}.contract_class.json`);
  const raw = readFileSync(jsonPath, "utf-8");
  const parsed = JSON.parse(raw);
  const abi = parsed.abi;

  if (!Array.isArray(abi)) {
    console.error(`No ABI array found in ${jsonPath}`);
    process.exit(1);
  }

  const content = `export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;
  const outPath = resolve(ABIS_DIR, outFile);
  writeFileSync(outPath, content, "utf-8");
  console.log(`Wrote ${outFile} (${abi.length} entries)`);
}

console.log("Done.");
