// US-58 (art. 8): AI-verbruik in bewerkingen. Eén bewerking = één handeling die tot verwerking door een extern taalmodel
// leidt, inclusief alle onderliggende aanroepen. Budget in bewerkingen (standaard 750 per maand) en een tokenbudget in euro
// (standaard € 30) tegen rekenprijzen per miljoen tokens (standaard € 2,50 in / € 10,00 uit).
import type { AIBewerking, AIBudget, AIFunctie, Database, Partner, VerrijkingsRonde } from "./types";

export const STANDAARD_BUDGET: AIBudget = { bewerkingenPerMaand: 750, tokenbudgetEur: 30, prijsInvoerPerMTok: 2.5, prijsUitvoerPerMTok: 10 };

/** US-59: lichtste passende model per functie. Extractie en aandragen zijn samenvat-/extractiewerk; chat, match en verband vragen meer redeneervermogen. */
export const STANDAARD_MODELLEN: Record<AIFunctie, string> = {
  extractie: "claude-haiku-4-5",
  aandragen: "claude-haiku-4-5",
  chat: "claude-sonnet-5",
  match: "claude-sonnet-5",
  verband: "claude-sonnet-5"
};

export const BESCHIKBARE_MODELLEN = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (licht, snel)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (midden)" },
  { id: "claude-opus-5", label: "Claude Opus 5 (zwaar)" }
];

export const FUNCTIE_LABEL: Record<AIFunctie, string> = {
  extractie: "Extractie en verrijking",
  chat: "Chat over het bestand",
  match: "Match-onderbouwing",
  verband: "Verbandanalyse",
  aandragen: "Aandragen van partners"
};

export function aiBudget(db: Pick<Database, "instellingen">): AIBudget {
  return { ...STANDAARD_BUDGET, ...(db.instellingen.aiBudget ?? {}) };
}

export function modelVoor(db: Pick<Database, "instellingen">, functie: AIFunctie) {
  return db.instellingen.modellen?.[functie] ?? STANDAARD_MODELLEN[functie];
}

export function kostenEur(invoerTokens: number, uitvoerTokens: number, budget: Pick<AIBudget, "prijsInvoerPerMTok" | "prijsUitvoerPerMTok"> = STANDAARD_BUDGET) {
  return (invoerTokens * budget.prijsInvoerPerMTok + uitvoerTokens * budget.prijsUitvoerPerMTok) / 1_000_000;
}

// ---------- Categorieën voor de rapportage ----------
export type VerbruikCategorie = "verrijking" | "chat" | "match/verband" | "AI-voorstellen" | "overig";
export const CATEGORIEEN: VerbruikCategorie[] = ["verrijking", "chat", "match/verband", "AI-voorstellen", "overig"];

export function categorieVan(soort: AIBewerking["soort"]): VerbruikCategorie {
  if (soort === "verrijking" || soort === "verrijkingsronde") return "verrijking";
  if (soort === "chat") return "chat";
  if (soort === "match" || soort === "verband") return "match/verband";
  if (soort === "aandraag" || soort === "partnerregistratie" || soort === "discovery") return "AI-voorstellen";
  return "overig";
}

