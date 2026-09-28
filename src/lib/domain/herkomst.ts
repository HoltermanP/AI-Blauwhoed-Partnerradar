// Dwarsdoorsnijdende eis 1: herkomst en status per veldwaarde.
// - alleen een mens valideert (acties zetten status 'gevalideerd' met naam en datum);
// - 'verouderd' wordt hier berekend uit peildatum + de per factor ingestelde vervaltermijn;
// - herkomst is per partner exporteerbaar en verwijderbaar (AVG).
import { BASISVELD_LABEL, BRON_BETROUWBAARHEID, BRON_LABEL, BRON_RANG } from "./types";
import type { BasisVeld, Bron, EnrichmentVoorstel, Factor, FactorWaardeStatus, Partner, PartnerFactor, VeldHerkomst } from "./types";

// ---------- US-51: één centrale mapping van numerieke betrouwbaarheid naar hoog/midden/laag ----------
export type BetrouwbaarheidNiveau = "hoog" | "midden" | "laag";

export function betrouwbaarheidNiveau(n: number | undefined | null): BetrouwbaarheidNiveau {
  const v = n ?? 0;
  return v >= 0.7 ? "hoog" : v >= 0.45 ? "midden" : "laag";
}

// ---------- US-50: bronrangorde (art. 11.2) ----------
export const INDICATIEF_LABEL = "indicatief – niet gevalideerd";

export const RANG_LABEL: Record<1 | 2 | 3, string> = {
  1: "Goudstandaard en eigen uitgaven Blauwhoed",
  2: "Aangeleverd, projecthistorie of gevalideerde registratie",
  3: INDICATIEF_LABEL
};

/** Onbekende (oude) bronwaarden vallen in de laagste rang. */
export function bronRang(bron: string | undefined): 1 | 2 | 3 {
  return BRON_RANG[bron as Bron] ?? 3;
}

export function isIndicatief(bron: string | undefined) {
  return bronRang(bron) === 3;
}

export function isGoudstandaard(bron: string | undefined) {
  return bronRang(bron) === 1;
}

/** Leesbaar bronlabel, met het label "indicatief – niet gevalideerd" voor rang 3. */
export function bronTekst(bron: string | undefined) {
  const label = BRON_LABEL[bron as Bron] ?? bron ?? "onbekend";
  return isIndicatief(bron) ? `${label} (${INDICATIEF_LABEL})` : label;
}

/** Vergelijk twee herkomsten: negatief = a gaat voor. Eerst rang, dan betrouwbaarheid. */
export function vergelijkHerkomst(a: { bron: string; betrouwbaarheid: number }, b: { bron: string; betrouwbaarheid: number }) {
  return bronRang(a.bron) - bronRang(b.bron) || b.betrouwbaarheid - a.betrouwbaarheid;
}

// ---------- US-52: herkomst en status voor basisvelden ----------
export const BASISVELDEN_LIJST = Object.keys(BASISVELD_LABEL) as BasisVeld[];

export function basisveldWaarde(p: Partner, veld: BasisVeld): string {
  if (veld === "sbiActiviteiten") return (p.sbiActiviteiten ?? []).map((s) => `${s.code} ${s.omschrijving}`).join("; ");
  if (veld === "rechtsvorm") return p.rechtsvorm && p.rechtsvorm !== "Onbekend" ? p.rechtsvorm : "";
  const w = p[veld];
  return typeof w === "string" ? w : "";
}

/** Herkomst van een basisveld; een leeg veld heeft geen herkomst. */
export function basisveldHerkomst(p: Partner, veld: BasisVeld): VeldHerkomst | undefined {
  if (!basisveldWaarde(p, veld)) return undefined;
  return p.veldHerkomst?.[veld];
}

