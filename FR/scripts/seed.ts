import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^(\w+)=(.+)$/);
  if (match) process.env[match[1]] = match[2];
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env.local");
  process.exit(1);
}

const protocols = [
  {
    protocol_id: 1,
    protocol_name: "Nostra Finance",
    insurance_name: "Nostra Smart Contract Cover",
    logo_url: "https://app.nostra.finance/favicon.ico",
    description:
      "Coverage against smart contract exploits on Nostra lending and borrowing protocol.",
    vault_address: "0x0123...abcd",
    premium_module_address: "0x0456...efgh",
    coverage_cap: "1000000000000000000000000",
    premium_rate: 500,
    chain: "starknet-sepolia",
    active: true,
  },
  {
    protocol_id: 2,
    protocol_name: "Ekubo Protocol",
    insurance_name: "Ekubo DEX Cover",
    logo_url: "https://app.ekubo.org/favicon.ico",
    description:
      "Protection against vulnerabilities in Ekubo concentrated liquidity DEX contracts.",
    vault_address: "0x0789...ijkl",
    premium_module_address: "0x0abc...mnop",
    coverage_cap: "500000000000000000000000",
    premium_rate: 350,
    chain: "starknet-sepolia",
    active: true,
  },
  {
    protocol_id: 3,
    protocol_name: "zkLend",
    insurance_name: "zkLend Protocol Cover",
    logo_url: "https://app.zklend.com/favicon.ico",
    description:
      "Insurance coverage for smart contract risk on zkLend money market protocol.",
    vault_address: "0x0def...qrst",
    premium_module_address: "0x0ghi...uvwx",
    coverage_cap: "750000000000000000000000",
    premium_rate: 420,
    chain: "starknet-sepolia",
    active: true,
  },
];

async function main() {
  const client = new MongoClient(uri!);
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("strk-insurance");
    const col = db.collection("protocols");

    await col.deleteMany({});
    const result = await col.insertMany(protocols);
    console.log(`Seeded ${result.insertedCount} protocols`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
