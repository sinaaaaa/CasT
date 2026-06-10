import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { importItemsDataset } from "@/lib/items-dataset";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requireTeacher();
  if (error) return error;

  try {
    const body = await request.json();
    const removeMissing = Boolean(body?.replaceMissing);
    const dataset = body?.dataset ?? body;
    const result = await importItemsDataset(dataset, { removeMissing });
    return Response.json({
      ok: true,
      imported: result.imported,
      levelKeys: result.levelKeys,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Restore failed" },
      { status: 400 }
    );
  }
}
