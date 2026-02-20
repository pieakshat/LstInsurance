import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid protocol ID" }, { status: 400 });
  }

  try {
    const db = client.db("strk-insurance");
    const protocol = await db
      .collection("protocols")
      .findOne({ _id: new ObjectId(id), active: true });

    if (!protocol) {
      return NextResponse.json(
        { error: "Protocol not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(protocol);
  } catch (error) {
    console.error("Failed to fetch protocol:", error);
    return NextResponse.json(
      { error: "Failed to fetch protocol" },
      { status: 500 }
    );
  }
}