export function zetBasisveldHerkomst(p: Partner, veld: BasisVeld, h: Omit<VeldHerkomst, "betrouwbaarheid"> & { betrouwbaarheid?: number }) {
  p.veldHerkomst = p.veldHerkomst ?? {};
  p.veldHerkomst[veld] = { ...h, betrouwbaarheid: h.betrouwbaarheid ?? BRON_BETROUWBAARHEID[h.bron] };
  // Een gevuld veld is niet langer "zonder betrouwbare bron".
  if (p.geenBron) delete p.geenBron[geenBronSleutel({ basisveld: veld })];
}

/** Handmatige vaststelling van basisvelden door een mens: gewijzigde velden krijgen bron 'opgave' en status gevalideerd. */
export function registreerHandmatigeBasisvelden(p: Partner, voor: Partial<Record<BasisVeld, string>>, door: string, nu = new Date()) {
  const dag = nu.toISOString().slice(0, 10);
  BASISVELDEN_LIJST.forEach((veld) => {
    const nieuw = basisveldWaarde(p, veld);
    if (!nieuw) {
      if (p.veldHerkomst) delete p.veldHerkomst[veld];
      return;
    }
    if (nieuw === (voor[veld] ?? "") && p.veldHerkomst?.[veld]) return; // ongewijzigd: herkomst blijft
    zetBasisveldHerkomst(p, veld, { bron: "opgave", bronDetail: "handmatige invoer", vastgesteldOp: dag, status: "gevalideerd", gevalideerdDoor: door, gevalideerdOp: dag });
  });
}

export function basisveldenMomentopname(p: Partner): Partial<Record<BasisVeld, string>> {
  return Object.fromEntries(BASISVELDEN_LIJST.map((v) => [v, basisveldWaarde(p, v)]));
}

// ---------- US-53: "geen betrouwbare bron" ----------
export function geenBronSleutel(x: { basisveld?: BasisVeld; factorId?: string; optieId?: string }) {
  return x.basisveld ? `basis:${x.basisveld}` : `factor:${x.factorId}${x.optieId ? `/${x.optieId}` : ""}`;
}

export function markeerGeenBron(p: Partner, sleutel: string, doorzocht: string[], nu = new Date()) {
  p.geenBron = p.geenBron ?? {};
  p.geenBron[sleutel] = { op: nu.toISOString().slice(0, 10), doorzocht: Array.from(new Set(doorzocht.filter(Boolean))).slice(0, 12) };
}

export function wisGeenBron(p: Partner, sleutel: string) {
  if (p.geenBron) delete p.geenBron[sleutel];
}

export function aantalGeenBron(p: Partner) {
  return Object.keys(p.geenBron ?? {}).length;
}

/** Leesbare naam van een geen-bron-sleutel. */
export function geenBronVeldnaam(sleutel: string, factoren: Factor[]) {
  if (sleutel.startsWith("basis:")) return BASISVELD_LABEL[sleutel.slice(6) as BasisVeld] ?? sleutel.slice(6);
  const [fid, optie] = sleutel.slice(7).split("/");
  const f = factoren.find((x) => x.id === fid);
  const o = optie ? f?.opties?.find((x) => x.id === optie)?.label ?? optie : undefined;
  return f ? (o ? `${f.naam}: ${o}` : f.naam) : sleutel;
}

// ---------- US-49/US-50: conflicterende voorstellen ----------
/**
 * Markeer per partner en veld welk voorstel voorgaat: de hoogste bronrang wint, lagere voorstellen worden 'alternatief'.
 * Een voorstel dat lager scoort dan de huidige waarde is ook een alternatief; bij een huidige goudstandaardwaarde
 * (rang 1) zet AI er hooguit een voorstel naast (goudstandaardGaatVoor).
 */
