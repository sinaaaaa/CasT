import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "CT construct management has been removed." },
    { status: 410 }
  );
}

export async function DELETE() {
  return PATCH();
}
