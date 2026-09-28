// B8: partnerexport als CSV (Excel-compatibel). Recht 'lezen' vereist.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { exportPartners, partnersCsv, partnersRijen, waardenRijen } from "@/lib/domain/export";
import { naarXlsx, xlsxAntwoord } from "@/lib/xlsx";
import { partnersPdf } from "@/lib/domain/pdf";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const metGearchiveerd = params.get("gearchiveerd") === "1";
  const db = await getDb();
  const stempel = new Date().toISOString().slice(0, 10);
  if (params.get("formaat") === "pdf") {
    return new NextResponse(new Uint8Array(partnersPdf(db, metGearchiveerd)), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="partners-${stempel}.pdf"` } });
  }
  if (params.get("formaat") === "xlsx") {
    // US-67: partnerlijst plus alle waarden met status en betrouwbaarheid (hoog/midden/laag) per veld.
    return xlsxAntwoord(await naarXlsx([{ naam: "Partners", rijen: partnersRijen(db, metGearchiveerd) }, { naam: "Waarden met herkomst", rijen: waardenRijen(db, exportPartners(db, metGearchiveerd)) }]), `partners-${stempel}`);
  }
  const csv = partnersCsv(db, metGearchiveerd);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="partners-${stempel}.csv"` } });
}
