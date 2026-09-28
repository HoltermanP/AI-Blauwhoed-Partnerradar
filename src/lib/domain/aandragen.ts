// US-55: de applicatie draagt zelf partners aan die nog ontbreken in het bestand, op basis van een zoekprofiel.
// Zoekvragen (AI of regels) → kandidaten uit bronnen (eigen uitgaven van Blauwhoed, KVK, open web/vakmedia) → ontdubbelen tegen
// het bestaande bestand → concepten (US-54) met onderbouwing, bron-URL en ophaaldatum. Het blijft een voorstel.
import { normaliseerNaam, vindDubbel } from "./discovery";
import { semantischeGelijkenis } from "./embedding";
import { ROL_LABEL } from "../format";
import type { AISamenvatting, DiscoveryCandidate, Partner, Rol, Zoekprofiel } from "./types";

const ROL_TERMEN: Record<Rol, string> = {
  aannemer: "aannemer woningbouw",
  architect: "architectenbureau woningbouw",
  installateur: "installateur woningbouw",
  adviseur: "adviesbureau woningbouw",
  leverancier: "leverancier bouwsysteem woningbouw",
  ontwikkelpartner: "ontwikkelende bouwer"
};

/** Zoekvragen zonder AI: per rol de branchterm met trefwoorden en regio, plus een vakmedia-variant. */
export function regelZoekvragen(profiel: Pick<Zoekprofiel, "rollen" | "trefwoorden" | "regio">): Array<{ vraag: string; rol: Rol }> {
  const woorden = profiel.trefwoorden.split(/[\s,;]+/).filter((w) => w.length > 3).slice(0, 4).join(" ");
  return profiel.rollen.flatMap((rol) => [
    { vraag: `${ROL_TERMEN[rol]} ${woorden} ${profiel.regio ?? ""}`.replace(/\s+/g, " ").trim(), rol },
    { vraag: `${woorden} ${ROL_LABEL[rol].toLowerCase()} referentieproject ${profiel.regio ?? ""}`.replace(/\s+/g, " ").trim(), rol }
  ]).slice(0, 6);
}

/** Namen en detailpagina's van aanbieders op een overzichtspagina van een eigen uitgave (bijv. Conceptenboulevard). */
export function aanbiedersUitOverzicht(html: string, basisUrl: string): Array<{ naam: string; url: string }> {
  const basis = new URL(basisUrl);
  const pad = basis.pathname.replace(/\/$/, "");
  const uit = new Map<string, { naam: string; url: string }>();
  for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]{2,160}?)<\/a>/gi)) {
    const href = m[1];
    const abs = href.startsWith("http") ? href : href.startsWith("/") ? basis.origin + href : null;
    if (!abs || !abs.startsWith(basis.origin)) continue;
    const p = new URL(abs).pathname;
    if (!pad || !p.startsWith(`${pad}/`) || p === `${pad}/`) continue;
    const naam = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (naam.length < 3 || naam.length > 80 || /^(meer|lees|bekijk|volgende|vorige|home|contact)\b/i.test(naam)) continue;
    const sleutel = normaliseerNaam(naam);
    if (sleutel && !uit.has(sleutel)) uit.set(sleutel, { naam, url: abs });
  }
  return Array.from(uit.values());
}

export type AandraagKandidaat = Omit<DiscoveryCandidate, "id" | "status" | "opgehaaldOp" | "projectId"> & { zoekvraag: string };

/** Ontdubbel tegen het bestaande bestand (inclusief concepten en gearchiveerde partners) en binnen de set zelf. */
export function ontdubbel(kandidaten: AandraagKandidaat[], partners: Partner[]) {
  const nieuw: AandraagKandidaat[] = [];
  const dubbel: Array<{ naam: string; reden: string }> = [];
  const gezien = new Set<string>();
  kandidaten.forEach((k) => {
    const sleutel = k.kvk || normaliseerNaam(k.naam);
    if (!sleutel || gezien.has(sleutel)) return;
    gezien.add(sleutel);
    const d = vindDubbel(k, partners);
    if (d) dubbel.push({ naam: k.naam, reden: d.reden });
    else nieuw.push(k);
  });
  return { nieuw, dubbel };
}

/** Onderbouwing zonder AI: wat het bedrijf doet, waarom het past bij het profiel en wat onzeker is. */
export function regelOnderbouwing(k: AandraagKandidaat, profiel: Pick<Zoekprofiel, "naam" | "rollen" | "trefwoorden" | "regio">): AISamenvatting {
  const profieltekst = String(k.ruweData.profiel ?? k.ruweData.websiteTekst ?? "");
  const sem = semantischeGelijkenis(profiel.trefwoorden, profieltekst);
  const onzeker = ["Voorstel van de applicatie op basis van openbare informatie; nog niet vastgesteld."];
  if (!k.kvk) onzeker.push("KVK-nummer niet gevonden of niet geverifieerd.");
  if (!k.vestigingsplaats) onzeker.push("Vestigingsplaats onbekend.");
  if (!sem.treffers.length) onzeker.push("Weinig inhoudelijke overlap met de trefwoorden van het zoekprofiel.");
  return {
    watDoetHetBedrijf: profieltekst.slice(0, 400) || `${k.naam} (${k.rollen.join(", ")}).`,
    referentieprojecten: (k.ruweData.referenties as string[] | undefined) ?? [],
    waaromPastHet: `Gevonden via zoekprofiel '${profiel.naam}' (${k.zoekvraag}). Rol ${k.rollen.map((r) => ROL_LABEL[r].toLowerCase()).join("/")}${sem.treffers.length ? `; overlap op: ${sem.treffers.slice(0, 6).join(", ")}` : ""}${profiel.regio && k.vestigingsplaats ? `; vestiging ${k.vestigingsplaats} (gezocht: ${profiel.regio})` : ""}.`,
    watIsOnzeker: onzeker,
    gegenereerdOp: new Date().toISOString(),
    provider: "regels (geen externe AI)"
  };
}
