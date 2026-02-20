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
