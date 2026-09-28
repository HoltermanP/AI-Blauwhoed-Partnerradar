// B8: export naar CSV (opent direct in Excel; puntkomma + BOM voor NL-instellingen).
import { basisveldWaarde, BASISVELDEN_LIJST, betrouwbaarheidNiveau, bronRang, bronTekst, effectieveStatus, geenBronVeldnaam } from "./herkomst";
import { BASISVELD_LABEL } from "./types";
import { totaalscore } from "./tevredenheid";
import { STATUS_LABEL } from "../format";
import type { Database, MatchRun } from "./types";

function cel(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function naarCsv(rijen: Array<Record<string, unknown>>): string {
  if (!rijen.length) return "";
  const kolommen = Object.keys(rijen[0]);
  return "﻿" + [kolommen.join(";"), ...rijen.map((r) => kolommen.map((k) => cel(r[k])).join(";"))].join("\r\n");
}

/** Partners in een export: nooit concepten; gearchiveerde alleen op verzoek. */
export function exportPartners(db: Database, metGearchiveerd = false) {
  return db.partners.filter((p) => (metGearchiveerd || p.status !== "gearchiveerd") && p.status !== "concept");
}

/** Partnerexport: kerngegevens + per actieve factor de waarde en status (eis 1: herkomst reist mee). */
export function partnersCsv(db: Database, metGearchiveerd = false) {
  return naarCsv(partnersRijen(db, metGearchiveerd));
}

export function partnersRijen(db: Database, metGearchiveerd = false) {
  const factoren = db.factoren.filter((f) => f.actief && !f.afgeleid);
  const partners = exportPartners(db, metGearchiveerd);
  return (
    partners.map((p) => {
      const basis: Record<string, unknown> = {
        Naam: p.naam,
        KVK: p.kvk,
        Status: STATUS_LABEL[p.status],
        Rollen: p.rollen.join(", "),
        Plaats: p.vestigingsplaats,
        Website: p.website ?? "",
        Medewerkers: p.medewerkers ?? "",
        Omzet: p.omzet ?? "",
        Certificaten: p.certificaten.map((c) => `${c.type} t/m ${c.geldigTot}`).join(" | "),
        Projecten: db.engagements.filter((e) => e.partnerId === p.id).length,
        Omschrijving: p.omschrijving.slice(0, 500),
        // US-52: herkomst per basisveld; US-53: velden zonder betrouwbare bron.
        "Herkomst basisvelden": BASISVELDEN_LIJST.filter((v) => basisveldWaarde(p, v))
          .map((v) => {
            const h = p.veldHerkomst?.[v];
            return `${BASISVELD_LABEL[v]}: ${h ? `${bronTekst(h.bron)}, ${betrouwbaarheidNiveau(h.betrouwbaarheid)}, ${h.status}, ${h.vastgesteldOp}` : "onbekend"}`;
          })
          .join(" | "),
        "Geen betrouwbare bron": Object.entries(p.geenBron ?? {}).map(([k, m]) => `${geenBronVeldnaam(k, db.factoren)} (${m.op})`).join(" | ")
      };
      factoren.forEach((f) => {
        const w = p.factoren.filter((x) => x.factorId === f.id);
        basis[f.naam] = w
          .map((x) => {
            const optie = x.optieId ? `${f.opties?.find((o) => o.id === x.optieId)?.label ?? x.optieId}: ` : "";
            return `${optie}${Array.isArray(x.waarde) ? x.waarde.join("+") : x.waarde} [${effectieveStatus(x, f) ?? "berekend"}, ${bronTekst(x.bron)}, betrouwbaarheid ${betrouwbaarheidNiveau(x.betrouwbaarheid)}, ${x.peildatum}]`;
          })
          .join(" | ");
      });
      return basis;
    })
  );
}

/**
 * US-67: alle waarden in lange vorm — per partner en per veld (basisveld of factor) de waarde met bron, bronrang,
 * status en betrouwbaarheid (hoog/midden/laag). Rang 3 draagt het label "indicatief – niet gevalideerd".
 */
export function waardenRijen(db: Database, partners = exportPartners(db)) {
  const fmap = new Map(db.factoren.map((f) => [f.id, f]));
  return partners.flatMap((p) => [
    ...BASISVELDEN_LIJST.filter((v) => basisveldWaarde(p, v)).map((v) => {
      const h = p.veldHerkomst?.[v];
      return { Partner: p.naam, KVK: p.kvk, Soort: "basisveld", Veld: BASISVELD_LABEL[v], Waarde: basisveldWaarde(p, v), Bron: h ? bronTekst(h.bron) : "onbekend", Bronrang: h ? bronRang(h.bron) : "", "Bron (detail)": h?.bronDetail ?? "", Status: h?.status ?? "onbekend", Betrouwbaarheid: h ? betrouwbaarheidNiveau(h.betrouwbaarheid) : "", "Vastgesteld op": h?.vastgesteldOp ?? "", "Gevalideerd door": h?.gevalideerdDoor ?? "", "Gevalideerd op": h?.gevalideerdOp ?? "" };
    }),
    ...p.factoren.map((pf) => {
      const f = fmap.get(pf.factorId);
      const veld = f ? (pf.optieId ? `${f.naam}: ${f.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}` : f.naam) : pf.factorId;
      return { Partner: p.naam, KVK: p.kvk, Soort: "factor", Veld: veld, Waarde: Array.isArray(pf.waarde) ? pf.waarde.join(", ") : typeof pf.waarde === "object" ? `${pf.waarde.min}–${pf.waarde.max}` : String(pf.waarde), Bron: bronTekst(pf.bron), Bronrang: bronRang(pf.bron), "Bron (detail)": pf.bewijs?.label ?? "", Status: effectieveStatus(pf, f) ?? "berekend", Betrouwbaarheid: betrouwbaarheidNiveau(pf.betrouwbaarheid), "Vastgesteld op": pf.peildatum, "Gevalideerd door": pf.gevalideerdDoor ?? "", "Gevalideerd op": pf.gevalideerdOp ?? "" };
    }),
    ...Object.entries(p.geenBron ?? {}).map(([k, m]) => ({ Partner: p.naam, KVK: p.kvk, Soort: "geen betrouwbare bron", Veld: geenBronVeldnaam(k, db.factoren), Waarde: "", Bron: `doorzocht: ${m.doorzocht.join(", ")}`, Bronrang: "", "Bron (detail)": "", Status: "geen betrouwbare bron", Betrouwbaarheid: "", "Vastgesteld op": m.op, "Gevalideerd door": "", "Gevalideerd op": "" }))
  ]);
}

/** Historie-export: engagements met evaluatiegemiddelde. */
export function historieCsv(db: Database) {
  return naarCsv(historieRijen(db));
}

export function historieRijen(db: Database) {
  return (
    db.engagements.map((e) => {
      const p = db.partners.find((x) => x.id === e.partnerId);
      const proj = db.projecten.find((x) => x.id === e.projectId);
      const ev = db.evaluaties.filter((x) => x.engagementId === e.id || (x.partnerId === e.partnerId && x.projectId === e.projectId));
      const gem = ev.length ? Math.round((ev.reduce((s, x) => s + totaalscore(x), 0) / ev.length) * 10) / 10 : "";
      return {
        Projectnummer: proj?.projectnummer ?? "",
        Partner: p?.naam ?? e.partnerId,
        Project: proj?.naam ?? e.projectId,
        Rol: e.rol,
        Van: e.periode.van,
        Tot: e.periode.tot ?? "",
        Contractwaarde: e.contractwaarde || "",
        "Geplande oplevering": e.geplandeOplevering ?? "",
        "Werkelijke oplevering": e.werkelijkeOplevering ?? "",
        Bouwsysteem: e.bouwsysteem ?? "",
        "Tevredenheid (totaal, organisatieniveau)": gem,
        "Toelichting evaluatie": ev.map((x) => [x.toelichting, x.totaalToelichting ? `bijgesteld: ${x.totaalToelichting}` : ""].filter(Boolean).join(" ")).join(" | "),
        Bron: e.bron
      };
    })
  );
}

export const MATCH_DISCLAIMER = "De matchscore is een onderbouwde eerste selectie en geen oordeel over geschiktheid, betrouwbaarheid of financiële gezondheid van een partner (art. 11.3).";

/** US-67: matchresultaten van één run — kandidaten, criteria (met bron en betrouwbaarheid) en uitsluitingen. */
export function matchRijen(run: MatchRun, db: Database) {
  const project = db.projecten.find((p) => p.id === run.projectId);
  const kandidaten = run.resultaat.flatMap((r) =>
    [...r.kandidaten.map((k, i) => ({ k, rang: i + 1, groep: "advies" })), ...r.prospects.map((k, i) => ({ k, rang: i + 1, groep: "prospect" }))].map(({ k, rang, groep }) => ({
      Project: project?.naam ?? run.projectId,
      Projectnummer: project?.projectnummer ?? "",
      Run: run.naam,
      Rol: r.rol,
      Groep: groep,
      Rang: rang,
      Partner: k.partnerNaam,
      Status: k.status,
      Score: k.score,
      "Gewogen score": k.gewogenScore,
      "Semantische score": k.semantischeScore ?? "",
      "Dekkingsgraad (%)": k.dekkingsgraad,
      "Afstand (km)": k.afstandKm ?? "",
      Waarschuwingen: k.waarschuwingen.join(" | ")
    }))
  );
  const criteria = run.resultaat.flatMap((r) =>
    [...r.kandidaten, ...r.prospects].flatMap((k) =>
      k.criteria.map((c) => ({ Rol: r.rol, Partner: k.partnerNaam, Criterium: c.factorNaam, Gevraagd: JSON.stringify(c.gevraagd), Waarde: c.waarde === undefined ? "" : JSON.stringify(c.waarde), Fit: c.fit ?? "", Bron: c.bron ? bronTekst(c.bron) : "", Betrouwbaarheid: c.betrouwbaarheid !== undefined ? betrouwbaarheidNiveau(c.betrouwbaarheid) : "", "Gewicht (%)": c.gewicht, "Effectief gewicht (%)": c.effectiefGewicht, Bijdrage: c.bijdrage, Toelichting: c.toelichting }))
    )
  );
  const uitsluitingen = run.resultaat.flatMap((r) => r.uitsluitingen.map((u) => ({ Rol: r.rol, Partner: u.partnerNaam, Soort: u.soort, Reden: u.reden })));
  return { kandidaten, criteria, uitsluitingen, toelichting: [{ Toelichting: MATCH_DISCLAIMER, Gestart: run.gestartOp, Door: run.door }] };
}
