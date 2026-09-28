// US-63: tevredenheid per project. De totale score is standaard het gemiddelde van de vijf deelscores en kan handmatig
// worden bijgesteld met een verplichte toelichting. Scores zijn oordelen van Blauwhoed over de eigen samenwerking, op
// organisatieniveau (nooit per contactpersoon).
import type { Evaluatie } from "./types";

export const TEVREDENHEID_UITLEG = "Scores zijn oordelen van Blauwhoed over de eigen samenwerking met deze organisatie (op organisatieniveau, niet over personen).";

export function afgeleideTotaalscore(ev: Pick<Evaluatie, "kwaliteit" | "planning" | "budget" | "samenwerking" | "duurzaamheid">) {
  return Math.round(((ev.kwaliteit + ev.planning + ev.budget + ev.samenwerking + ev.duurzaamheid) / 5) * 10) / 10;
}

export function totaalscore(ev: Evaluatie) {
  return typeof ev.totaalscore === "number" ? ev.totaalscore : afgeleideTotaalscore(ev);
}

export function isBijgesteld(ev: Evaluatie) {
  return typeof ev.totaalscore === "number" && Math.abs(ev.totaalscore - afgeleideTotaalscore(ev)) > 0.049;
}

/** Controle bij opslaan: een handmatig bijgestelde totaalscore vraagt om een toelichting. */
export function controleerTotaal(ev: Pick<Evaluatie, "kwaliteit" | "planning" | "budget" | "samenwerking" | "duurzaamheid" | "totaalscore" | "totaalToelichting">): string | null {
  if (ev.totaalscore === undefined) return null;
  if (!(ev.totaalscore >= 1 && ev.totaalscore <= 5)) return "De totale tevredenheidsscore ligt tussen 1 en 5.";
  if (Math.abs(ev.totaalscore - afgeleideTotaalscore(ev)) > 0.049 && !ev.totaalToelichting?.trim()) return "Licht toe waarom de totale score afwijkt van het gemiddelde van de deelscores.";
  return null;
}

/** US-63: doorzoekbaarheid van de projecthistorie op projectnummer, projectnaam, rol, periode en toelichting. */
export function historieTreft(q: string, velden: Array<string | undefined>) {
  const woorden = q.toLowerCase().split(/\s+/).filter(Boolean);
  const tekst = velden.filter(Boolean).join(" ").toLowerCase();
  return woorden.every((w) => tekst.includes(w));
}
