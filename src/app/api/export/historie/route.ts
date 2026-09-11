// B8: projecthistorie-export als CSV (Excel-compatibel). Recht 'lezen' vereist.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { historieCsv } from "@/lib/domain/export";
import { historiePdf } from "@/lib/domain/pdf";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const db = await getDb();
  const stempel = new Date().toISOString().slice(0, 10);
  if (new URL(request.url).searchParams.get("formaat") === "pdf") {
    return new NextResponse(new Uint8Array(historiePdf(db)), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="projecthistorie-${stempel}.pdf"` } });
  }
  return new NextResponse(historieCsv(db), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="projecthistorie-${stempel}.csv"` } });
}
