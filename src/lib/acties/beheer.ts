"use server";
// Beheerinstellingen uit de aanvullende overeenkomst: AI-budget (US-58), model per functie (US-59), verrijkingsschema (US-56)
// en keurmerkregisters (US-62). Alleen de beheerder; elke wijziging in de auditlog.
import { revalidatePath } from "next/cache";
import { vereisRecht } from "../auth";
import { BESCHIKBARE_MODELLEN, STANDAARD_MODELLEN } from "../domain/kosten";
import { schemaVan, volgendeGeplandeRonde } from "../domain/schema";
import { ROLLEN, type AIBudget, type AIFunctie, type CertificaatType, type VerrijkingsSchema } from "../domain/types";
import { muteer, nieuwId } from "../store";

type Resultaat<T = undefined> = { ok: true; data?: T } | { ok: false; fout: string };

async function veilig<T>(fn: () => Promise<T>, paden: string[]): Promise<Resultaat<T>> {
  try {
    const data = await fn();
    paden.forEach((p) => revalidatePath(p));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

export async function slaAIBudgetOp(b: AIBudget) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    const getal = (x: number, naam: string) => {
      if (!Number.isFinite(x) || x < 0) throw new Error(`${naam} moet een getal van 0 of hoger zijn.`);
      return x;
    };
    const budget: AIBudget = {
      bewerkingenPerMaand: Math.round(getal(Number(b.bewerkingenPerMaand), "Het budget in bewerkingen")),
      tokenbudgetEur: getal(Number(b.tokenbudgetEur), "Het tokenbudget"),
      prijsInvoerPerMTok: getal(Number(b.prijsInvoerPerMTok), "De inputprijs"),
      prijsUitvoerPerMTok: getal(Number(b.prijsUitvoerPerMTok), "De outputprijs")
    };
    await muteer(g, { entiteit: "instellingen", entiteitId: "aiBudget", actie: "AI-budget gewijzigd", details: `${budget.bewerkingenPerMaand} bewerkingen, € ${budget.tokenbudgetEur} tokenbudget, € ${budget.prijsInvoerPerMTok}/€ ${budget.prijsUitvoerPerMTok} per miljoen tokens` }, (db) => {
      db.instellingen.aiBudget = budget;
    });
  }, ["/beheer", "/beheer/verbruik", "/verrijking", "/"]);
}

export async function slaModellenOp(modellen: Record<AIFunctie, string>) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    const toegestaan = new Set(BESCHIKBARE_MODELLEN.map((m) => m.id));
    const schoon = Object.fromEntries((Object.keys(STANDAARD_MODELLEN) as AIFunctie[]).map((f) => [f, toegestaan.has(modellen[f]) ? modellen[f] : STANDAARD_MODELLEN[f]])) as Record<AIFunctie, string>;
    await muteer(g, { entiteit: "instellingen", entiteitId: "modellen", actie: "model per functie gewijzigd", details: Object.entries(schoon).map(([f, m]) => `${f}: ${m}`).join(", ") }, (db) => {
      db.instellingen.modellen = schoon;
    });
  }, ["/beheer/verbruik"]);
}

export async function slaVerrijkingsschemaOp(invoer: Pick<VerrijkingsSchema, "frequentie" | "dag" | "tijd" | "omvang" | "rollen" | "maanden">) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    if (!["uit", "wekelijks", "tweewekelijks", "maandelijks", "kwartaal"].includes(invoer.frequentie)) throw new Error("Onbekende frequentie.");
    if (!["alles", "partnertype", "niet_verrijkt_sinds", "gewijzigde_website"].includes(invoer.omvang)) throw new Error("Onbekende omvang.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(invoer.tijd)) throw new Error("Tijd als UU:MM, bijvoorbeeld 06:00.");
    const wekelijks = invoer.frequentie === "wekelijks" || invoer.frequentie === "tweewekelijks";
    const dag = Math.round(Number(invoer.dag));
    if (wekelijks ? dag < 1 || dag > 7 : dag < 1 || dag > 28) throw new Error(wekelijks ? "Kies een weekdag." : "Kies een dag van de maand tussen 1 en 28.");
    if (invoer.omvang === "partnertype" && !invoer.rollen.length) throw new Error("Kies minstens één partnertype.");
    const rollen = invoer.rollen.filter((r) => ROLLEN.includes(r));
    const volgende = await muteer(g, { entiteit: "instellingen", entiteitId: "verrijkingsschema", actie: "verrijkingsschema gewijzigd", details: `${invoer.frequentie}, dag ${dag}, ${invoer.tijd}, omvang ${invoer.omvang}` }, (db) => {
      const oud = schemaVan(db);
      db.instellingen.verrijkingsschema = { ...oud, frequentie: invoer.frequentie, dag, tijd: invoer.tijd, omvang: invoer.omvang, rollen, maanden: Math.max(1, Math.round(Number(invoer.maanden) || 6)), ingesteldOp: new Date().toISOString(), ingesteldDoor: g.naam, laatsteGeplandeRonde: undefined, overgeslagen: undefined };
      return volgendeGeplandeRonde(db.instellingen.verrijkingsschema)?.toISOString() ?? null;
    });
    return volgende;
  }, ["/verrijking", "/beheer"]);
}

export async function slaRegisterbronOp(bron: { id?: string; naam: string; url: string; certificaat: CertificaatType; actief: boolean } | { verwijderId: string }) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "instellingen", entiteitId: "registerbronnen", actie: "verwijderId" in bron ? "register verwijderd" : "register opgeslagen", details: "verwijderId" in bron ? bron.verwijderId : `${bron.naam} (${bron.certificaat})` }, (db) => {
      db.instellingen.registerbronnen = db.instellingen.registerbronnen ?? [];
      if ("verwijderId" in bron) {
        db.instellingen.registerbronnen = db.instellingen.registerbronnen.filter((b) => b.id !== bron.verwijderId);
        return;
      }
      if (!bron.naam.trim()) throw new Error("Geef het register een naam.");
      if (!/^https:\/\//.test(bron.url)) throw new Error("Het zoekpatroon moet een openbare https-URL zijn (gebruik {naam} of {kvk}).");
      const idx = db.instellingen.registerbronnen.findIndex((b) => b.id === bron.id);
      const record = { id: bron.id ?? nieuwId("reg"), naam: bron.naam.trim(), url: bron.url.trim(), certificaat: bron.certificaat, actief: bron.actief };
      if (idx >= 0) db.instellingen.registerbronnen[idx] = record;
      else db.instellingen.registerbronnen.push(record);
    });
  }, ["/verrijking"]);
}