export function markeerAlternatieven(voorstellen: EnrichmentVoorstel[], huidigeHerkomst: (v: EnrichmentVoorstel) => { bron: string; betrouwbaarheid: number } | undefined) {
  const groepen = new Map<string, EnrichmentVoorstel[]>();
  voorstellen
    .filter((v) => v.status === "open" && v.aard !== "niet_bevestigd")
    .forEach((v) => {
      const k = `${v.partnerId}|${v.veld}`;
      groepen.set(k, [...(groepen.get(k) ?? []), v]);
    });
  groepen.forEach((lijst) => {
    const gesorteerd = [...lijst].sort(vergelijkHerkomst);
    gesorteerd.forEach((v, i) => {
      const huidig = huidigeHerkomst(v);
      const lagerDanHuidig = huidig ? vergelijkHerkomst(v, huidig) > 0 && bronRang(v.bron) > bronRang(huidig.bron) : false;
      v.goudstandaardGaatVoor = huidig ? isGoudstandaard(huidig.bron) && !isGoudstandaard(v.bron) : false;
      v.alternatief = (i > 0 && bronRang(v.bron) > bronRang(gesorteerd[0].bron)) || lagerDanHuidig || v.goudstandaardGaatVoor || undefined;
    });
  });
}

/** Effectieve status van een waarde: expliciete status, automatisch 'verouderd' na de vervaltermijn van de factor. */
export function effectieveStatus(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()): FactorWaardeStatus | undefined {
  if (pf.afgeleid) return undefined; // berekende waarden hebben geen validatiestatus
  const basis = pf.status ?? "voorgesteld";
  if (basis !== "verouderd" && factor?.vervalMaanden && pf.peildatum) {
    const grens = new Date(nu);
    grens.setMonth(grens.getMonth() - factor.vervalMaanden);
    if (new Date(pf.peildatum) < grens) return "verouderd";
  }
  return basis;
}

export function isVerouderd(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()) {
  return effectieveStatus(pf, factor, nu) === "verouderd";
}

export const STATUS_WAARDE_LABEL: Record<FactorWaardeStatus, string> = { voorgesteld: "voorgesteld", gevalideerd: "gevalideerd", verouderd: "verouderd" };

/** AVG: alle herkomstinformatie van één partner als exporteerbaar object. */
export function herkomstExport(partner: Partner, factoren: Factor[], nu = new Date()) {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  return {
    partner: { id: partner.id, naam: partner.naam, kvk: partner.kvk },
    geexporteerdOp: nu.toISOString(),
    waarden: partner.factoren.map((pf) => {
      const f = fmap.get(pf.factorId);
      return {
        veld: f ? (pf.optieId ? `${f.naam}: ${f.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}` : f.naam) : pf.factorId,
        waarde: pf.waarde,
        bron: pf.bron,
        bronDetail: pf.bewijs ? { soort: pf.bewijs.soort, referentie: pf.bewijs.ref, label: pf.bewijs.label } : null,
        vastgesteldOp: pf.peildatum,
        bronCategorie: RANG_LABEL[bronRang(pf.bron)],
        betrouwbaarheid: betrouwbaarheidNiveau(pf.betrouwbaarheid),
        status: effectieveStatus(pf, f, nu) ?? "afgeleid",
        gevalideerdDoor: pf.gevalideerdDoor ?? null,
        gevalideerdOp: pf.gevalideerdOp ?? null,
        toelichting: pf.toelichting ?? null
      };
    }),
    basisvelden: BASISVELDEN_LIJST.filter((v) => basisveldWaarde(partner, v)).map((v) => {
      const h = partner.veldHerkomst?.[v];
      return { veld: BASISVELD_LABEL[v], waarde: basisveldWaarde(partner, v), bron: h?.bron ?? null, bronCategorie: h ? RANG_LABEL[bronRang(h.bron)] : null, bronDetail: h?.bronDetail ?? null, vastgesteldOp: h?.vastgesteldOp ?? null, betrouwbaarheid: h ? betrouwbaarheidNiveau(h.betrouwbaarheid) : null, status: h?.status ?? "onbekend", gevalideerdDoor: h?.gevalideerdDoor ?? null, gevalideerdOp: h?.gevalideerdOp ?? null };
    }),
    geenBetrouwbareBron: Object.entries(partner.geenBron ?? {}).map(([sleutel, m]) => ({ veld: geenBronVeldnaam(sleutel, factoren), op: m.op, doorzocht: m.doorzocht })),
    bronnen: partner.bronnen,
    registratie: partner.registratie ? { door: "AI", provider: partner.registratie.provider, aangevraagdDoor: partner.registratie.aangevraagdDoor, op: partner.registratie.op, bronnen: partner.registratie.bronnen, herkomst: partner.registratie.herkomst, besluit: partner.registratie.besluit ?? "ter controle", beoordeeldDoor: partner.registratie.beoordeeldDoor ?? null, beoordeeldOp: partner.registratie.beoordeeldOp ?? null } : null,
    brongegevens: (partner.brongegevens ?? []).map((b) => ({ bron: b.bron, op: b.op, titel: b.titel ?? null, velden: b.velden }))
  };
}

