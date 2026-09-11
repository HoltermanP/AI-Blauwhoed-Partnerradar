import type { FactorWaarde, PartnerStatus, Rol } from "./domain/types";

export const euro = (n: number | undefined | null) => (n === undefined || n === null ? "–" : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
export const getal = (n: number | undefined | null, decimalen = 0) => (n === undefined || n === null ? "–" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: decimalen }).format(n));
export const datum = (d: string | undefined | null) => (d ? new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" }) : "–");
export const datumTijd = (d: string | undefined | null) => (d ? new Date(d).toLocaleString("nl-NL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");

export const ROL_LABEL: Record<Rol, string> = {
  architect: "Architect",
  aannemer: "Aannemer",
  installateur: "Installateur",
  adviseur: "Adviseur",
  leverancier: "Leverancier",
  ontwikkelpartner: "Ontwikkelpartner"
};

export const STATUS_LABEL: Record<PartnerStatus, string> = {
  bekend: "Bekend",
  prospect: "Prospect",
  afgewezen: "Afgewezen",
  preferred: "Preferred",
  geblokkeerd: "Geblokkeerd",
  gearchiveerd: "Gearchiveerd"
};

export function waardeTekst(w: FactorWaarde | null | undefined): string {
  if (w === null || w === undefined) return "–";
  if (typeof w === "boolean") return w ? "Ja" : "Nee";
  if (Array.isArray(w)) return w.join(", ");
  if (typeof w === "object") return `${w.min}–${w.max}`;
  return String(w);
}

export const hoofdletter = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