export const maandVan = (iso: string) => iso.slice(0, 7);
export function kwartaalVan(iso: string) {
  return `${iso.slice(0, 4)}-K${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
}

/** Kosten van een bewerking; oude bewerkingen (vóór v3.1, in USD) worden herrekend uit de tokens. */
export function bewerkingKosten(b: AIBewerking, budget: AIBudget = STANDAARD_BUDGET) {
  return typeof b.kostenEur === "number" ? b.kostenEur : kostenEur(b.invoerTokens, b.uitvoerTokens, budget);
}

export type Verbruik = { periode: string; bewerkingen: number; aanroepen: number; invoerTokens: number; uitvoerTokens: number; kostenEur: number; perCategorie: Record<VerbruikCategorie, number> };

function leegVerbruik(periode: string): Verbruik {
  return { periode, bewerkingen: 0, aanroepen: 0, invoerTokens: 0, uitvoerTokens: 0, kostenEur: 0, perCategorie: { verrijking: 0, chat: 0, "match/verband": 0, "AI-voorstellen": 0, overig: 0 } };
}

function tel(v: Verbruik, b: AIBewerking, budget: AIBudget) {
  v.bewerkingen++;
  v.aanroepen += b.aanroepen.length;
  v.invoerTokens += b.invoerTokens;
  v.uitvoerTokens += b.uitvoerTokens;
  v.kostenEur += bewerkingKosten(b, budget);
  v.perCategorie[categorieVan(b.soort)]++;
}

/** Verbruik in een kalendermaand (standaard: de lopende). */
export function maandVerbruik(bewerkingen: AIBewerking[], nu = new Date(), budget: AIBudget = STANDAARD_BUDGET): Verbruik {
  const maand = maandVan(nu.toISOString());
  const v = leegVerbruik(maand);
  bewerkingen.filter((b) => maandVan(b.op) === maand).forEach((b) => tel(v, b, budget));
  return v;
}

/** US-58: verbruik per maand of per kwartaal, nieuwste eerst. */
export function verbruikPerPeriode(bewerkingen: AIBewerking[], soort: "maand" | "kwartaal", budget: AIBudget = STANDAARD_BUDGET): Verbruik[] {
  const map = new Map<string, Verbruik>();
  bewerkingen.forEach((b) => {
    const k = soort === "maand" ? maandVan(b.op) : kwartaalVan(b.op);
    const v = map.get(k) ?? leegVerbruik(k);
    tel(v, b, budget);
    map.set(k, v);
  });
  return Array.from(map.values()).sort((a, b) => b.periode.localeCompare(a.periode));
}

export type BudgetStatus = {
  bewerkingen: number;
  budgetBewerkingen: number;
  pct: number;
  kostenEur: number;
  tokenbudgetEur: number;
  pctEur: number;
  /** ≥ 80% van het maandbudget (bewerkingen of euro). */
  waarschuwing: boolean;
  /** ≥ 100%: geplande rondes starten niet meer; interactieve functies gaan voor. */
  overschreden: boolean;
  /** > 125% in deze maand (art. 8: signaal voor nacalculatie). */
  boven125: boolean;
  /** Gemiddeld verbruik over het lopende kwartaal (tot en met deze maand) in % van het maandbudget. */
  kwartaalGemPct: number;
  /** Gemiddeld > 110% over het kwartaal. */
  kwartaalBoven110: boolean;
};

export function budgetStatus(db: Pick<Database, "aiBewerkingen" | "instellingen">, nu = new Date()): BudgetStatus {
  const budget = aiBudget(db);
  const v = maandVerbruik(db.aiBewerkingen ?? [], nu, budget);
  const pct = budget.bewerkingenPerMaand > 0 ? (v.bewerkingen / budget.bewerkingenPerMaand) * 100 : 0;
  const pctEur = budget.tokenbudgetEur > 0 ? (v.kostenEur / budget.tokenbudgetEur) * 100 : 0;
  // Kwartaal: gemiddelde van de verstreken maanden in het lopende kwartaal.
  const kw = kwartaalVan(nu.toISOString());
  const maanden = Array.from(new Set((db.aiBewerkingen ?? []).filter((b) => kwartaalVan(b.op) === kw).map((b) => maandVan(b.op))));
  const verstreken = ((nu.getUTCMonth() % 3) + 1);
  const inKwartaal = (db.aiBewerkingen ?? []).filter((b) => kwartaalVan(b.op) === kw).length;
  const kwartaalGemPct = budget.bewerkingenPerMaand > 0 && maanden.length ? (inKwartaal / verstreken / budget.bewerkingenPerMaand) * 100 : 0;
  const hoogste = Math.max(pct, pctEur);
  return {
    bewerkingen: v.bewerkingen,
    budgetBewerkingen: budget.bewerkingenPerMaand,
    pct,
    kostenEur: v.kostenEur,
    tokenbudgetEur: budget.tokenbudgetEur,
    pctEur,
    waarschuwing: hoogste >= 80,
    overschreden: hoogste >= 100,
    boven125: pct > 125,
    kwartaalGemPct,
    kwartaalBoven110: kwartaalGemPct > 110
  };
}

// ---------- US-57: verwachte AI-bewerkingen vóór een ronde ----------
/** Aandeel partners dat in eerdere rondes ongewijzigd werd overgeslagen (delta via webHash); standaard 50%. */
export function ongewijzigdAandeel(rondes: VerrijkingsRonde[]) {
  const verwerkt = rondes.reduce((s, r) => s + r.partnerIdsVerwerkt.length, 0);
  const ongewijzigd = rondes.reduce((s, r) => s + r.ongewijzigd, 0);
  return verwerkt >= 10 ? ongewijzigd / verwerkt : 0.5;
}

export type RondeSchatting = {
  partners: number;
  /** Verwacht aantal partners dat echt verrijkt wordt = verwachte AI-bewerkingen. */
  bewerkingen: number;
  overgeslagen: number;
  geschatteKostenEur: number;
  perBewerkingEur: number;
  aiActief: boolean;
  verbruiktDezeMaand: number;
  budgetBewerkingen: number;
  resterendNa: number;
  pctNa: number;
  overschrijdtBudget: boolean;
};

/**
 * Het aantal partners dat na het overslaan van ongewijzigde websites echt verrijkt wordt is het aantal bewerkingen.
 * Nog nooit verrijkte partners (geen webHash) tellen volledig; de rest naar rato van eerdere rondes. Zonder AI-sleutel
 * draait de verrijking op regels en kost ze geen bewerkingen.
 */
export function schatVerrijkingsronde(partners: Pick<Partner, "webHash" | "website">[], db: Pick<Database, "aiBewerkingen" | "instellingen" | "verrijkingsrondes">, aiActief: boolean, opties: { alleenGewijzigd?: boolean; nu?: Date } = {}): RondeSchatting {
  const budget = aiBudget(db);
  const ratio = ongewijzigdAandeel(db.verrijkingsrondes ?? []);
  const nooit = partners.filter((p) => !p.webHash).length;
  const eerder = partners.length - nooit;
  const verwacht = aiActief ? Math.round((opties.alleenGewijzigd ? 0 : nooit) + eerder * (1 - ratio) + (opties.alleenGewijzigd ? nooit : 0)) : 0;
  const perBewerkingEur = kostenEur(7000, 800, budget);
  const status = budgetStatus(db, opties.nu);
  const resterendNa = budget.bewerkingenPerMaand - status.bewerkingen - verwacht;
  return {
    partners: partners.length,
    bewerkingen: verwacht,
    overgeslagen: partners.length - verwacht,
    geschatteKostenEur: verwacht * perBewerkingEur,
    perBewerkingEur,
    aiActief,
    verbruiktDezeMaand: status.bewerkingen,
    budgetBewerkingen: budget.bewerkingenPerMaand,
    resterendNa,
    pctNa: budget.bewerkingenPerMaand > 0 ? ((status.bewerkingen + verwacht) / budget.bewerkingenPerMaand) * 100 : 0,
    overschrijdtBudget: budget.bewerkingenPerMaand > 0 && resterendNa < 0
  };
}

// ---------- US-58: exporteerbare specificatie (basis voor een eventuele nacalculatie) ----------
export function verbruikSpecificatie(db: Pick<Database, "aiBewerkingen" | "instellingen">) {
  const budget = aiBudget(db);
  const bewerkingen = [...(db.aiBewerkingen ?? [])].sort((a, b) => a.op.localeCompare(b.op));
  const regels = bewerkingen.map((b) => ({
    Datum: b.op.slice(0, 19).replace("T", " "),
    Maand: maandVan(b.op),
    Kwartaal: kwartaalVan(b.op),
    Categorie: categorieVan(b.soort),
    Soort: b.soort,
    Functie: b.functie ?? "",
    Omschrijving: b.omschrijving ?? "",
    Door: b.door,
    Modelaanroepen: b.aanroepen.length,
    Modellen: Array.from(new Set(b.aanroepen.map((a) => a.model))).join(", "),
    "Invoertokens": b.invoerTokens,
    "Uitvoertokens": b.uitvoerTokens,
    "Providerkosten (EUR)": Math.round(bewerkingKosten(b, budget) * 10000) / 10000
  }));
  const periode = (soort: "maand" | "kwartaal") =>
    verbruikPerPeriode(bewerkingen, soort, budget).map((v) => ({
      [soort === "maand" ? "Maand" : "Kwartaal"]: v.periode,
      Bewerkingen: v.bewerkingen,
      "Budget (bewerkingen)": soort === "maand" ? budget.bewerkingenPerMaand : budget.bewerkingenPerMaand * 3,
      "% van budget": Math.round((v.bewerkingen / Math.max(1, soort === "maand" ? budget.bewerkingenPerMaand : budget.bewerkingenPerMaand * 3)) * 100),
      Verrijking: v.perCategorie.verrijking,
      Chat: v.perCategorie.chat,
      "Match/verband": v.perCategorie["match/verband"],
      "AI-voorstellen": v.perCategorie["AI-voorstellen"],
      Overig: v.perCategorie.overig,
      Invoertokens: v.invoerTokens,
      Uitvoertokens: v.uitvoerTokens,
      "Providerkosten (EUR)": Math.round(v.kostenEur * 100) / 100
    }));
  return { regels, perMaand: periode("maand"), perKwartaal: periode("kwartaal"), rekenprijzen: [{ "Input per miljoen tokens (EUR)": budget.prijsInvoerPerMTok, "Output per miljoen tokens (EUR)": budget.prijsUitvoerPerMTok, "Budget bewerkingen/maand": budget.bewerkingenPerMaand, "Tokenbudget/maand (EUR)": budget.tokenbudgetEur }] };
}
