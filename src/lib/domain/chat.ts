// B5: contextopbouw voor de chat — compacte, feitelijke partnerrecords uit de database (nooit iets anders).
import { effectieveStatus } from "./herkomst";
import { semantischZoeken } from "./matching";
import type { Database, Partner } from "./types";

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
    projecten: db.engagements.filter((e) => e.partnerId === p.id).map((e) => ({ project: db.projecten.find((x) => x.id === e.projectId)?.naam ?? e.projectId, rol: e.rol, periode: e.periode })),
    evaluatiegemiddelde: (() => {
      const ev = db.evaluaties.filter((e) => e.partnerId === p.id);
      return ev.length ? Math.round((ev.reduce((s, e) => s + (e.samenwerking + e.kwaliteit + e.planning + e.budget + e.duurzaamheid) / 5, 0) / ev.length) * 10) / 10 : null;
    })()
  };
}

/** Selecteer de relevantste partners voor een vraag (semantisch) en geef ze als compacte records. */
export function chatContext(db: Database, vraag: string, max = 15) {
  const treffers = semantischZoeken(db, vraag, max);
  const partners = treffers.length ? treffers.map((t) => t.partner) : db.partners.filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd").slice(0, max);
  return { partners, records: partners.map((p) => chatRecord(p, db)) };
}
