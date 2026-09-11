// B8: partnerexport als CSV (Excel-compatibel). Recht 'lezen' vereist.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { partnersCsv } from "@/lib/domain/export";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const metGearchiveerd = new URL(request.url).searchParams.get("gearchiveerd") === "1";
  const db = await getDb();
  const csv = partnersCsv(db, metGearchiveerd);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="partners-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
