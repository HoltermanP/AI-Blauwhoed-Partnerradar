// Dwarsdoorsnijdende eis 2: kosten per AI-bewerking. Prijzen per model (USD per miljoen tokens, Anthropic-tarieven).
import type { AIBewerking, Database } from "./types";

export const MODELPRIJZEN: Record<string, { invoerPerMTok: number; uitvoerPerMTok: number }> = {
  "claude-opus-5": { invoerPerMTok: 5, uitvoerPerMTok: 25 },
  "claude-sonnet-5": { invoerPerMTok: 2, uitvoerPerMTok: 10 },
  "claude-haiku-4-5": { invoerPerMTok: 1, uitvoerPerMTok: 5 }
};

export function kostenUsd(model: string, invoerTokens: number, uitvoerTokens: number) {
  const p = MODELPRIJZEN[model] ?? MODELPRIJZEN["claude-opus-5"];
  return (invoerTokens * p.invoerPerMTok + uitvoerTokens * p.uitvoerPerMTok) / 1_000_000;
}

/** Verbruik in een kalendermaand (standaard: de lopende). */
export function maandVerbruik(bewerkingen: AIBewerking[], nu = new Date()) {
  const maand = nu.toISOString().slice(0, 7);
  const vanDezeMaand = bewerkingen.filter((b) => b.op.slice(0, 7) === maand);
  return {
    maand,
    bewerkingen: vanDezeMaand.length,
    aanroepen: vanDezeMaand.reduce((s, b) => s + b.aanroepen.length, 0),
    invoerTokens: vanDezeMaand.reduce((s, b) => s + b.invoerTokens, 0),
    uitvoerTokens: vanDezeMaand.reduce((s, b) => s + b.uitvoerTokens, 0),
    kostenUsd: vanDezeMaand.reduce((s, b) => s + b.kostenUsd, 0)
  };
}

export type BudgetStatus = { verbruikUsd: number; budgetUsd: number; pct: number; waarschuwing: boolean; overschreden: boolean };

export function budgetStatus(db: Database, nu = new Date()): BudgetStatus {
  const verbruik = maandVerbruik(db.aiBewerkingen ?? [], nu).kostenUsd;
  const budget = db.instellingen.aiBudgetUsdPerMaand ?? 0;
  const pct = budget > 0 ? (verbruik / budget) * 100 : 0;
  return { verbruikUsd: verbruik, budgetUsd: budget, pct, waarschuwing: budget > 0 && pct >= 80, overschreden: budget > 0 && pct >= 100 };
}

/** Schatting vooraf voor een verrijkingsronde (eis 2): één bewerking per partner, ~1 aanroep met ~7k invoer- en ~800 uitvoertokens. */
export function schatVerrijkingsronde(aantalPartners: number, model = "claude-opus-5") {
  const perPartner = kostenUsd(model, 7000, 800);
  return { bewerkingen: aantalPartners, geschatteKostenUsd: aantalPartners * perPartner, perBewerkingUsd: perPartner };
}
