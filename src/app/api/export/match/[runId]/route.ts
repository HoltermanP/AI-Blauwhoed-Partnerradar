// US-67: matchresultaten van één run als Excel (.xlsx) of CSV, met bron en betrouwbaarheid per criterium.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { matchRijen, naarCsv } from "@/lib/domain/export";
import { getDb } from "@/lib/store";
import { naarXlsx, xlsxAntwoord } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const { runId } = await params;
  const db = await getDb();
  const run = db.matchRuns.find((r) => r.id === runId);
  if (!run) return NextResponse.json({ fout: "Matchrun niet gevonden." }, { status: 404 });
  const r = matchRijen(run, db);
  const naam = `match-${(db.projecten.find((p) => p.id === run.projectId)?.naam ?? run.projectId).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${run.gestartOp.slice(0, 10)}`;
  if (new URL(request.url).searchParams.get("formaat") === "csv") return new NextResponse(naarCsv(r.kandidaten), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${naam}.csv"` } });
  return xlsxAntwoord(await naarXlsx([{ naam: "Kandidaten", rijen: r.kandidaten }, { naam: "Criteria", rijen: r.criteria }, { naam: "Uitsluitingen", rijen: r.uitsluitingen }, { naam: "Toelichting", rijen: r.toelichting }]), naam);
}
