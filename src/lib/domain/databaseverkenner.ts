// Databaseverkenner: de hele database als relationele tabellen, vrij te doorzoeken (alleen lezen, alleen beheerders).
// Generiek opgebouwd uit de opgeslagen gegevens, zodat nieuwe velden en collecties vanzelf meekomen:
// - elke collectie (lijst) is een tabel; een geneste lijst van objecten (bijv. partners → factoren) is een eigen
//   kindtabel met de kolom 'ouder' (id van het bovenliggende record);
// - een genest object (bijv. locatie, planning) wordt één niveau uitgevouwen tot kolommen 'locatie.lat' enz.;
// - elke waarde die gelijk is aan een id uit een andere tabel is een koppeling (heen én terug).
import type { Database } from "./types";

export type Cel = string | number | boolean | null | string[] | { json: string };
export type Rij = { _id: string; _label: string; velden: Record<string, Cel>; ruw: unknown };
export type Tabel = { naam: string; label: string; groep: string; ouder?: string; kolommen: string[]; rijen: Rij[]; labelKolom?: string };

/** Leesbare namen en groepering van de bekende collecties; onbekende collecties komen onder 'Overig'. */
const BEKEND: Record<string, { label: string; groep: string }> = {
  partners: { label: "Partners", groep: "Kerngegevens" },
  projecten: { label: "Projecten", groep: "Kerngegevens" },
  factoren: { label: "Factoren", groep: "Kerngegevens" },
  engagements: { label: "Engagements (partner × project)", groep: "Kerngegevens" },
  evaluaties: { label: "Evaluaties", groep: "Kerngegevens" },
  samenwerkingen: { label: "Samenwerkingen", groep: "Kerngegevens" },
  kandidaten: { label: "Discovery-kandidaten", groep: "Werkprocessen" },
  verrijkingsvoorstellen: { label: "Verrijkingsvoorstellen", groep: "Werkprocessen" },
  verrijkingsrondes: { label: "Verrijkingsrondes", groep: "Werkprocessen" },
  matchRuns: { label: "Matchruns", groep: "Werkprocessen" },
  feedback: { label: "Matchfeedback", groep: "Werkprocessen" },
  teams: { label: "Teamvoorstellen", groep: "Werkprocessen" },
  zoekprofielen: { label: "Zoekprofielen", groep: "Werkprocessen" },
  importWachtrij: { label: "Importwachtrij", groep: "Werkprocessen" },
  afwijsredenen: { label: "Afwijsredenen discovery", groep: "Werkprocessen" },
  gewichtsprofielen: { label: "Gewichtsprofielen", groep: "Instellingen" },
  goudstandaard: { label: "Goudstandaard", groep: "Instellingen" },
  instellingen: { label: "Instellingen", groep: "Instellingen" },
  gebruikers: { label: "Gebruikers", groep: "Beheer" },
  audit: { label: "Auditlog", groep: "Beheer" },
  aiBewerkingen: { label: "AI-bewerkingen", groep: "Beheer" }
};
export const GROEPVOLGORDE = ["Kerngegevens", "Werkprocessen", "Instellingen", "Beheer", "Overig"];

/** Velden die eerst komen (in deze volgorde); de rest volgt in de volgorde waarin ze voorkomen. */
const VOORRANG = ["naam", "veld", "code", "titel", "omschrijving", "status", "rol", "rollen", "type", "partnerId", "projectId", "factorId", "optieId", "waarde", "bron", "op", "door", "actie"];
/** Velden die standaard niet als kolom getoond worden (wel in het detail en doorzoekbaar). */
const VERBORGEN = new Set(["id", "webHash", "ruweData", "veldHerkomst", "brongegevens", "geenBron", "versies"]);

