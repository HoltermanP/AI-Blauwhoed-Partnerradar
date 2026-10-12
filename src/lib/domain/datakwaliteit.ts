// B8: datakwaliteit per veld (factor) en per partnertype (rol): volledigheid, actualiteit en betrouwbaarheid.
import { basisveldWaarde, effectieveBasisStatus, effectieveStatus } from "./herkomst";
import { goudstandaardVoor, goudstandaardVoorPartner, veldGevuld, veldnaam } from "./goudstandaard";
import { ROLLEN } from "./types";
import type { BasisVeld, Database, Factor, FactorWaardeStatus, Partner, Rol } from "./types";

export type VeldKwaliteit = {
  factorId: string;
  naam: string;
  categorie: string;
  relevant: number;
  metWaarde: number;
  pctVolledig: number;
  pctVerouderd: number;
  pctGevalideerd: number;
  gemBetrouwbaarheid: number | null;
  /** US-53: aantal partners waarvoor bij verrijking geen betrouwbare bron is gevonden. */
  geenBron: number;
};

/** Kwaliteit per veld, optioneel beperkt tot één rol (partnertype). */
export function veldKwaliteit(db: Database, rol?: Rol, nu = new Date()): VeldKwaliteit[] {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && p.status !== "concept" && (!rol || p.rollen.includes(rol)));
  return db.factoren
    .filter((f) => f.actief && !f.afgeleid)
    .map((f) => {
      const relevant = partners.filter((p) => f.rollen.length === 0 || p.rollen.some((r) => f.rollen.includes(r)));
      const met = relevant.map((p) => p.factoren.filter((x) => x.factorId === f.id)).filter((xs) => xs.length > 0);
      const waarden = met.flat();
      const verouderd = waarden.filter((x) => effectieveStatus(x, f, nu) === "verouderd").length;
      const gevalideerd = waarden.filter((x) => effectieveStatus(x, f, nu) === "gevalideerd").length;
      return {
        factorId: f.id,
        naam: f.naam,
        categorie: f.categorie,
        relevant: relevant.length,
        metWaarde: met.length,
        pctVolledig: relevant.length ? Math.round((met.length / relevant.length) * 100) : 0,
        pctVerouderd: waarden.length ? Math.round((verouderd / waarden.length) * 100) : 0,
        pctGevalideerd: waarden.length ? Math.round((gevalideerd / waarden.length) * 100) : 0,
        gemBetrouwbaarheid: waarden.length ? Math.round((waarden.reduce((s, x) => s + x.betrouwbaarheid, 0) / waarden.length) * 100) : null,
        geenBron: relevant.filter((p) => Object.keys(p.geenBron ?? {}).some((k) => k === `factor:${f.id}` || k.startsWith(`factor:${f.id}/`))).length
      };
    })
    .sort((a, b) => a.pctVolledig - b.pctVolledig);
}

/** Basisvelden (naam/kvk/plaats/website/omschrijving) — volledigheid over het bestand. */
export function basisVeldKwaliteit(db: Database, rol?: Rol) {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && p.status !== "concept" && (!rol || p.rollen.includes(rol)));
  const pct = (n: number) => (partners.length ? Math.round((n / partners.length) * 100) : 0);
  const extra = (veld: BasisVeld) => ({
    gevalideerd: pct(partners.filter((p) => basisveldWaarde(p, veld) && p.veldHerkomst?.[veld]?.status === "gevalideerd").length),
    geenBron: partners.filter((p) => p.geenBron?.[`basis:${veld}`]).length
  });
  return [
    { veld: "KVK-nummer", pct: pct(partners.filter((p) => p.kvk).length), ...extra("kvk") },
    { veld: "Vestigingsplaats", pct: pct(partners.filter((p) => p.vestigingsplaats).length), ...extra("vestigingsplaats") },
    { veld: "Website", pct: pct(partners.filter((p) => p.website).length), ...extra("website") },
    { veld: "Omschrijving", pct: pct(partners.filter((p) => p.omschrijving.length >= 40).length), ...extra("omschrijving") },
    { veld: "Referenties", pct: pct(partners.filter((p) => p.referenties.length).length), gevalideerd: 0, geenBron: 0 }
  ];
}

