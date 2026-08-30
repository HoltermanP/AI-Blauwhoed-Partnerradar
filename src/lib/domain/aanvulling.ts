// Aanvullende dataset (src/data/aanvulling-seed.json): echte partners, Blauwhoed-projecten en betrokkenheden, samengesteld uit
// openbare webbronnen (websites, persberichten, projectpagina's). Wordt bij eerste start geladen en is herlaadbaar via Beheer;
// bestaande partners worden alleen aangevuld (website, KVK, plaats, omschrijving, referenties), nooit overschreven.
import aanvulling from "@/data/aanvulling-seed.json";
import { geocode } from "./geo";
import { normaliseerNaam } from "./discovery";
import type { Bouwstijl, Database, Engagement, Geo, Partner, PartnerFactor, Prijssegment, Project, Projectfase, Projecttype, Rol } from "./types";

type AanvullingPartner = {
  naam: string;
  kvk?: string;
  rechtsvorm?: string;
  vestigingsplaats: string;
  adres?: string;
  website: string;
  rollen: Rol[];
  omschrijving: string;
  referenties?: string[];
  medewerkers?: number;
  certificaten?: string[];
  kenmerken?: string[];
  blauwhoedRelatie?: string;
  bronUrl: string;
};
type AanvullingProject = {
  naam: string;
  plaats: string;
  adres?: string;
  type: Projecttype;
  woningen: number;
  prijssegment: Prijssegment[];
  bouwstijl: Bouwstijl;
  ambitieDuurzaamheid: 1 | 2 | 3 | 4 | 5;
  fase: Projectfase;
  start: string;
  eind: string;
  omschrijving: string;
  partners?: Array<{ naam: string; rol: Rol }>;
  bronUrl: string;
  opmerking?: string;
};
type AanvullingWebsite = { naam: string; website: string; vestigingsplaats?: string; kvk?: string; omschrijving?: string };
export type AanvullingData = { bron: string; peildatum: string; partners: AanvullingPartner[]; projecten: AanvullingProject[]; websites: AanvullingWebsite[] };

export const AANVULLING = aanvulling as AanvullingData;

/** Kenmerktrefwoorden → factorwaarden (bron web, lage betrouwbaarheid; niveau 3 = aantoonbare ervaring volgens openbare bron). */
const KENMERK_FACTOR: Record<string, { factorId: string; optieId?: string; waarde: number | boolean }> = {
  houtbouw: { factorId: "bouwsysteem", optieId: "houtbouw", waarde: 3 },
  clt: { factorId: "bouwsysteem", optieId: "houtbouw", waarde: 4 },
  hsb: { factorId: "bouwsysteem", optieId: "houtbouw", waarde: 3 },
  prefab: { factorId: "prefabricage", waarde: 3 },
  modulair: { factorId: "prefabricage", waarde: 4 },
  biobased: { factorId: "biobased", waarde: 30 },
  circulair: { factorId: "circulariteit", waarde: 3 },
  demontabel: { factorId: "demontabel", waarde: 3 },
  natuurinclusief: { factorId: "natuurinclusief", waarde: 3 },
  hoogbouw: { factorId: "projecttype", optieId: "hoogbouw", waarde: 3 },
  transformatie: { factorId: "projecttype", optieId: "transformatie", waarde: 3 },
  zorgwonen: { factorId: "projecttype", optieId: "zorgwonen", waarde: 3 },
  bim: { factorId: "bim", waarde: 3 },
  bouwteam: { factorId: "bouwteam", waarde: 3 }
};

export function aanvullingPlaatsen(): string[] {
  return Array.from(new Set([...AANVULLING.partners.map((p) => p.vestigingsplaats), ...AANVULLING.projecten.map((p) => p.plaats), ...AANVULLING.websites.map((w) => w.vestigingsplaats ?? "")].filter(Boolean)));
}

function vindPartner(db: Database, naam: string) {
  const n = normaliseerNaam(naam);
  return db.partners.find((p) => normaliseerNaam(p.naam) === n) ?? db.partners.find((p) => normaliseerNaam(p.naam).startsWith(n) || n.startsWith(normaliseerNaam(p.naam)));
}

export type AanvullingUitkomst = { partnersNieuw: number; partnersAangevuld: number; projectenNieuw: number; engagementsNieuw: number; websitesAangevuld: number };

