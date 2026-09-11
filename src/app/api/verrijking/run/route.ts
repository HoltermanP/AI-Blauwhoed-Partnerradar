// US-31: periodieke verrijkingsronde via cron. POST met header x-cron-secret (CRON_SECRET).
// Draait dezelfde logica als de knop (startVerrijking) in hervatbare batches van 20, als gebruiker "systeem".
// Eis 2: boven het AI-maandbudget start de geplande ronde niet (interactieve functies houden voorrang).
import { NextResponse } from "next/server";
import { startVerrijking } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") !== secret) return NextResponse.json({ ok: false, fout: "Ongeldig cron-secret." }, { status: 401 });

  const begonnen = Date.now();
  let partners = 0;
  let nieuw = 0;
  let nogTeGaan = 0;
  // Hervatbaar: batches tot het hele bestand op is of het tijdsbudget van de functie bijna om is.
  do {
    const r = await startVerrijking(undefined, undefined, 20, "systeem");
    if (!r.ok) return NextResponse.json({ ok: false, fout: r.fout, partners, nieuwInWachtrij: nieuw }, { status: 429 });
    partners += r.data!.partners;
    nieuw += r.data!.nieuw;
    nogTeGaan = r.data!.nogTeGaan;
  } while (nogTeGaan > 0 && Date.now() - begonnen < 240_000);
  return NextResponse.json({ ok: true, partners, nieuwInWachtrij: nieuw, nogTeGaan });
}