export type StatusVerdeling = { gevalideerd: number; voorgesteld: number; verouderd: number; afgewezen: number; totaal: number };

/** US-66: verdeling gevalideerd / voorgesteld / verouderd over alle vastgelegde waarden (factoren én basisvelden). */
export function statusVerdeling(partners: Partner[], factoren: Factor[], nu = new Date()): StatusVerdeling {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  const v: StatusVerdeling = { gevalideerd: 0, voorgesteld: 0, verouderd: 0, afgewezen: 0, totaal: 0 };
  partners.forEach((p) => {
    p.factoren.forEach((pf) => {
      const st = effectieveStatus(pf, fmap.get(pf.factorId), nu);
      if (!st) return;
      v[st]++;
      v.totaal++;
    });
    Object.entries(p.veldHerkomst ?? {}).forEach(([veld, h]) => {
      if (!h || !basisveldWaarde(p, veld as BasisVeld)) return;
      v[h.status]++;
      v.totaal++;
    });
  });
  return v;
}

/** Status van een partner voor de filter "waardestatus": heeft hij minstens één waarde met deze status? */
export function heeftWaardeStatus(p: Partner, status: FactorWaardeStatus, factoren: Factor[], nu = new Date()) {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  return p.factoren.some((pf) => effectieveStatus(pf, fmap.get(pf.factorId), nu) === status) || Object.entries(p.veldHerkomst ?? {}).some(([veld, h]) => h?.status === status && basisveldWaarde(p, veld as BasisVeld));
}

// ---------- US-02: vullingsgraad van de verplichte goudstandaardvelden per partnertype en per veld ----------
export type VeldVulling = { sleutel: string; naam: string; niveau: "verplicht" | "gewenst"; gevuld: number; totaal: number; pct: number };
export type RolVulling = { rol: Rol; partners: number; verplichtPct: number | null; gewenstPct: number | null; onvolledig: number; velden: VeldVulling[] };

export function vullingPerRol(db: Database, partners: Partner[], rollen: Rol[] = ROLLEN): RolVulling[] {
  return rollen
    .map((rol) => {
      const lijst = partners.filter((p) => p.rollen.includes(rol));
      const velden = goudstandaardVoor(db, rol).velden.map((v) => {
        const gevuld = lijst.filter((p) => veldGevuld(p, v.sleutel)).length;
        return { sleutel: v.sleutel, naam: veldnaam(v.sleutel, db.factoren), niveau: v.niveau, gevuld, totaal: lijst.length, pct: lijst.length ? Math.round((gevuld / lijst.length) * 100) : 0 };
      });
      const pct = (niveau: "verplicht" | "gewenst") => {
        const vs = velden.filter((v) => v.niveau === niveau);
        const totaal = vs.reduce((s, v) => s + v.totaal, 0);
        return totaal ? Math.round((vs.reduce((s, v) => s + v.gevuld, 0) / totaal) * 100) : null;
      };
      const verplicht = velden.filter((v) => v.niveau === "verplicht");
      const onvolledig = lijst.filter((p) => verplicht.some((v) => !veldGevuld(p, v.sleutel))).length;
      return { rol, partners: lijst.length, verplichtPct: pct("verplicht"), gewenstPct: pct("gewenst"), onvolledig, velden: velden.sort((a, b) => (a.niveau === b.niveau ? a.pct - b.pct : a.niveau === "verplicht" ? -1 : 1)) };
    })
    .filter((r) => r.partners > 0);
}

