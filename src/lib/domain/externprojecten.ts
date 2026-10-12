// US-25: projecten buiten de eigen portefeuille als bron voor samenwerkingen. Een openbare projectpagina (persbericht,
// projectpagina van een architect, vakblad) noemt vaak meerdere partijen; die worden herkend tegen het partnerbestand en
// leveren samenwerkingssignalen op, altijd met de bron. LinkedIn wordt niet automatisch gelezen (voorwaarden LinkedIn en
// AVG): een LinkedIn-URL kan alleen als bronvermelding dienen, de betrokken partijen kiest de gebruiker zelf.
import { normaliseerNaam } from "./discovery";
import type { Partner } from "./types";

export function isLinkedIn(url: string) {
  try {
    return /(^|\.)linkedin\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Partners uit het bestand die in de tekst bij naam worden genoemd (genormaliseerd, minimaal 5 tekens). */
export function genoemdePartners(tekst: string, partners: Partner[]) {
  const t = ` ${normaliseerNaam(tekst)} `;
  return partners
    .map((p) => ({ p, naam: normaliseerNaam(p.naam) }))
    .filter(({ naam }) => naam.length >= 5 && t.includes(` ${naam} `))
    .map(({ p }) => ({ id: p.id, naam: p.naam, rollen: p.rollen }));
}

/** Titel van een pagina (zonder sitenaam). */
export function paginaTitel(html: string) {
  return html.match(/<title[^>]*>([^<]{2,200})<\/title>/i)?.[1]?.split(/\s[|\-–]\s/)[0].trim() ?? "";
}