/** Pure functie: voegt de aanvulling toe aan de database. `locaties` bevat vooraf gegeocodeerde plaatsen (PDOK); anders de lokale lijst. */
export function laadAanvulling(db: Database, locaties: Map<string, Geo | null>, nieuwId: (prefix: string) => string, nu = new Date()): AanvullingUitkomst {
  const u: AanvullingUitkomst = { partnersNieuw: 0, partnersAangevuld: 0, projectenNieuw: 0, engagementsNieuw: 0, websitesAangevuld: 0 };
  const iso = nu.toISOString();
  const vandaag = iso.slice(0, 10);
  const geo = (plaats?: string) => (plaats ? locaties.get(plaats) ?? geocode(plaats) ?? null : null);
  const bronnaam = AANVULLING.bron;
  const noteerBron = (p: Partner, url: string) => {
    if (!p.bronnen.some((b) => b.url === url && b.soort === "web-aanvulling")) p.bronnen.push({ url, opgehaaldOp: AANVULLING.peildatum, soort: "web-aanvulling" });
  };

  // 1. Websites, KVK en plaats van bestaande partners (alleen aanvullen).
  AANVULLING.websites.forEach((w) => {
    const p = vindPartner(db, w.naam);
    if (!p) return;
    let gewijzigd = false;
    if (!p.website && w.website) {
      p.website = w.website;
      gewijzigd = true;
    }
    if (!p.kvk && w.kvk) {
      p.kvk = w.kvk;
      gewijzigd = true;
    }
    if (!p.vestigingsplaats && w.vestigingsplaats) {
      p.vestigingsplaats = w.vestigingsplaats;
      const g = geo(w.vestigingsplaats);
      if (g) {
        p.locatie = g;
        p.tags = p.tags.filter((t) => t !== "locatie onbekend");
      }
      gewijzigd = true;
    }
    if (w.omschrijving && (!p.omschrijving || p.omschrijving.length < 40)) {
      p.omschrijving = [w.omschrijving, p.omschrijving].filter(Boolean).join(" ");
      gewijzigd = true;
    }
    if (gewijzigd) {
      noteerBron(p, w.website);
      p.bijgewerktOp = iso;
      u.websitesAangevuld++;
    }
  });

  // 2. Aanvullende partners.
  AANVULLING.partners.forEach((a) => {
    const factoren: PartnerFactor[] = [];
    (a.kenmerken ?? []).forEach((k) => {
      const m = KENMERK_FACTOR[k];
      if (!m) return;
      const idx = factoren.findIndex((f) => f.factorId === m.factorId && (f.optieId ?? "") === (m.optieId ?? ""));
      const record: PartnerFactor = { factorId: m.factorId, optieId: m.optieId, waarde: m.waarde, bron: "web", betrouwbaarheid: 0.5, peildatum: AANVULLING.peildatum, bewijs: { soort: "url", ref: a.bronUrl, label: a.bronUrl }, toelichting: `geclaimd: kenmerk '${k}' op openbare bron` };
      if (idx < 0) factoren.push(record);
      else if (typeof m.waarde === "number" && m.waarde > Number(factoren[idx].waarde)) factoren[idx] = record;
    });
    if (a.medewerkers) factoren.push({ factorId: "organisatieomvang", waarde: a.medewerkers, bron: "web", betrouwbaarheid: 0.5, peildatum: AANVULLING.peildatum, bewijs: { soort: "url", ref: a.bronUrl, label: a.bronUrl } });
    const tags = [...(a.certificaten ?? []).map((c) => `certificaat:${c}`), ...(a.kenmerken ?? []), ...(a.blauwhoedRelatie ? ["blauwhoed-relatie"] : [])];
    const bestaand = (a.kvk && db.partners.find((p) => p.kvk === a.kvk)) || vindPartner(db, a.naam);
    if (bestaand) {
      bestaand.website = bestaand.website || a.website;
      bestaand.kvk = bestaand.kvk || a.kvk || "";
      bestaand.vestigingsplaats = bestaand.vestigingsplaats || a.vestigingsplaats;
      if (!bestaand.vestigingsplaats || bestaand.tags.includes("locatie onbekend")) {
        const g = geo(a.vestigingsplaats);
        if (g) {
          bestaand.locatie = g;
          bestaand.tags = bestaand.tags.filter((t) => t !== "locatie onbekend");
        }
      }
      bestaand.rollen = Array.from(new Set([...bestaand.rollen, ...a.rollen]));
      bestaand.omschrijving = bestaand.omschrijving.length >= 40 ? bestaand.omschrijving : [a.omschrijving, bestaand.omschrijving].filter(Boolean).join(" ");
      bestaand.referenties = Array.from(new Set([...bestaand.referenties, ...(a.referenties ?? [])]));
      bestaand.medewerkers = bestaand.medewerkers ?? a.medewerkers;
      bestaand.tags = Array.from(new Set([...bestaand.tags, ...tags]));
      factoren.forEach((f) => {
        if (!bestaand.factoren.some((x) => x.factorId === f.factorId && (x.optieId ?? "") === (f.optieId ?? ""))) bestaand.factoren.push(f);
      });
      if (bestaand.bronnen.some((b) => b.url === a.bronUrl && b.soort === "web-aanvulling")) return;
      noteerBron(bestaand, a.bronUrl);
      bestaand.bijgewerktOp = iso;
      u.partnersAangevuld++;
      return;
    }
    const g = geo(a.vestigingsplaats);
    const partner: Partner = {
      id: nieuwId("p"),
      naam: a.naam,
      kvk: a.kvk ?? "",
      rechtsvorm: a.rechtsvorm ?? (a.naam.match(/\bB\.?V\.?\b/i) ? "B.V." : a.naam.match(/\bN\.?V\.?\b/i) ? "N.V." : "Onbekend"),
      vestigingsplaats: a.vestigingsplaats,
      adres: a.adres,
      locatie: g ?? { lat: 52.15, lng: 5.38 },
      werkgebiedKm: a.rollen.includes("leverancier") ? 250 : 150,
      status: "bekend",
      rollen: a.rollen,
      website: a.website,
      omschrijving: [a.omschrijving, a.blauwhoedRelatie ? `Relatie met Blauwhoed: ${a.blauwhoedRelatie}` : ""].filter(Boolean).join(" "),
      referenties: a.referenties ?? [],
      medewerkers: a.medewerkers,
      beschikbaarheid: [],
      factoren,
      certificaten: [],
      contactpersonen: [],
      kwalificatie: [],
      bronnen: [{ url: a.bronUrl, opgehaaldOp: AANVULLING.peildatum, soort: "web-aanvulling" }],
      brongegevens: [{ bron: bronnaam, op: AANVULLING.peildatum, titel: "Openbare bron", velden: { Website: a.website, Bron: a.bronUrl, ...(a.certificaten?.length ? { "Certificaten (volgens website)": a.certificaten.join(", ") } : {}), ...(a.kenmerken?.length ? { Kenmerken: a.kenmerken.join(", ") } : {}), ...(a.blauwhoedRelatie ? { "Relatie Blauwhoed": a.blauwhoedRelatie } : {}) } }],
      tags: [...tags, ...(g ? [] : ["locatie onbekend"])],
      aangemaaktOp: iso,
      bijgewerktOp: iso
    };
    db.partners.push(partner);
    u.partnersNieuw++;
  });

  // 3. Projecten en betrokkenheden.
  AANVULLING.projecten.forEach((a) => {
    const n = normaliseerNaam(a.naam);
    let project = db.projecten.find((p) => normaliseerNaam(p.naam) === n);
    if (!project) {
      const g = geo(a.plaats) ?? { lat: 51.92, lng: 4.48 };
      project = {
        id: nieuwId("proj"),
        naam: a.naam,
        type: a.type,
        locatie: { ...g, plaats: a.plaats, adres: a.adres },
        woningen: a.woningen,
        prijssegment: a.prijssegment,
        bouwstijl: a.bouwstijl,
        ambitieDuurzaamheid: a.ambitieDuurzaamheid,
        planning: { start: `${a.start}-01`, eind: `${a.eind}-01` },
        fase: a.fase,
        omschrijving: [a.omschrijving, a.opmerking ? `(${a.opmerking})` : "", `Bron: ${a.bronUrl}`].filter(Boolean).join(" "),
        eisen: [],
        herkomst: [{ veld: "omschrijving", citaat: a.bronUrl, betrouwbaarheid: 0.6 }],
        aangemaaktOp: iso,
        bijgewerktOp: iso
      };
      db.projecten.push(project);
      u.projectenNieuw++;
    }
    (a.partners ?? []).forEach((b) => {
      const p = vindPartner(db, b.naam);
      if (!p || db.engagements.some((e) => e.partnerId === p.id && e.projectId === project!.id)) return;
      const eng: Engagement = {
        id: nieuwId("eng"),
        partnerId: p.id,
        projectId: project!.id,
        rol: b.rol,
        periode: { van: `${a.start}-01`, tot: a.fase === "opgeleverd" || a.fase === "nazorg" ? `${a.eind}-01` : undefined },
        contractwaarde: 0,
        geplandeOplevering: `${a.eind}-01`,
        werkelijkeOplevering: a.fase === "opgeleverd" || a.fase === "nazorg" ? `${a.eind}-01` : undefined,
        bron: "handmatig"
      };
      db.engagements.push(eng);
      if (!p.rollen.includes(b.rol)) p.rollen.push(b.rol);
      const ref = `${a.naam}, ${a.plaats} (${a.woningen} woningen, Blauwhoed)`;
      if (!p.referenties.some((r) => r.startsWith(a.naam))) p.referenties.push(ref);
      if (!p.tags.includes("blauwhoed-relatie")) p.tags.push("blauwhoed-relatie");
      u.engagementsNieuw++;
    });
  });

  db.audit.unshift({ id: nieuwId("audit"), op: iso, door: "systeem", gebruikersrol: "beheerder", entiteit: "database", entiteitId: "aanvulling", actie: "aanvullende dataset geladen", details: `${u.partnersNieuw} nieuwe partners, ${u.partnersAangevuld} aangevuld, ${u.websitesAangevuld} websites, ${u.projectenNieuw} projecten, ${u.engagementsNieuw} betrokkenheden uit ${bronnaam} (peildatum ${AANVULLING.peildatum}; vandaag ${vandaag})` });
  return u;
}