/** Kolommen waarvan de waarde nooit als koppeling geldt (optie-id's kunnen gelijk zijn aan een factor-id). */
export const GEEN_KOPPELING = new Set(["optieId", "sleutel", "rol", "status", "type", "bron", "soort"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isLijstVanObjecten = (v: unknown): v is Array<Record<string, unknown>> => Array.isArray(v) && v.length > 0 && v.every(isObject);

function naarCel(v: unknown): Cel {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.map(String);
  return { json: JSON.stringify(v) };
}

const LABELVELDEN = ["naam", "label", "veld", "titel", "code", "factorId", "type", "url", "sleutel", "omschrijving", "actie", "reden", "kandidaatNaam", "rol"];

function labelVan(o: Record<string, unknown>, fallback: string): { label: string; kolom?: string } {
  for (const k of LABELVELDEN) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return { label: v.length > 80 ? `${v.slice(0, 77)}…` : v, kolom: k };
  }
  return { label: fallback };
}

function ordenKolommen(sleutels: string[]): string[] {
  const rang = (k: string) => {
    const i = VOORRANG.indexOf(k);
    return i === -1 ? VOORRANG.length : i;
  };
  return [...sleutels].sort((a, b) => rang(a) - rang(b) || sleutels.indexOf(a) - sleutels.indexOf(b));
}

/** Bouw alle tabellen (collecties en geneste kindtabellen) uit de database. */
export function bouwTabellen(db: Database): Tabel[] {
  const tabellen: Tabel[] = [];

  const voegToe = (naam: string, label: string, groep: string, items: Array<Record<string, unknown>>, ouder?: { tabel: string; ids: string[]; labels: string[] }) => {
    const sleutels: string[] = ouder ? ["ouder"] : [];
    const kinderen = new Map<string, Array<{ ouderId: string; ouderLabel: string; item: Record<string, unknown> }>>();
    const labelKolommen = new Map<string, number>();
    const rijen: Rij[] = items.map((item, i) => {
      const _id = typeof item.id === "string" && item.id ? item.id : ouder ? `${ouder.ids[i]}#${i}` : `${naam}#${i}`;
      const velden: Record<string, Cel> = {};
      if (ouder) velden.ouder = ouder.ids[i];
      // Label: eigen naam/veld/…; bij een kindrecord voorafgegaan door het label van de ouder ("Aalberts Bouw · mpg").
      const eigen = labelVan(item, ouder ? `#${i + 1}` : _id);
      if (eigen.kolom) labelKolommen.set(eigen.kolom, (labelKolommen.get(eigen.kolom) ?? 0) + 1);
      for (const [k, v] of Object.entries(item)) {
        if (isLijstVanObjecten(v)) {
          // Geneste lijst van objecten → kindtabel; in de oudertabel alleen het aantal.
          const lijst = kinderen.get(k) ?? [];
          v.forEach((x) => lijst.push({ ouderId: _id, ouderLabel: eigen.label, item: x }));
          kinderen.set(k, lijst);
          velden[k] = `${v.length} ×`;
        } else if (isObject(v) && Object.values(v).every((x) => !isObject(x) && !isLijstVanObjecten(x))) {
          // Plat object (locatie, planning, schaal) → één niveau uitvouwen.
          for (const [k2, v2] of Object.entries(v)) {
            velden[`${k}.${k2}`] = naarCel(v2);
            if (!sleutels.includes(`${k}.${k2}`)) sleutels.push(`${k}.${k2}`);
          }
          continue;
        } else velden[k] = naarCel(v);
        if (!sleutels.includes(k)) sleutels.push(k);
      }
      return { _id, _label: ouder ? `${ouder.labels[i]} · ${eigen.label}` : eigen.label, velden, ruw: item };
    });
    // De kolom waar (bijna) alle labels uit komen hoeft niet nog eens als gewone kolom te worden getoond.
    const [labelKolom, aantal] = [...labelKolommen.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    tabellen.push({ naam, label, groep, ouder: ouder?.tabel, kolommen: ordenKolommen(sleutels), rijen, labelKolom: !ouder && aantal && aantal >= rijen.length * 0.9 ? labelKolom : undefined });
    for (const [k, lijst] of kinderen)
      voegToe(`${naam}.${k}`, `${label} › ${k}`, groep, lijst.map((x) => x.item), { tabel: naam, ids: lijst.map((x) => x.ouderId), labels: lijst.map((x) => x.ouderLabel) });
  };

  for (const [naam, waarde] of Object.entries(db)) {
    if (naam === "versie") continue;
    const meta = BEKEND[naam] ?? { label: naam, groep: "Overig" };
    if (Array.isArray(waarde)) {
      voegToe(naam, meta.label, meta.groep, waarde.filter(isObject));
    } else if (isObject(waarde)) {
      // Object-collecties (instellingen, goudstandaard): één rij per sleutel.
      const items = Object.entries(waarde).map(([sleutel, v]) => (isObject(v) ? { id: `${naam}:${sleutel}`, sleutel, ...v } : { id: `${naam}:${sleutel}`, sleutel, waarde: v }));
      voegToe(naam, meta.label, meta.groep, items);
    }
  }
  return tabellen.sort((a, b) => GROEPVOLGORDE.indexOf(a.groep) - GROEPVOLGORDE.indexOf(b.groep));
}

export type IdIndex = Map<string, { tabel: string; label: string }>;

/** Alle id's met hun tabel en label, voor het herkennen van koppelingen. */
export function bouwIndex(tabellen: Tabel[]): IdIndex {
  const index: IdIndex = new Map();
  for (const t of tabellen) for (const r of t.rijen) if (!index.has(r._id)) index.set(r._id, { tabel: t.naam, label: r._label });
  return index;
}

/** Tekst van een cel (voor zoeken, sorteren en CSV). */
export function celTekst(c: Cel | undefined): string {
  if (c === null || c === undefined) return "";
  if (Array.isArray(c)) return c.join(", ");
  if (typeof c === "object") return c.json;
  return String(c);
}

/**
 * Zoekopdracht: losse woorden moeten ergens in de rij voorkomen; 'kolom:tekst' zoekt alleen in die kolom
 * (deel van de naam volstaat, bijv. 'status:bekend' of 'rol:architect'); '-woord' sluit uit. Hoofdletterongevoelig.
 */
export function zoekFilter(q: string) {
  const termen = (q.match(/(-?[^\s:"]+:"[^"]*"|-?[^\s:"]+:\S+|-?"[^"]*"|\S+)/g) ?? []).map((t) => {
    const nee = t.startsWith("-") && t.length > 1;
    const kaal = nee ? t.slice(1) : t;
    const m = kaal.match(/^([^\s:"]+):(.*)$/);
    const schoon = (s: string) => s.replace(/^"|"$/g, "").toLowerCase();
    return m ? { kolom: m[1].toLowerCase(), tekst: schoon(m[2]), nee } : { kolom: null, tekst: schoon(kaal), nee };
  });
  return (r: Rij, index?: IdIndex) => {
    const waarden = Object.entries(r.velden).map(([k, v]) => {
      const t = celTekst(v);
      if (GEEN_KOPPELING.has(k)) return [k.toLowerCase(), t.toLowerCase()] as const;
      // Koppelingen zijn ook op naam te vinden (zoek 'Aalberts' in engagements).
      const gekoppeld = typeof v === "string" ? index?.get(v)?.label ?? "" : Array.isArray(v) ? v.map((x) => index?.get(x)?.label ?? "").join(" ") : "";
      return [k.toLowerCase(), `${t} ${gekoppeld}`.toLowerCase()] as const;
    });
    waarden.push(["id", r._id.toLowerCase()]);
    return termen.every(({ kolom, tekst, nee }) => {
      const treffer = kolom ? waarden.some(([k, t]) => k.includes(kolom) && t.includes(tekst)) : waarden.some(([, t]) => t.includes(tekst));
      return nee ? !treffer : treffer;
    });
  };
}

/** Sorteer op kolom (getallen numeriek, de rest alfabetisch; leeg achteraan). */
export function sorteer(rijen: Rij[], kolom: string | undefined, aflopend: boolean): Rij[] {
  if (!kolom) return rijen;
  const uit = [...rijen].sort((a, b) => {
    const x = a.velden[kolom];
    const y = b.velden[kolom];
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    const r = typeof x === "number" && typeof y === "number" ? x - y : celTekst(x).localeCompare(celTekst(y), "nl", { numeric: true });
    return aflopend ? -r : r;
  });
  return uit;
}

/** Verwijzingen naar dit id vanuit alle andere tabellen (inkomende koppelingen), per tabel. */
export function verwijzingenNaar(id: string, tabellen: Tabel[], max = 100): Array<{ tabel: Tabel; rijen: Array<{ rij: Rij; kolom: string }> }> {
  const uit: Array<{ tabel: Tabel; rijen: Array<{ rij: Rij; kolom: string }> }> = [];
  for (const t of tabellen) {
    const rijen: Array<{ rij: Rij; kolom: string }> = [];
    for (const r of t.rijen) {
      if (r._id === id) continue;
      const kolom = Object.entries(r.velden).find(([k, v]) => !GEEN_KOPPELING.has(k) && (v === id || (Array.isArray(v) && v.includes(id))))?.[0];
      if (kolom) rijen.push({ rij: r, kolom });
      if (rijen.length >= max) break;
    }
    if (rijen.length) uit.push({ tabel: t, rijen });
  }
  return uit;
}

/** Standaard zichtbare kolommen: de eerste acht niet-verborgen kolommen. */
export function standaardKolommen(t: Tabel): string[] {
  return t.kolommen.filter((k) => !VERBORGEN.has(k) && !k.startsWith("_") && k !== t.labelKolom).slice(0, 8);
}

export function naarCsv(t: Tabel, rijen: Rij[], kolommen: string[]): string {
  const veilig = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [["id", ...kolommen].join(";"), ...rijen.map((r) => [r._id, ...kolommen.map((k) => celTekst(r.velden[k]))].map(veilig).join(";"))].join("\r\n");
}