/** AVG: verwijder alle herkomstinformatie van één partner. Waarden blijven staan, maar zonder bron- en bewijsdetails. */
export function wisHerkomst(partner: Partner) {
  let gewist = partner.bronnen.length + (partner.brongegevens?.length ?? 0);
  partner.bronnen = [];
  partner.brongegevens = [];
  Object.values(partner.veldHerkomst ?? {}).forEach((h) => {
    if (h?.bronDetail) {
      gewist++;
      delete h.bronDetail;
    }
  });
  if (partner.registratie) {
    gewist += partner.registratie.bronnen.length + partner.registratie.herkomst.length;
    partner.registratie.bronnen = [];
    partner.registratie.herkomst = [];
  }
  partner.factoren.forEach((pf) => {
    if (pf.bewijs || pf.toelichting) gewist++;
    delete pf.bewijs;
    delete pf.toelichting;
  });
  return gewist;
}

/** Herkomst afleiden voor basisvelden die (van vóór v3.1) nog geen herkomst hebben. Conservatief: status 'voorgesteld' tot een mens bevestigt. */
function afgeleideHerkomst(p: Partner): Pick<VeldHerkomst, "bron" | "status" | "bronDetail" | "gevalideerdDoor" | "gevalideerdOp"> {
  if (p.registratie) {
    const vrij = p.registratie.besluit === "vrijgegeven";
    return { bron: "web", status: vrij ? "gevalideerd" : "voorgesteld", bronDetail: p.registratie.bronnen[0], gevalideerdDoor: vrij ? p.registratie.beoordeeldDoor : undefined, gevalideerdOp: vrij ? p.registratie.beoordeeldOp?.slice(0, 10) : undefined };
  }
  const imp = p.bronnen.find((b) => b.soort === "import");
  if (imp) return { bron: "opgave", status: "voorgesteld", bronDetail: `import: ${imp.url}` };
  const web = p.bronnen.find((b) => /^https?:/.test(b.url));
  if (web) return { bron: "web", status: "voorgesteld", bronDetail: web.url };
  return { bron: "opgave", status: "voorgesteld", bronDetail: "vastgelegd vóór aanvulling v3.1" };
}

export function vulOntbrekendeHerkomst(p: Partner, standaard?: Pick<VeldHerkomst, "bron" | "status" | "bronDetail" | "gevalideerdDoor" | "gevalideerdOp">) {
  const h = standaard ?? afgeleideHerkomst(p);
  let n = 0;
  BASISVELDEN_LIJST.forEach((veld) => {
    if (!basisveldWaarde(p, veld) || p.veldHerkomst?.[veld]) return;
    zetBasisveldHerkomst(p, veld, { ...h, vastgesteldOp: (p.bijgewerktOp ?? p.aangemaaktOp ?? new Date().toISOString()).slice(0, 10) });
    n++;
  });
  return n;
}