// ---------- US-03: signalen voor ontbrekende, verouderde en onbetrouwbare waarden ----------
export type DataSignaalSoort = "ontbreekt" | "verouderd" | "onbetrouwbaar";
export const DATASIGNAAL_LABEL: Record<DataSignaalSoort, string> = { ontbreekt: "Ontbreekt (verplicht)", verouderd: "Verouderd", onbetrouwbaar: "Te weinig betrouwbaar" };

export type DataSignaal = {
  soort: DataSignaalSoort;
  partnerId: string;
  partnerNaam: string;
  rollen: Rol[];
  /** `basis:<veld>` of `factor:<id>` (zonder optie, zodat filteren per veld werkt). */
  sleutel: string;
  veld: string;
  detail: string;
  waarde?: string;
  betrouwbaarheid?: number;
  datum?: string;
};

export const STANDAARD_BETROUWBAARHEID_DREMPEL = 0.5;

export function dataSignalen(db: Database, partners: Partner[], nu = new Date()): DataSignaal[] {
  const fmap = new Map(db.factoren.map((f) => [f.id, f]));
  const drempel = db.instellingen.betrouwbaarheidDrempel ?? STANDAARD_BETROUWBAARHEID_DREMPEL;
  const verval = db.instellingen.basisveldVerval ?? {};
  const uit: DataSignaal[] = [];
  partners.forEach((p) => {
    const basis = { partnerId: p.id, partnerNaam: p.naam, rollen: p.rollen };
    // Ontbrekende verplichte velden volgens de goudstandaard van het partnertype.
    goudstandaardVoorPartner(p, db)
      .filter((r) => r.niveau === "verplicht" && !r.gevuld)
      .forEach((r) => uit.push({ ...basis, soort: "ontbreekt", sleutel: r.sleutel, veld: r.naam, detail: `Verplicht voor ${r.rollen.join(", ")}${r.geenBron ? "; bij de laatste verrijking geen betrouwbare bron gevonden" : ""}.` }));
    // Factorwaarden: verouderd (vervaltermijn) of onbetrouwbaar (niet door een mens bevestigd en onder de drempel).
    p.factoren.forEach((pf) => {
      const f = fmap.get(pf.factorId);
      if (!f || pf.afgeleid) return;
      const st = effectieveStatus(pf, f, nu);
      const veld = pf.optieId ? `${f.naam}: ${f.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}` : f.naam;
      const w = Array.isArray(pf.waarde) ? pf.waarde.join(", ") : typeof pf.waarde === "object" ? `${pf.waarde.min}–${pf.waarde.max}` : String(pf.waarde);
      if (st === "verouderd") uit.push({ ...basis, soort: "verouderd", sleutel: `factor:${f.id}`, veld, waarde: w, datum: pf.peildatum, betrouwbaarheid: pf.betrouwbaarheid, detail: f.vervalMaanden ? `Peildatum ${pf.peildatum}; verouderingstermijn ${f.vervalMaanden} maanden.` : `Door een mens als verouderd gemarkeerd (peildatum ${pf.peildatum}).` });
      else if (st === "voorgesteld" && pf.betrouwbaarheid < drempel) uit.push({ ...basis, soort: "onbetrouwbaar", sleutel: `factor:${f.id}`, veld, waarde: w, datum: pf.peildatum, betrouwbaarheid: pf.betrouwbaarheid, detail: `Betrouwbaarheid ${Math.round(pf.betrouwbaarheid * 100)}% (drempel ${Math.round(drempel * 100)}%), nog niet geverifieerd. Bron: ${pf.bron}.` });
    });
    // Basisvelden met herkomst.
    (Object.keys(p.veldHerkomst ?? {}) as BasisVeld[]).forEach((veld) => {
      const h = p.veldHerkomst?.[veld];
      const w = basisveldWaarde(p, veld);
      if (!h || !w) return;
      const st = effectieveBasisStatus(h, verval[veld], nu);
      const naam = veldnaam(`basis:${veld}`, db.factoren);
      if (st === "verouderd") uit.push({ ...basis, soort: "verouderd", sleutel: `basis:${veld}`, veld: naam, waarde: w.slice(0, 80), datum: h.vastgesteldOp, betrouwbaarheid: h.betrouwbaarheid, detail: `Vastgesteld ${h.vastgesteldOp}; verouderingstermijn ${verval[veld] ?? "–"} maanden.` });
      else if (st === "voorgesteld" && h.betrouwbaarheid < drempel) uit.push({ ...basis, soort: "onbetrouwbaar", sleutel: `basis:${veld}`, veld: naam, waarde: w.slice(0, 80), datum: h.vastgesteldOp, betrouwbaarheid: h.betrouwbaarheid, detail: `Betrouwbaarheid ${Math.round(h.betrouwbaarheid * 100)}% (drempel ${Math.round(drempel * 100)}%), nog niet geverifieerd. Bron: ${h.bron}.` });
    });
  });
  return uit;
}

