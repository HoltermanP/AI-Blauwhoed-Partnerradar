// US-56: periodieke verrijking volgens het instelbare schema. Vercel Cron roept dit endpoint dagelijks aan (vercel.json, GET met
// Authorization: Bearer $CRON_SECRET); handmatig kan ook POST met header x-cron-secret. Het endpoint beslist aan de hand van het
// schema of er een ronde moet draaien, hervat een lopende geplande ronde en toont de volgende geplande ronde.
// US-58: een ronde die het maandbudget zou overschrijden start niet automatisch; de beheerder krijgt een signaal.
import { NextResponse } from "next/server";
import { startVerrijking } from "@/lib/actions";
import { aiBeschikbaar } from "@/lib/ai";
import { budgetStatus, schatVerrijkingsronde } from "@/lib/domain/kosten";
import { schemaVan, selecteerPartners, teDraaienRonde, volgendeGeplandeRonde } from "@/lib/domain/schema";
import { getDb, muteer } from "@/lib/store";
import { SYSTEEM_SLEUTEL } from "@/lib/systeem";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYSTEEM = { id: "systeem", naam: "systeem", rol: "beheerder" as const };

function geautoriseerd(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // in productie is een CRON_SECRET verplicht
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

async function verwerk(request: Request) {
  if (!geautoriseerd(request)) return NextResponse.json({ ok: false, fout: "Ongeldig of ontbrekend cron-secret." }, { status: 401 });
  const db = await getDb();
  const nu = new Date();
  const schema = schemaVan(db);
  await muteer(SYSTEEM, { entiteit: "verrijking", entiteitId: "schema", actie: "dagelijkse schemacontrole" }, (d) => {
    d.instellingen.verrijkingsschema = { ...schemaVan(d), laatsteControle: nu.toISOString() };
  });
  const open = db.verrijkingsrondes.find((r) => !r.klaarOp && r.gepland);
  const gepland = teDraaienRonde(schema, nu);
  if (!open && !gepland) return NextResponse.json({ ok: true, gestart: false, reden: schema.frequentie === "uit" ? "Periodieke verrijking staat uit." : "Nog geen ronde gepland.", volgendeRonde: volgendeGeplandeRonde(schema, nu)?.toISOString() ?? null });

  if (!open && gepland) {
    const selectie = selecteerPartners(db, schema, nu);
    const schatting = schatVerrijkingsronde(selectie, db, aiBeschikbaar(), { alleenGewijzigd: schema.omvang === "gewijzigde_website", nu });
    const budget = budgetStatus(db, nu);
    const reden = budget.overschreden ? "het AI-maandbudget is al bereikt" : schatting.overschrijdtBudget ? `de ronde vraagt naar verwachting ${schatting.bewerkingen} AI-bewerkingen (≈ € ${schatting.geschatteKostenEur.toFixed(2)}) en zou het maandbudget overschrijden (resterend ${schatting.resterendNa + schatting.bewerkingen} bewerkingen, € ${(schatting.resterendEurNa + schatting.geschatteKostenEur).toFixed(2)} tokenbudget)` : null;
    if (reden) {
      await muteer(SYSTEEM, { entiteit: "verrijking", entiteitId: "schema", actie: "geplande ronde niet gestart", details: reden }, (d) => {
        d.instellingen.verrijkingsschema = { ...schemaVan(d), overgeslagen: { op: nu.toISOString(), reden: `Geplande ronde niet gestart: ${reden}. Pas het budget of de omvang aan, of start handmatig.`, gepland: gepland.toISOString() }, laatsteGeplandeRonde: gepland.toISOString() };
      });
      return NextResponse.json({ ok: true, gestart: false, reden, schatting, volgendeRonde: volgendeGeplandeRonde(schemaVan(db), nu)?.toISOString() ?? null });
    }
    await muteer(SYSTEEM, { entiteit: "verrijking", entiteitId: "schema", actie: "geplande ronde ingepland", details: `${selectie.length} partners, verwacht ${schatting.bewerkingen} bewerkingen` }, (d) => {
      d.instellingen.verrijkingsschema = { ...schemaVan(d), laatsteGeplandeRonde: gepland.toISOString(), overgeslagen: undefined };
    });
    // Een eventuele handmatige, nog lopende ronde wordt eerst afgesloten zodat de geplande ronde een eigen verschillenoverzicht krijgt.
    const handmatig = db.verrijkingsrondes.find((r) => !r.klaarOp);
    if (handmatig) handmatig.klaarOp = nu.toISOString();
    const eerste = await startVerrijking(undefined, undefined, 20, SYSTEEM_SLEUTEL, { selectie: selectie.map((p) => p.id), omvang: schema.omvang, alleenGewijzigd: schema.omvang === "gewijzigde_website", gepland: true, verwachteBewerkingen: schatting.bewerkingen });
    if (!eerste.ok) return NextResponse.json({ ok: false, fout: eerste.fout }, { status: 429 });
    return doorlopen(eerste.data!.partners, eerste.data!.nieuw, eerste.data!.nogTeGaan, Date.now());
  }
  return doorlopen(0, 0, 1, Date.now());
}

/** Hervatbaar: batches tot de ronde klaar is of het tijdsbudget van de functie bijna om is. */
async function doorlopen(partners: number, nieuw: number, nogTeGaan: number, begonnen: number) {
  while (nogTeGaan > 0 && Date.now() - begonnen < 240_000) {
    const r = await startVerrijking(undefined, undefined, 20, SYSTEEM_SLEUTEL);
    if (!r.ok) return NextResponse.json({ ok: false, fout: r.fout, partners, nieuwInWachtrij: nieuw }, { status: 429 });
    partners += r.data!.partners;
    nieuw += r.data!.nieuw;
    nogTeGaan = r.data!.nogTeGaan;
  }
  const db = await getDb();
  return NextResponse.json({ ok: true, gestart: true, partners, nieuwInWachtrij: nieuw, nogTeGaan, volgendeRonde: volgendeGeplandeRonde(schemaVan(db))?.toISOString() ?? null });
}

export const GET = verwerk;
export const POST = verwerk;
