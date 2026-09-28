// Echte bronconnector: KVK Zoeken API v2 (https://developers.kvk.nl). Werkt zodra KVK_API_KEY is gezet
// en de beheerder externe bronnen heeft toegestaan. Levert uitsluitend bedrijfsgegevens (US-24).
import type { BronConnector } from "./discovery";
import { geocode } from "./geo";
import type { Rol } from "./types";

type KvkResultaat = {
  kvkNummer: string;
  naam: string;
  adres?: { binnenlandsAdres?: { straatnaam?: string; huisnummer?: number; plaats?: string } };
  type?: string;
};

const ZOEKTERMEN: Record<Rol, string[]> = {
  aannemer: ["bouwbedrijf", "aannemer woningbouw", "bouwgroep"],
  architect: ["architectenbureau", "architecten"],
  installateur: ["installatiebedrijf", "installatietechniek"],
  adviseur: ["bouwadvies", "ingenieursbureau bouw", "duurzaamheidsadvies"],
  leverancier: ["prefab bouwelementen", "houtconstructies", "gevelelementen"],
  ontwikkelpartner: ["projectontwikkeling woningbouw"]
};

export function kvkConnector(apiKey: string, basisUrl = "https://api.kvk.nl/api/v2/zoeken"): BronConnector {
  return {
    naam: "KVK Zoeken API",
    omschrijving: "Officieel handelsregister; zoekt op branchetermen per rol plus uw trefwoorden en regio.",
    async zoek(vraag) {
      const resultaten: Awaited<ReturnType<BronConnector["zoek"]>> = [];
      const gezien = new Set<string>();
      const extra = vraag.trefwoorden.filter((w) => w.length > 3).slice(0, 2).join(" ");
      for (const rol of vraag.rollen) {
        for (const term of ZOEKTERMEN[rol]) {
          const params = new URLSearchParams({ naam: `${term} ${extra}`.trim(), type: "hoofdvestiging", resultatenPerPagina: "20" });
          if (vraag.regio) params.set("plaats", vraag.regio);
          try {
            const res = await fetch(`${basisUrl}?${params}`, { headers: { apikey: apiKey, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const json = (await res.json()) as { resultaten?: KvkResultaat[] };
            for (const r of json.resultaten ?? []) {
              if (!r.kvkNummer || gezien.has(r.kvkNummer)) continue;
              gezien.add(r.kvkNummer);
              const plaats = r.adres?.binnenlandsAdres?.plaats ?? "";
              resultaten.push({
                naam: r.naam,
                kvk: r.kvkNummer,
                vestigingsplaats: plaats,
                adres: [r.adres?.binnenlandsAdres?.straatnaam, r.adres?.binnenlandsAdres?.huisnummer].filter(Boolean).join(" ") || undefined,
                locatie: geocode(plaats) ?? undefined,
                rollen: [rol],
                bron: "KVK-register",
                bronUrl: `https://www.kvk.nl/bestellen/#/${r.kvkNummer}`,
                opgehaaldOp: new Date().toISOString(),
                ruweData: { zoekterm: term, type: r.type, profiel: "" }
              } as Awaited<ReturnType<BronConnector["zoek"]>>[number]);
            }
          } catch {
            // Netwerkfout of time-out: sla deze term over; de andere bronnen leveren nog steeds.
          }
        }
      }
      return resultaten;
    }
  };
}

// ---------- US-60: KVK-handelsregister, Basisprofiel (https://developers.kvk.nl/documentation/basisprofiel-api) ----------
// Met de API-sleutel van Blauwhoed (KVK_API_KEY) worden bij het verrijken van een partner met KVK-nummer de statutaire naam,
// rechtsvorm, SBI-activiteiten, het vestigingsadres en de oprichtingsdatum opgehaald. Bron: 'KVK – gevalideerde registratie' (rang 2).

export type KvkBasisprofiel = {
  kvkNummer: string;
  statutaireNaam?: string;
  rechtsvorm?: string;
  sbiActiviteiten: Array<{ code: string; omschrijving: string; hoofd?: boolean }>;
  adres?: string;
  plaats?: string;
  oprichtingsdatum?: string;
};

type KvkAdres = { type?: string; volledigAdres?: string; straatnaam?: string; huisnummer?: number | string; huisletter?: string; huisnummerToevoeging?: string; postcode?: string; plaats?: string };
type KvkBasisprofielJson = {
  kvkNummer?: string;
  naam?: string;
  statutaireNaam?: string;
  formeleRegistratiedatum?: string;
  materieleRegistratie?: { datumAanvang?: string };
  sbiActiviteiten?: Array<{ sbiCode?: string; sbiOmschrijving?: string; indHoofdactiviteit?: string }>;
  _embedded?: { hoofdvestiging?: { adressen?: KvkAdres[] }; eigenaar?: { rechtsvorm?: string; uitgebreideRechtsvorm?: string } };
};

const RECHTSVORM: Record<string, string> = { BeslotenVennootschap: "B.V.", NaamlozeVennootschap: "N.V.", Eenmanszaak: "Eenmanszaak", VennootschapOnderFirma: "V.O.F.", CommanditaireVennootschap: "C.V.", Stichting: "Stichting", Vereniging: "Vereniging", Cooperatie: "Coöperatie" };

function datumUitKvk(d?: string) {
  return d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : undefined;
}

/** Pure vertaling van het KVK Basisprofiel-antwoord. */
export function leesBasisprofiel(json: KvkBasisprofielJson): KvkBasisprofiel {
  const adressen = json._embedded?.hoofdvestiging?.adressen ?? [];
  const a = adressen.find((x) => x.type === "bezoekadres") ?? adressen[0];
  const rv = json._embedded?.eigenaar?.rechtsvorm;
  return {
    kvkNummer: json.kvkNummer ?? "",
    statutaireNaam: json.statutaireNaam ?? json.naam,
    rechtsvorm: rv ? RECHTSVORM[rv] ?? json._embedded?.eigenaar?.uitgebreideRechtsvorm ?? rv : undefined,
    sbiActiviteiten: (json.sbiActiviteiten ?? []).filter((s) => s.sbiCode).map((s) => ({ code: s.sbiCode!, omschrijving: s.sbiOmschrijving ?? "", hoofd: s.indHoofdactiviteit === "Ja" || undefined })),
    adres: a ? [a.straatnaam, [a.huisnummer, a.huisletter, a.huisnummerToevoeging].filter(Boolean).join(""), a.postcode].filter(Boolean).join(" ").trim() || a.volledigAdres : undefined,
    plaats: a?.plaats,
    oprichtingsdatum: datumUitKvk(json.materieleRegistratie?.datumAanvang) ?? datumUitKvk(json.formeleRegistratiedatum)
  };
}

export function kvkKoppelingActief() {
  return Boolean(process.env.KVK_API_KEY);
}

export async function haalBasisprofiel(kvk: string, apiKey = process.env.KVK_API_KEY, basisUrl = "https://api.kvk.nl/api/v1/basisprofielen"): Promise<KvkBasisprofiel | null> {
  if (!apiKey || !/^\d{8}$/.test(kvk)) return null;
  try {
    const res = await fetch(`${basisUrl}/${kvk}?geoData=false`, { headers: { apikey: apiKey, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return leesBasisprofiel((await res.json()) as KvkBasisprofielJson);
  } catch {
    return null;
  }
}

export const sbiTekst = (s: KvkBasisprofiel["sbiActiviteiten"]) => s.map((x) => `${x.code} ${x.omschrijving}${x.hoofd ? " (hoofdactiviteit)" : ""}`).join("; ");