export function filterSignalen(signalen: DataSignaal[], f: { soort?: DataSignaalSoort; rol?: Rol; veld?: string }) {
  return signalen.filter((s) => (!f.soort || s.soort === f.soort) && (!f.rol || s.rollen.includes(f.rol)) && (!f.veld || s.sleutel === f.veld));
}

// ---------- US-08: werklijst beheerdersvalidatie ----------
export type ValidatieItem = { partnerId: string; partnerNaam: string; rollen: Rol[]; sleutel: string; veld: string; factorId?: string; optieId?: string; basisveld?: BasisVeld; waarde: string; bron: string; bronDetail?: string; betrouwbaarheid: number; door?: string; op?: string };

/** Waarden van velden die per partnertype een beheerdersverificatie vragen en die (nog) alleen door een gebruiker zijn geverifieerd. */
export function wachtOpBeheerder(db: Database, partners: Partner[]): ValidatieItem[] {
  const uit: ValidatieItem[] = [];
  partners.forEach((p) => {
    const sleutels = new Set(p.rollen.flatMap((rol) => goudstandaardVoor(db, rol).velden.filter((v) => v.beheerderVerificatie).map((v) => v.sleutel)));
    if (!sleutels.size) return;
    const basis = { partnerId: p.id, partnerNaam: p.naam, rollen: p.rollen };
    p.factoren.forEach((pf) => {
      const sleutel = `factor:${pf.factorId}`;
      if (!sleutels.has(sleutel) || pf.afgeleid || pf.status !== "gevalideerd" || pf.gevalideerdDoorRol === "beheerder") return;
      const f = db.factoren.find((x) => x.id === pf.factorId);
      const veld = f ? (pf.optieId ? `${f.naam}: ${f.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}` : f.naam) : pf.factorId;
      const waarde = Array.isArray(pf.waarde) ? pf.waarde.join(", ") : typeof pf.waarde === "object" ? `${pf.waarde.min}–${pf.waarde.max}` : String(pf.waarde);
      uit.push({ ...basis, sleutel, veld, factorId: pf.factorId, optieId: pf.optieId, waarde, bron: pf.bron, bronDetail: pf.bewijs?.ref, betrouwbaarheid: pf.betrouwbaarheid, door: pf.gevalideerdDoor, op: pf.gevalideerdOp });
    });
    (Object.keys(p.veldHerkomst ?? {}) as BasisVeld[]).forEach((veld) => {
      const sleutel = `basis:${veld}`;
      const h = p.veldHerkomst?.[veld];
      const w = basisveldWaarde(p, veld);
      if (!sleutels.has(sleutel) || !h || !w || h.status !== "gevalideerd" || h.gevalideerdDoorRol === "beheerder") return;
      uit.push({ ...basis, sleutel, veld: veldnaam(sleutel, db.factoren), basisveld: veld, waarde: w.slice(0, 120), bron: h.bron, bronDetail: h.bronDetail, betrouwbaarheid: h.betrouwbaarheid, door: h.gevalideerdDoor, op: h.gevalideerdOp });
    });
  });
  return uit;
}
