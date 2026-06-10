import { NextResponse } from "next/server";

/** Per-level CT construct weights are no longer supported. */
export async function GET() {
  return NextResponse.json(
    { error: "CT construct assignment has been removed. Assessment is automatic per level type." },
    { status: 410 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "CT construct assignment has been removed. Assessment is automatic per level type." },
    { status: 410 }
  );
}

export async function POST() {
  return PUT();
}
