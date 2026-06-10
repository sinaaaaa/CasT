import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { exportItemsDataset } from "@/lib/items-dataset";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireTeacher();
  if (error) return error;

  const dataset = await exportItemsDataset();
  const stamp = new Date().toISOString().slice(0, 10);
  return Response.json(dataset, {
    headers: {
      "Content-Disposition": `attachment; filename="sparc-items-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
