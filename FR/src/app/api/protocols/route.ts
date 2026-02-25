import { NextResponse } from "next/server";
import client from "@/lib/mongodb";

export async function GET() {
  try {
    const db = client.db("strk-insurance");
    const protocols = await db
      .collection("protocols")
      .find({ active: true })
      .toArray();

    return NextResponse.json(protocols);
  } catch (error) {
    console.error("Failed to fetch protocols:", error);
    return NextResponse.json(
      { error: "Failed to fetch protocols" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const required = [
      "protocol_id",
      "protocol_name",
      "insurance_name",
      "vault_address",
      "premium_module_address",
      "coverage_cap",
      "premium_rate",
    ];
    for (const field of required) {
      if (body[field] === undefined || body[field] === "") {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const db = client.db("strk-insurance");
    const result = await db.collection("protocols").insertOne({
      protocol_id: body.protocol_id,
      protocol_name: body.protocol_name,
      insurance_name: body.insurance_name,
      description: body.description || "",
      logo_url: body.logo_url || "",
      vault_address: body.vault_address,
      premium_module_address: body.premium_module_address,
      claims_manager_address: body.claims_manager_address || "0x0",
      coverage_cap: body.coverage_cap,
      premium_rate: body.premium_rate,
      chain: body.chain || "starknet-sepolia",
      active: body.active ?? true,
      created_at: new Date(),
    });

    return NextResponse.json(
      { _id: result.insertedId, ...body },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create protocol:", error);
    return NextResponse.json(
      { error: "Failed to create protocol" },
      { status: 500 },
    );
  }
}
