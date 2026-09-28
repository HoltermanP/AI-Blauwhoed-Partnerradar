"use server";
// US-55: AI draagt zelf ontbrekende partners aan op basis van een zoekprofiel. Alleen de beheerder start een aandraagronde;
// de uitkomsten zijn concepten (US-54) die hij daarna in de vrijgavewachtrij beoordeelt. Eén ronde = één AI-bewerking (US-58).
import { revalidatePath } from "next/cache";
import { aiBeschikbaar, aiSamenvatting, aiZoekvragen, alsAIBewerking, zetAanroepDoel } from "../ai";
import { vereisRecht } from "../auth";
import { aanbiedersUitOverzicht, ontdubbel, regelOnderbouwing, regelZoekvragen, type AandraagKandidaat } from "../domain/aandragen";
import { kandidaatNaarConcept } from "../domain/discovery";
import { striptHtml } from "../domain/enrichment";
import { geocodeer } from "../domain/geocode";
import { kvkConnector } from "../domain/kvk";
import { semantischeGelijkenis } from "../domain/embedding";
import { ROLLEN, type Rol } from "../domain/types";
import { zoekMetVragen } from "../domain/webzoek";
import { getDb, muteer, nieuwId } from "../store";

export type AandraagUitkomst = { zoekvragen: string[]; bronnen: string[]; gevonden: number; ontdubbeld: Array<{ naam: string; reden: string }>; concepten: Array<{ id: string; naam: string }>; viaAI: boolean };

const MAX_CONCEPTEN = 8;

