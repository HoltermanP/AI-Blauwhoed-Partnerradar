// Echte geocoding via PDOK Locatieserver (Kadaster, gratis, geen sleutel). Server-side, met cache en terugval op de lokale plaatsenlijst.
import { geocode as lokaal } from "./geo";
import type { Geo } from "./types";

const cache = new Map<string, Geo | null>();

export type GeocodeResultaat = { locatie: Geo; bron: "pdok" | "lijst"; weergave: string } | null;

export async function geocodeer(adresOfPlaats: string, timeoutMs = 8000): Promise<GeocodeResultaat> {
  const q = adresOfPlaats.trim();
  if (!q) return null;
  const sleutel = q.toLowerCase();
  if (cache.has(sleutel)) {
    const c = cache.get(sleutel);
    return c ? { locatie: c, bron: "pdok", weergave: q } : lokaalResultaat(q);
  }
  try {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&rows=5&fl=centroide_ll,weergavenaam,type`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (res.ok) {
      const json = (await res.json()) as { response?: { docs?: Array<{ centroide_ll?: string; weergavenaam?: string; type?: string }> } };
      const docs = json.response?.docs ?? [];
      const doc = docs.find((d) => ["woonplaats", "adres", "postcode", "gemeente", "weg"].includes(d.type ?? "")) ?? docs[0];
      const m = doc?.centroide_ll?.match(/POINT\(([-0-9.]+) ([-0-9.]+)\)/);
      if (m) {
        const locatie = { lng: Number(m[1]), lat: Number(m[2]) };
        cache.set(sleutel, locatie);
        return { locatie, bron: "pdok", weergave: doc?.weergavenaam ?? q };
      }
    }
  } catch {
    // netwerkfout: val terug op lokale lijst
  }
  cache.set(sleutel, null);
  return lokaalResultaat(q);
}

function lokaalResultaat(q: string): GeocodeResultaat {
  const g = lokaal(q);
  return g ? { locatie: g, bron: "lijst", weergave: q } : null;
}
