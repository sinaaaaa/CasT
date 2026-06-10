import { NextResponse } from "next/server";

/** CT construct catalog is no longer used for level assessment. */
export async function GET() {
  return NextResponse.json({ constructs: [] });
}

export async function POST() {
  return NextResponse.json(
    { error: "CT construct management has been removed." },
    { status: 410 }
  );
}