export async function draagPartnersAan(zoekprofielId: string) {
  try {
    const g = await vereisRecht("beheer");
    const db = await getDb();
    const profiel = db.zoekprofielen.find((z) => z.id === zoekprofielId);
    if (!profiel) throw new Error("Zoekprofiel niet gevonden.");
    if (!db.instellingen.externeBronnenToegestaan) throw new Error("Externe bronnen staan uit (Beheer); aandragen raadpleegt openbare bronnen.");
    const eigen = (db.instellingen.verrijkingsbronnen ?? []).filter((b) => b.actief && b.categorie === "eigen_uitgave");
    const bronnen = [...eigen.map((b) => `${b.naam} (eigen uitgave Blauwhoed)`), "open web en vakmedia (zoekmachine)", ...(process.env.KVK_API_KEY ? ["KVK-handelsregister"] : [])];
    const nu = new Date();

    const uitkomst = await alsAIBewerking(
      "aandraag",
      g.naam,
      `AI-aandraag zoekprofiel ${profiel.naam}`,
      async () => {
        // 1. Gerichte zoekvragen (AI of regels).
        zetAanroepDoel("zoekvragen opstellen");
        const aiVragen = aiBeschikbaar() ? await aiZoekvragen(profiel, bronnen) : null;
        const vragen: Array<{ vraag: string; rol: Rol }> = aiVragen?.length ? aiVragen.map((v, i) => ({ vraag: v, rol: profiel.rollen[i % profiel.rollen.length] })) : regelZoekvragen(profiel);
        const kandidaten: AandraagKandidaat[] = [];
        // 2a. Eigen uitgaven van Blauwhoed: aanbieders op de overzichtspagina die inhoudelijk bij het profiel passen.
        for (const b of eigen) {
          try {
            const res = await fetch(b.url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (aandragen)" } });
            if (!res.ok) continue;
            const aanbieders = aanbiedersUitOverzicht(await res.text(), b.url).slice(0, 60);
            const detail = await Promise.all(
              aanbieders.slice(0, 25).map(async (a) => {
                try {
                  const r = await fetch(a.url, { signal: AbortSignal.timeout(6000) });
                  return r.ok ? { ...a, tekst: striptHtml(await r.text()).slice(0, 6000) } : null;
                } catch {
                  return null;
                }
              })
            );
            detail
              .filter((d): d is { naam: string; url: string; tekst: string } => Boolean(d))
              .map((d) => ({ d, score: semantischeGelijkenis(profiel.trefwoorden, d.tekst).score }))
              .filter((x) => x.score > 0.05)
              .sort((x, y) => y.score - x.score)
              .slice(0, 6)
              .forEach(({ d }) => kandidaten.push({ naam: d.naam, rollen: profiel.rollen.slice(0, 1), bron: `${b.naam} (eigen uitgave Blauwhoed)`, bronUrl: d.url, ruweData: { profiel: d.tekst.slice(0, 600), referenties: [] }, zoekvraag: `aanbieders ${b.naam} passend bij '${profiel.trefwoorden}'` }));
          } catch {
            // bron onbereikbaar: andere bronnen leveren nog steeds
          }
        }
        // 2b. KVK (als de sleutel is gezet) en 2c. open web / vakmedia via de zoekvragen.
        if (process.env.KVK_API_KEY) {
          const kvk = await kvkConnector(process.env.KVK_API_KEY).zoek({ rollen: profiel.rollen, trefwoorden: profiel.trefwoorden.split(/\s+/), regio: profiel.regio });
          kvk.slice(0, 10).forEach((k) => kandidaten.push({ ...k, zoekvraag: `KVK: ${profiel.rollen.join(", ")} ${profiel.regio ?? ""}`.trim() }));
        }
        kandidaten.push(...(await zoekMetVragen(vragen, 4, 12)));
        // 3. Ontdubbelen tegen het bestaande bestand (KVK, naam, fuzzy naam, adres).
        const { nieuw, dubbel } = ontdubbel(kandidaten, db.partners);
        // 4. Onderbouwing per kandidaat (AI binnen dezelfde bewerking, anders regels).
        const gekozen = nieuw.slice(0, MAX_CONCEPTEN);
        const verrijkt = await Promise.all(
          gekozen.map(async (k) => {
            const tekst = String(k.ruweData.websiteTekst ?? k.ruweData.profiel ?? "");
            zetAanroepDoel(`onderbouwing ${k.naam}`);
            const ai = aiBeschikbaar() && tekst ? await aiSamenvatting({ ...k, id: "", status: "nieuw", opgehaaldOp: nu.toISOString() }, undefined, `Zoekprofiel: ${profiel.naam} — rollen ${profiel.rollen.join(", ")}, trefwoorden: ${profiel.trefwoorden}${profiel.regio ? `, regio ${profiel.regio}` : ""}.\n\n${tekst}`) : null;
            const locatie = k.locatie ?? (k.vestigingsplaats ? (await geocodeer(k.vestigingsplaats))?.locatie : undefined);
            return { ...k, locatie, samenvatting: ai ?? regelOnderbouwing(k, profiel) };
          })
        );
        return { vragen, verrijkt, dubbel, gevonden: kandidaten.length, viaAI: Boolean(aiVragen?.length) };
      },
      "aandragen"
    );

    const concepten = await muteer(g, { entiteit: "discovery", entiteitId: profiel.id, actie: "AI-aandraagronde", details: `${uitkomst.verrijkt.length} concept(en), ${uitkomst.dubbel.length} al in het bestand; zoekprofiel ${profiel.naam}` }, (db) =>
      uitkomst.verrijkt.map((k) => {
        const kandidaat = { ...k, id: nieuwId("aandraag"), status: "geaccepteerd" as const, opgehaaldOp: nu.toISOString() };
        const p = kandidaatNaarConcept(kandidaat, g.naam, nu, "ai-aandraag");
        p.id = nieuwId("p");
        p.registratie!.onderbouwing = { ...p.registratie!.onderbouwing!, zoekprofielId: profiel.id, zoekvraag: k.zoekvraag };
        if (!p.rollen.length) p.rollen = profiel.rollen.filter((r) => ROLLEN.includes(r)).slice(0, 1);
        db.partners.push(p);
        return { id: p.id, naam: p.naam };
      })
    );
    revalidatePath("/vrijgave");
    revalidatePath("/discovery");
    const resultaat: AandraagUitkomst = { zoekvragen: uitkomst.vragen.map((v) => v.vraag), bronnen, gevonden: uitkomst.gevonden, ontdubbeld: uitkomst.dubbel, concepten, viaAI: uitkomst.viaAI };
    return { ok: true as const, data: resultaat };
  } catch (e) {
    return { ok: false as const, fout: e instanceof Error ? e.message : String(e) };
  }
}
