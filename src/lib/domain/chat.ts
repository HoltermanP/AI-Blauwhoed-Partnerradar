// B5: contextopbouw voor de chat — compacte, feitelijke partnerrecords uit de database (nooit iets anders).
import { effectieveStatus } from "./herkomst";
import { semantischZoeken } from "./matching";
import type { Database, Partner } from "./types";
import { totaalscore } from "./tevredenheid";
import { zichtbaar } from "./zichtbaarheid";

export function chatRecord(p: Partner, db: Database) {
  const fmap = new Map(db.factoren.map((f) => [f.id, f]));
  return {
    id: p.id,
    naam: p.naam,
    status: p.status,
    rollen: p.rollen,
    plaats: p.vestigingsplaats,
    website: p.website,
    medewerkers: p.medewerkers,
    omschrijving: p.omschrijving.slice(0, 300),
    referenties: p.referenties.slice(0, 4),
    certificaten: p.certificaten.map((c) => `${c.type} (geldig tot ${c.geldigTot})`),
    waarden: p.factoren.slice(0, 25).map((f) => {
      const def = fmap.get(f.factorId);
      return { veld: def ? (f.optieId ? `${def.naam}: ${def.opties?.find((o) => o.id === f.optieId)?.label ?? f.optieId}` : def.naam) : f.factorId, waarde: f.waarde, bron: f.bron, status: effectieveStatus(f, def) ?? "berekend", peildatum: f.peildatum };
    }),
    // US-63: projecthistorie met projectnummer en tevredenheid (oordeel van Blauwhoed, op organisatieniveau).
    projecten: db.engagements.filter((e) => e.partnerId === p.id).map((e) => {
      const proj = db.projecten.find((x) => x.id === e.projectId);
      const ev = db.evaluaties.find((x) => x.engagementId === e.id) ?? db.evaluaties.find((x) => x.partnerId === p.id && x.projectId === e.projectId);
      return { projectnummer: proj?.projectnummer, project: proj?.naam ?? e.projectId, rol: e.rol, periode: e.periode, tevredenheid: ev ? totaalscore(ev) : null, toelichting: ev ? [ev.toelichting, ev.totaalToelichting].filter(Boolean).join(" ").slice(0, 300) : null };
    }),
    evaluatiegemiddelde: (() => {
      const ev = db.evaluaties.filter((e) => e.partnerId === p.id);
      return ev.length ? Math.round((ev.reduce((s, e) => s + totaalscore(e), 0) / ev.length) * 10) / 10 : null;
    })()
  };
}

/** US-63: partners die betrokken waren bij een project dat in de vraag genoemd wordt (op projectnummer of projectnaam). */
export function partnersBijGenoemdProject(db: Database, vraag: string): Partner[] {
  const v = vraag.toLowerCase();
  const projecten = db.projecten.filter((pr) => (pr.projectnummer && v.includes(pr.projectnummer.toLowerCase())) || (pr.naam.length > 4 && v.includes(pr.naam.toLowerCase())));
  const ids = new Set(db.engagements.filter((e) => projecten.some((pr) => pr.id === e.projectId)).map((e) => e.partnerId));
  return db.partners.filter((p) => ids.has(p.id) && p.status !== "geblokkeerd" && zichtbaar(p));
}

/** Selecteer de relevantste partners voor een vraag (projectnummer/-naam en semantisch) en geef ze als compacte records. */
export function chatContext(db: Database, vraag: string, max = 15) {
  const treffers = semantischZoeken(db, vraag, max);
  const uitProject = partnersBijGenoemdProject(db, vraag);
  const semantisch = treffers.length ? treffers.map((t) => t.partner) : uitProject.length ? [] : db.partners.filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd" && p.status !== "concept").slice(0, max);
  const partners = Array.from(new Map([...uitProject, ...semantisch].map((p) => [p.id, p])).values()).slice(0, max);
  return { partners, records: partners.map((p) => chatRecord(p, db)) };
}
