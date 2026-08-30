// US-31: periodieke verrijkingsronde via cron. POST met header x-cron-secret (CRON_SECRET). Zelfde logica als startVerrijking, met systeemgebruiker.
import { NextResponse } from "next/server";
import { extraheerVoorstellen, haalWebsiteOp } from "@/lib/domain/enrichment";
import type { EnrichmentVoorstel, Gebruiker } from "@/lib/domain/types";
import { getDb, muteer } from "@/lib/store";

export const dynamic = "force-dynamic";

const CRON: Gebruiker = { id: "cron", naam: "cron", rol: "beheerder" };

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") !== secret) return NextResponse.json({ ok: false, fout: "Ongeldig cron-secret." }, { status: 401 });

  const db = await getDb();
  const doelen = db.partners.filter((p) => p.status !== "geblokkeerd");
  const nieuweVoorstellen: EnrichmentVoorstel[] = [];
  for (const p of doelen) {
    let bronTekst: string | null = null;
    let bronUrl = p.website ?? "";
    if (db.instellingen.externeBronnenToegestaan && p.website) bronTekst = await haalWebsiteOp(p.website);
    if (!bronTekst) {
      bronTekst = [p.omschrijving, ...p.referenties].join(". ");
      bronUrl = bronUrl || "profieltekst";
    }
    nieuweVoorstellen.push(...extraheerVoorstellen(p, bronTekst, bronUrl));
  }
  const toegevoegd = await muteer(CRON, { entiteit: "verrijking", entiteitId: "alle", actie: "periodieke verrijkingsronde (cron)", details: `${nieuweVoorstellen.length} voorstellen` }, (db) => {
    const bestaand = new Set(db.verrijkingsvoorstellen.filter((x) => x.status === "open").map((x) => `${x.partnerId}|${x.factorId}|${JSON.stringify(x.voorgesteld)}`));
    let n = 0;
    nieuweVoorstellen.forEach((v) => {
      const sleutel = `${v.partnerId}|${v.factorId}|${JSON.stringify(v.voorgesteld)}`;
      if (!bestaand.has(sleutel)) {
        db.verrijkingsvoorstellen.unshift(v);
        bestaand.add(sleutel);
        n++;
      }
    });
    db.instellingen.laatsteVerrijking = new Date().toISOString();
    return n;
  });
  return NextResponse.json({ ok: true, partners: doelen.length, gevonden: nieuweVoorstellen.length, nieuwInWachtrij: toegevoegd });
}
