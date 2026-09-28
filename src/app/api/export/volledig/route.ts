// US-68: volledige data-export met herkomst (art. 15.4) — JSON (volledig) of CSV-tabellen in een ZIP. Alleen de beheerder;
// het downloaden wordt gelogd.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { naarCsv } from "@/lib/domain/export";
import { volledigeExportJson, volledigeExportTabellen } from "@/lib/domain/volledigeExport";
import { getDb, muteer } from "@/lib/store";
import { maakZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "volledige_export")) return NextResponse.json({ fout: "Alleen de beheerder maakt een volledige export." }, { status: 403 });
  const formaat = new URL(request.url).searchParams.get("formaat") === "csv" ? "csv" : "json";
  const db = await getDb();
  const stempel = new Date().toISOString().slice(0, 10);
  await muteer(g, { entiteit: "export", entiteitId: "volledig", actie: `volledige data-export gedownload (${formaat})`, details: `${db.partners.length} partners, ${db.projecten.length} projecten, ${db.evaluaties.length} evaluaties` }, () => undefined);
  if (formaat === "json") {
    return new NextResponse(JSON.stringify(volledigeExportJson(db, g.naam), null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="partnerdatabase-volledig-${stempel}.json"` } });
  }
  const tabellen = volledigeExportTabellen(db);
  const leesmij = `Volledige export partnerdatabase Blauwhoed (${new Date().toISOString()}, door ${g.naam}).\r\nElke tabel is een CSV-bestand (puntkomma, UTF-8). 'waarden-met-herkomst' bevat per gegeven de bron, bronrang, status en betrouwbaarheid.\r\nVerbanden zijn uit bronnen afgeleide signalen, geen bevestigde samenwerking. De JSON-export bevat daarnaast de volledige opgeslagen staat.\r\n`;
  const zip = maakZip([{ naam: "LEESMIJ.txt", inhoud: leesmij }, ...Object.entries(tabellen).map(([naam, rijen]) => ({ naam: `${naam}.csv`, inhoud: naarCsv(rijen.length ? rijen : [{ Melding: "geen gegevens" }]) }))]);
  return new NextResponse(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="partnerdatabase-volledig-${stempel}-csv.zip"` } });
}
