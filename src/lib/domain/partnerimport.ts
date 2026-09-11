// Partners importeren uit Excel/CSV (o.a. het Blauwhoed-overzicht houtbouwers). Kolommen worden soepel herkend;
// bruikbare kenmerken worden als factorwaarde met bron 'opgave' vastgelegd, de rest als tags/omschrijving.
import { normaliseerNaam } from "./discovery";
import type { Bron, Database, Geo, PartnerFactor, Rol } from "./types";

export type ImportRij = Record<string, string | number | boolean | null | undefined>;

export type GeimporteerdePartner = {
  naam: string;
  kvk?: string;
  plaats?: string;
  website?: string;
  rollen: Rol[];
  omschrijving: string;
  referenties: string[];
  tags: string[];
  medewerkers?: number;
  omzet?: number;
  factoren: Array<Omit<PartnerFactor, "peildatum">>;
  bronvermelding: string[];
  ruweRijen: Array<{ titel?: string; velden: Record<string, string> }>;
};

const kolom = (r: ImportRij, ...namen: string[]) => {
  const sleutels = Object.keys(r);
  for (const n of namen) {
    const k = sleutels.find((s) => s.toLowerCase().trim() === n.toLowerCase());
    if (k !== undefined && r[k] !== null && r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
  }
  return "";
};

const getal = (s: string) => {
  if (!s) return null;
  const direct = Number(s.replace(",", "."));
  if (Number.isFinite(direct)) return direct;
  // Bedragen/bereiken zoals "€ 1.087 - € 1.202": eerste getal, punten als duizendtal.
  const m = s.replace(/\.(?=\d{3})/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

function rollenUit(r: ImportRij): Rol[] {
  const tekst = `${kolom(r, "rol", "rollen", "ketenrol", "categorie")} ${kolom(r, "concept / maatwerk")}`.toLowerCase();
  const rollen = new Set<Rol>();
  if (/architect/.test(tekst)) rollen.add("architect");
  if (/aannemer|bouwer|bouwbedrijf/.test(tekst)) rollen.add("aannemer");
  if (/installat/.test(tekst)) rollen.add("installateur");
  if (/advis|constructeur|ingenieur|engineer/.test(tekst)) rollen.add("adviseur");
  if (/leverancier|producent|fabrikant|systeem/.test(tekst)) rollen.add("leverancier");
  if (/ontwikkel/.test(tekst)) rollen.add("ontwikkelpartner");
  return rollen.size ? Array.from(rollen) : ["aannemer"];
}

export function rijNaarPartner(r: ImportRij, bron: Bron = "opgave", betrouwbaarheid = 0.6): GeimporteerdePartner | null {
  const naam = kolom(r, "organisatie", "naam", "bedrijf", "partner", "bedrijfsnaam");
  if (!naam) return null;
  const f: GeimporteerdePartner["factoren"] = [];
  const zet = (factorId: string, waarde: PartnerFactor["waarde"], optieId?: string, toelichting?: string) => f.push({ factorId, optieId, waarde, bron, betrouwbaarheid, toelichting });

  const types = kolom(r, "mogelijke (woning)types", "woningtypes", "projecttype").toLowerCase();
  if (/grondgebonden/.test(types)) zet("projecttype", 3, "grondgebonden", "Uit import");
  if (/appartement|gestapeld/.test(types)) zet("projecttype", 3, "appartementen", "Uit import");
  if (/optop|transform/.test(types)) zet("projecttype", 3, "transformatie", "Uit import");

  const lagen = getal(kolom(r, "maximaal aantal lagen"));
  if (lagen !== null && lagen >= 8) zet("projecttype", 3, "hoogbouw", `Maximaal ${lagen} lagen`);

  const minOmvang = getal(kolom(r, "minimale projectgrootte", "min projectgrootte"));
  if (minOmvang !== null) zet("projectomvang", { min: minOmvang, max: Math.max(minOmvang * 10, 200) }, undefined, `Minimale projectgrootte ${minOmvang} uit import; maximum geschat`);

  const mpg = getal(kolom(r, "mpg - totaal a1 tm d", "mpg", "mpg totaal"));
  if (mpg !== null && mpg > 0 && mpg < 3) zet("mpg", Math.round(mpg * 100) / 100, undefined, "MPG uit import (opgave)");
  const beng2 = getal(kolom(r, "beng 2", "beng2"));
  if (beng2 !== null && beng2 >= 0 && beng2 < 200) zet("beng", Math.round(beng2), undefined, "BENG-2 uit import (opgave)");
  const bio = getal(kolom(r, "biobased - % massa", "biobased %", "aandeel biobased"));
  if (bio !== null) zet("biobased", Math.round(bio <= 1 ? bio * 100 : bio), undefined, "Biobased massa-% uit import");
  const losmaak = getal(kolom(r, "losmaakbaarheid - a1 set", "losmaakbaarheid"));
  if (losmaak !== null) zet("demontabel", Math.max(0, Math.min(5, Math.round((losmaak <= 1 ? losmaak : losmaak / 100) * 5))), undefined, `Losmaakbaarheidsindex ${losmaak}`);

  const materialen = [kolom(r, "gesloten geveldelen"), kolom(r, "woningscheidend / dragende wanden"), kolom(r, "verdiepingsvloer"), kolom(r, "bouwsysteem"), kolom(r, "type bouw")].join(" ").toLowerCase();
  if (/hsb|clt|hout/.test(materialen)) zet("bouwsysteem", 4, "houtbouw", "Materiaalopbouw uit import");
  if (/beton/.test(materialen) && /prefab|kanaalplaat|ribben/.test(materialen)) zet("bouwsysteem", 3, "prefab_beton", "Materiaalopbouw uit import");
  if (/staal/.test(materialen)) zet("bouwsysteem", 3, "staalframe", "Materiaalopbouw uit import");

  const industrialisatie = kolom(r, "mate van industrialisatie", "prefabricagegraad").toLowerCase();
  const fabriek = kolom(r, "eigen fabriek").toLowerCase();
  const bouw2d3d = kolom(r, "2d of 3d bouw").toLowerCase();
  if (/hoog|volledig|3d/.test(industrialisatie) || /3d/.test(bouw2d3d) || fabriek === "ja") zet("prefabricage", /3d/.test(industrialisatie + bouw2d3d) ? 5 : 4, undefined, "Industrialisatie/eigen fabriek uit import");
  else if (/2d/.test(bouw2d3d) || /midden|gemiddeld/.test(industrialisatie)) zet("prefabricage", 3, undefined, "2D-elementen uit import");

  const concept = kolom(r, "concept / maatwerk", "concept").toLowerCase();
  if (/concept/.test(concept)) zet("conceptbouw", 4, undefined, "Woningconcept uit import");
  else if (/maatwerk/.test(concept)) zet("conceptbouw", 1, undefined, "Maatwerk uit import");

  const contract = kolom(r, "contractvorm").toLowerCase();
  if (/bouwteam/.test(contract)) zet("contractvorm", 4, "bouwteam", "Contractvorm uit import");
  if (/d&b|design ?& ?build|turnkey/.test(contract)) zet("contractvorm", 4, "design_build", "Contractvorm uit import");
  if (/uav-?gc/.test(contract)) zet("contractvorm", 4, "uav_gc", "Contractvorm uit import");

  const doelgroep = kolom(r, "doelgroepen", "prijssegment").toLowerCase();
  if (/sociaal|sociale/.test(doelgroep)) zet("prijssegment", 3, "sociaal");
  if (/midden/.test(doelgroep)) zet("prijssegment", 3, "middenhuur");
  if (/koop/.test(doelgroep)) zet("prijssegment", 3, "koop");
  if (/vrije/.test(doelgroep)) zet("prijssegment", 3, "vrije sector");

  const bio2 = kolom(r, "biodiversiteit").toLowerCase();
  if (bio2 && !/nee|n\.?v\.?t|geen/.test(bio2)) zet("natuurinclusief", 3, undefined, `Biodiversiteit: ${bio2}`);

  const omvang = kolom(r, "omvang").toLowerCase();
  const medewerkers = getal(kolom(r, "medewerkers", "aantal medewerkers", "fte"));
  const omzet = getal(kolom(r, "omzet"));

  const omschrijvingDelen = [
    kolom(r, "omschrijving", "profiel"),
    kolom(r, "conceptnaam") ? `Woningconcept ${kolom(r, "conceptnaam")}` : "",
    concept ? `${kolom(r, "concept / maatwerk")}` : "",
    types ? `Woningtypes: ${kolom(r, "mogelijke (woning)types")}` : "",
    kolom(r, "specificatie woningtypes"),
    materialen.trim() ? `Bouwopbouw: ${[kolom(r, "gesloten geveldelen"), kolom(r, "woningscheidend / dragende wanden"), kolom(r, "verdiepingsvloer")].filter(Boolean).join(", ")}` : "",
    kolom(r, "isolatie dak / gevel") ? `Isolatie: ${kolom(r, "isolatie dak / gevel")}` : "",
    kolom(r, "gevelafwerking") ? `Gevel: ${kolom(r, "gevelafwerking")}` : "",
    kolom(r, "warmtebron/opwekking") ? `Warmte: ${kolom(r, "warmtebron/opwekking")}` : "",
    kolom(r, "pmc") ? `PMC: ${kolom(r, "pmc")}` : "",
    kolom(r, "opmerkingen")
  ].filter(Boolean);

  const tags = [omvang && `omvang:${omvang}`, kolom(r, "onderdeel concern") && `concern:${kolom(r, "onderdeel concern")}`, kolom(r, "woningborg / bouwgarant / swk") && `garantie:${kolom(r, "woningborg / bouwgarant / swk")}`, kolom(r, "type bouw (checken site)") && kolom(r, "type bouw (checken site)").toLowerCase()].filter(Boolean) as string[];
  const bronnen = [kolom(r, "bron 1 - website", "website", "url"), kolom(r, "bron 2"), kolom(r, "bron 3")].filter(Boolean);
  const website = bronnen.find((b) => /^https?:\/\//i.test(b)) ?? (kolom(r, "website", "url") ? `https://${kolom(r, "website", "url").replace(/^https?:\/\//, "")}` : undefined);

  return {
    naam,
    kvk: kolom(r, "kvk", "kvk-nummer", "kvknummer").replace(/\D/g, "") || undefined,
    plaats: kolom(r, "plaats", "vestigingsplaats", "stad") || undefined,
    website,
    rollen: rollenUit(r),
    omschrijving: omschrijvingDelen.join(". ").replace(/\.\./g, "."),
    referenties: [kolom(r, "referenties"), kolom(r, "referentieprojecten")].filter(Boolean).flatMap((x) => x.split(/;|\n/)).map((x) => x.trim()).filter(Boolean),
    tags,
    medewerkers: medewerkers ?? undefined,
    omzet: omzet ?? undefined,
    factoren: f,
    bronvermelding: bronnen.filter((b) => !/^https?:\/\//i.test(b)),
    ruweRijen: [{ titel: kolom(r, "conceptnaam") || undefined, velden: Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "").map(([k, v]) => [k, typeof v === "number" ? String(Math.round(v * 1000) / 1000) : String(v)])) }]
  };
}

/** Meerdere rijen van dezelfde organisatie (bijv. per woningconcept) worden samengevoegd tot één partner. */
export function voegRijenSamen(partners: GeimporteerdePartner[]): GeimporteerdePartner[] {
  const map = new Map<string, GeimporteerdePartner>();
  partners.forEach((p) => {
    const k = p.naam.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const b = map.get(k);
    if (!b) return map.set(k, { ...p });
    b.kvk = b.kvk ?? p.kvk;
    b.plaats = b.plaats ?? p.plaats;
    b.website = b.website ?? p.website;
    b.rollen = Array.from(new Set([...b.rollen, ...p.rollen]));
    b.omschrijving = [b.omschrijving, p.omschrijving].filter(Boolean).join(" | ");
    b.referenties = Array.from(new Set([...b.referenties, ...p.referenties]));
    b.tags = Array.from(new Set([...b.tags, ...p.tags]));
    b.ruweRijen = [...b.ruweRijen, ...p.ruweRijen];
    p.factoren.forEach((f) => {
      const idx = b.factoren.findIndex((x) => x.factorId === f.factorId && (x.optieId ?? "") === (f.optieId ?? ""));
      if (idx < 0) b.factoren.push(f);
      else if (typeof f.waarde === "number" && typeof b.factoren[idx].waarde === "number") {
        const lager = f.factorId === "mpg" || f.factorId === "beng";
        b.factoren[idx] = lager ? (f.waarde < (b.factoren[idx].waarde as number) ? f : b.factoren[idx]) : f.waarde > (b.factoren[idx].waarde as number) ? f : b.factoren[idx];
      }
    });
  });
  return Array.from(map.values());
}

export type ImportUitkomst = { gelezen: number; nieuw: number; bijgewerkt: number; overgeslagen: Array<{ naam: string; reden: string }>; zonderLocatie: number };

/** Voegt geïmporteerde partners toe aan de database (synchroon; geocoding is vooraf gedaan). Bestaande partners worden alleen aangevuld. */
export function voegPartnersToe(db: Database, partners: GeimporteerdePartner[], locaties: Map<string, Geo | null>, bronnaam: string, nieuwId: (prefix: string, hint?: string) => string): ImportUitkomst {
  const uitkomst: ImportUitkomst = { gelezen: partners.length, nieuw: 0, bijgewerkt: 0, overgeslagen: [], zonderLocatie: 0 };
  const nu = new Date().toISOString();
  partners.forEach((p) => {
    const bestaand = db.partners.find((x) => (p.kvk && x.kvk === p.kvk) || normaliseerNaam(x.naam) === normaliseerNaam(p.naam));
    const geo = p.plaats ? locaties.get(p.plaats) ?? null : null;
    const factoren: PartnerFactor[] = p.factoren.map((f) => ({ ...f, peildatum: nu.slice(0, 10), status: f.status ?? (f.bron === "web" ? "voorgesteld" : "gevalideerd") }));
    if (bestaand) {
      // Alleen aanvullen, nooit overschrijven wat al vastligt.
      bestaand.website = bestaand.website || p.website;
      bestaand.kvk = bestaand.kvk || p.kvk || "";
      bestaand.rollen = Array.from(new Set([...bestaand.rollen, ...p.rollen]));
      bestaand.omschrijving = bestaand.omschrijving || p.omschrijving;
      bestaand.tags = Array.from(new Set([...bestaand.tags, ...p.tags]));
      factoren.forEach((f) => {
        if (!bestaand.factoren.some((x) => x.factorId === f.factorId && (x.optieId ?? "") === (f.optieId ?? ""))) bestaand.factoren.push(f);
      });
      bestaand.bronnen.push({ url: bronnaam, opgehaaldOp: nu.slice(0, 10), soort: "import" });
      bestaand.brongegevens = [...(bestaand.brongegevens ?? []), ...p.ruweRijen.map((r) => ({ bron: bronnaam, op: nu.slice(0, 10), titel: r.titel, velden: r.velden }))];
      bestaand.bijgewerktOp = nu;
      uitkomst.bijgewerkt++;
      return;
    }
    if (!geo) uitkomst.zonderLocatie++;
    db.partners.push({
      id: nieuwId("p", p.naam),
      naam: p.naam,
      kvk: p.kvk ?? "",
      rechtsvorm: p.naam.match(/\bB\.?V\.?\b/i) ? "B.V." : p.naam.match(/\bN\.?V\.?\b/i) ? "N.V." : "Onbekend",
      vestigingsplaats: p.plaats ?? "",
      locatie: geo ?? { lat: 52.15, lng: 5.38 },
      werkgebiedKm: 150,
      status: "bekend",
      rollen: p.rollen,
      website: p.website,
      omschrijving: p.omschrijving,
      referenties: p.referenties,
      medewerkers: p.medewerkers,
      omzet: p.omzet,
      beschikbaarheid: [],
      factoren,
      certificaten: [],
      contactpersonen: [],
      kwalificatie: [],
      bronnen: [{ url: bronnaam, opgehaaldOp: nu.slice(0, 10), soort: "import" }, ...p.bronvermelding.map((b) => ({ url: b, opgehaaldOp: nu.slice(0, 10), soort: "bronvermelding" }))],
      brongegevens: p.ruweRijen.map((r) => ({ bron: bronnaam, op: nu.slice(0, 10), titel: r.titel, velden: r.velden })),
      tags: [...p.tags, ...(geo ? [] : ["locatie onbekend"])],
      aangemaaktOp: nu,
      bijgewerktOp: nu
    });
    uitkomst.nieuw++;
  });
  return uitkomst;
}
