// US-56: instelbaar verrijkingsschema. De cron (vercel.json) roept dagelijks /api/verrijking/run aan; dit schema bepaalt of er
// een ronde moet draaien. Tijden zijn Nederlandse tijd (Europe/Amsterdam), ook als de server in UTC draait.
import { zichtbaar } from "./zichtbaarheid";
import type { Database, Partner, VerrijkingsSchema } from "./types";

export const FREQUENTIE_LABEL: Record<VerrijkingsSchema["frequentie"], string> = {
  uit: "Uit",
  wekelijks: "Wekelijks",
  tweewekelijks: "Tweewekelijks",
  maandelijks: "Maandelijks",
  kwartaal: "Per kwartaal"
};

export const OMVANG_LABEL: Record<VerrijkingsSchema["omvang"], string> = {
  alles: "Hele bestand",
  partnertype: "Per partnertype",
  niet_verrijkt_sinds: "Alleen partners die langer dan X maanden niet verrijkt zijn",
  gewijzigde_website: "Alleen partners met een gewijzigde website"
};

export const WEEKDAGEN = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

export function standaardSchema(nu = new Date()): VerrijkingsSchema {
  return { frequentie: "uit", dag: 1, tijd: "06:00", omvang: "gewijzigde_website", rollen: [], maanden: 6, ingesteldOp: nu.toISOString() };
}

export function schemaVan(db: Pick<Database, "instellingen">): VerrijkingsSchema {
  return { ...standaardSchema(), ...(db.instellingen.verrijkingsschema ?? {}) };
}

/** Verschil (ms) tussen Amsterdamse wandkloktijd en UTC op een moment. */
function amsterdamOffset(moment: Date) {
  const delen = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(moment);
  const d = Object.fromEntries(delen.map((x) => [x.type, x.value]));
  return Date.UTC(Number(d.year), Number(d.month) - 1, Number(d.day), Number(d.hour), Number(d.minute), Number(d.second)) - moment.getTime();
}

/** UTC-moment van een Amsterdamse datum + tijd. */
export function amsterdam(jaar: number, maand0: number, dag: number, tijd: string) {
  const [u, m] = tijd.split(":").map(Number);
  const gok = new Date(Date.UTC(jaar, maand0, dag, u || 0, m || 0));
  return new Date(gok.getTime() - amsterdamOffset(gok));
}

/** Amsterdamse kalenderdatum van een moment. */
function amsterdamDatum(moment: Date) {
  const lokaal = new Date(moment.getTime() + amsterdamOffset(moment));
  return { jaar: lokaal.getUTCFullYear(), maand0: lokaal.getUTCMonth(), dag: lokaal.getUTCDate(), weekdag: ((lokaal.getUTCDay() + 6) % 7) + 1 };
}

/** Eerstvolgende geplande moment strikt ná `na`. Tweewekelijks telt vanaf de vorige geplande ronde. */
export function volgendeRonde(schema: VerrijkingsSchema, na: Date): Date | null {
  if (schema.frequentie === "uit") return null;
  const start = amsterdamDatum(na);
  const dagMaand = Math.min(28, Math.max(1, schema.dag || 1));
  for (let i = 0; i < 800; i++) {
    const kandidaat = amsterdam(start.jaar, start.maand0, start.dag + i, schema.tijd);
    if (kandidaat.getTime() <= na.getTime()) continue;
    const d = amsterdamDatum(kandidaat);
    if (schema.frequentie === "wekelijks" || schema.frequentie === "tweewekelijks") {
      if (d.weekdag !== Math.min(7, Math.max(1, schema.dag || 1))) continue;
      if (schema.frequentie === "tweewekelijks" && schema.laatsteGeplandeRonde && kandidaat.getTime() - new Date(schema.laatsteGeplandeRonde).getTime() < 13 * 86_400_000) continue;
      return kandidaat;
    }
    if (d.dag !== dagMaand) continue;
    if (schema.frequentie === "kwartaal" && d.maand0 % 3 !== 0) continue;
    return kandidaat;
  }
  return null;
}

/** Het geplande moment dat nu aan de beurt is (verstreken en nog niet gedraaid), of null. */
export function teDraaienRonde(schema: VerrijkingsSchema, nu = new Date()): Date | null {
  if (schema.frequentie === "uit") return null;
  const anker = new Date(schema.laatsteGeplandeRonde ?? schema.ingesteldOp);
  const volgende = volgendeRonde(schema, anker);
  return volgende && volgende.getTime() <= nu.getTime() ? volgende : null;
}

/** De volgende ronde voor weergave: een verstreken, nog niet gedraaid moment, of het eerstvolgende. */
export function volgendeGeplandeRonde(schema: VerrijkingsSchema, nu = new Date()) {
  return teDraaienRonde(schema, nu) ?? volgendeRonde(schema, new Date(Math.max(nu.getTime(), new Date(schema.laatsteGeplandeRonde ?? schema.ingesteldOp).getTime())));
}

/** Partners die in een ronde vallen volgens de omvang van het schema (geblokkeerde, gearchiveerde en concepten nooit). */
export function selecteerPartners(db: Pick<Database, "partners">, schema: Pick<VerrijkingsSchema, "omvang" | "rollen" | "maanden">, nu = new Date()): Partner[] {
  const basis = db.partners.filter((p) => zichtbaar(p) && p.status !== "geblokkeerd");
  switch (schema.omvang) {
    case "partnertype":
      return schema.rollen.length ? basis.filter((p) => p.rollen.some((r) => schema.rollen.includes(r))) : basis;
    case "niet_verrijkt_sinds": {
      const grens = new Date(nu);
      grens.setMonth(grens.getMonth() - Math.max(1, schema.maanden || 1));
      return basis.filter((p) => !p.laatstVerrijktOp || new Date(p.laatstVerrijktOp) < grens);
    }
    case "gewijzigde_website":
      return basis.filter((p) => p.website);
    default:
      return basis;
  }
}
