// US-58/US-67: specificatie van het AI-verbruik (bewerkingen, tokens, providerkosten) als CSV of Excel. Alleen de beheerder.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { naarCsv } from "@/lib/domain/export";
import { verbruikSpecificatie } from "@/lib/domain/kosten";
import { getDb, muteer } from "@/lib/store";
import { naarXlsx, xlsxAntwoord } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "beheer")) return NextResponse.json({ fout: "Alleen de beheerder exporteert de verbruiksspecificatie." }, { status: 403 });
  const formaat = new URL(request.url).searchParams.get("formaat") === "xlsx" ? "xlsx" : "csv";
  const db = await getDb();
  const spec = verbruikSpecificatie(db);
  const stempel = new Date().toISOString().slice(0, 10);
  await muteer(g, { entiteit: "export", entiteitId: "verbruik", actie: `verbruiksspecificatie gedownload (${formaat})`, details: `${spec.regels.length} bewerkingen` }, () => undefined);
  if (formaat === "xlsx") {
    return xlsxAntwoord(await naarXlsx([{ naam: "Per maand", rijen: spec.perMaand }, { naam: "Per kwartaal", rijen: spec.perKwartaal }, { naam: "Bewerkingen", rijen: spec.regels }, { naam: "Rekenprijzen", rijen: spec.rekenprijzen }]), `ai-verbruik-${stempel}`);
  }
  return new NextResponse(naarCsv(spec.regels.length ? spec.regels : [{ Melding: "Nog geen AI-bewerkingen geregistreerd." }]), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ai-verbruik-${stempel}.csv"` } });
}
