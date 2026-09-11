// B8: projecthistorie-export als CSV (Excel-compatibel). Recht 'lezen' vereist.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { historieCsv } from "@/lib/domain/export";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const db = await getDb();
  return new NextResponse(historieCsv(db), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="projecthistorie-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
