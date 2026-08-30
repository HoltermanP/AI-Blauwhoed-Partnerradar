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
