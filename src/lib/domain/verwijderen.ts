// US-69: definitief verwijderen op verzoek van Blauwhoed (AVG). Alleen een gearchiveerde partner; de partner verdwijnt met
// contactpersonen, documenten en herkomst, en ook uit engagements, evaluaties, verbanden (afgeleid), matchruns en
// discovery-kandidaten. Teamvoorstellen worden geanonimiseerd. De auditlog bewaart alleen dát er verwijderd is.
import type { Database, Partner } from "./types";

export const VERWIJDERD = "[verwijderde partner]";

export type VerwijderUitkomst = { blobs: string[]; engagements: number; evaluaties: number; matchruns: number; kandidaten: number; voorstellen: number; auditGeanonimiseerd: number };

export function controleerVerwijderen(p: Partner | undefined, reden: string, bevestiging: string): string | null {
  if (!p) return "Partner niet gevonden.";
  if (p.status !== "gearchiveerd") return "Alleen een gearchiveerde partner kan definitief worden verwijderd. Archiveer de partner eerst.";
  if (!reden.trim()) return "Een reden is verplicht (zonder persoonsgegevens, bijvoorbeeld 'verzoek Blauwhoed d.d. …').";
  if (bevestiging.trim() !== p.naam.trim()) return "Typ ter bevestiging exact de naam van de partner.";
  return null;
}

/** Verwijder de partner en alle verwijzingen (pure functie op de database). */
export function verwijderPartnerDefinitief(db: Database, partnerId: string): VerwijderUitkomst {
  const p = db.partners.find((x) => x.id === partnerId);
  if (!p) throw new Error("Partner niet gevonden.");
  const naam = p.naam;
  const u: VerwijderUitkomst = { blobs: (p.documenten ?? []).map((d) => d.bestandUrl).filter((x): x is string => Boolean(x)), engagements: 0, evaluaties: 0, matchruns: 0, kandidaten: 0, voorstellen: 0, auditGeanonimiseerd: 0 };
  db.partners = db.partners.filter((x) => x.id !== partnerId);
  // Projecthistorie en beoordelingen van deze partner.
  const engIds = new Set(db.engagements.filter((e) => e.partnerId === partnerId).map((e) => e.id));
  u.engagements = engIds.size;
  db.engagements = db.engagements.filter((e) => e.partnerId !== partnerId);
  const evVoor = db.evaluaties.length;
  db.evaluaties = db.evaluaties.filter((e) => e.partnerId !== partnerId && !engIds.has(e.engagementId));
  u.evaluaties = evVoor - db.evaluaties.length;
  // Matchruns, feedback en teams.
  db.matchRuns.forEach((run) => {
    let geraakt = false;
    run.resultaat.forEach((r) => {
      const voor = r.kandidaten.length + r.prospects.length + r.uitsluitingen.length;
      r.kandidaten = r.kandidaten.filter((k) => k.partnerId !== partnerId);
      r.prospects = r.prospects.filter((k) => k.partnerId !== partnerId);
      r.uitsluitingen = r.uitsluitingen.filter((k) => k.partnerId !== partnerId);
      if (voor !== r.kandidaten.length + r.prospects.length + r.uitsluitingen.length) geraakt = true;
    });
    if (geraakt) u.matchruns++;
  });
  db.feedback = db.feedback.filter((f) => f.partnerId !== partnerId);
  db.teams.forEach((t) =>
    t.leden.forEach((l) => {
      if (l.partnerId !== partnerId) return;
      l.partnerId = "verwijderd";
      l.partnerNaam = VERWIJDERD;
    })
  );
  // Discovery: de kandidaat waaruit de partner ontstond gaat mee; verwijzingen als 'mogelijke dubbel' worden gewist.
  const kVoor = db.kandidaten.length;
  db.kandidaten = db.kandidaten.filter((k) => k.gepromoveerdTot !== partnerId);
  u.kandidaten = kVoor - db.kandidaten.length;
  db.kandidaten.forEach((k) => {
    if (k.mogelijkeDubbelVan?.startsWith(`${partnerId}|`)) k.mogelijkeDubbelVan = undefined;
  });
  db.partners.forEach((x) => {
    if (x.registratie?.mogelijkeDubbelVan?.startsWith(`${partnerId}|`)) x.registratie.mogelijkeDubbelVan = undefined;
  });
  // Verrijking.
  const vVoor = db.verrijkingsvoorstellen.length;
  db.verrijkingsvoorstellen = db.verrijkingsvoorstellen.filter((v) => v.partnerId !== partnerId);
  u.voorstellen = vVoor - db.verrijkingsvoorstellen.length;
  db.verrijkingsrondes.forEach((r) => {
    r.partnerIdsVerwerkt = r.partnerIdsVerwerkt.filter((id) => id !== partnerId);
    if (r.doelIds) r.doelIds = r.doelIds.filter((id) => id !== partnerId);
  });
  // Naam uit vrije teksten (auditdetails, AI-administratie, afwijsredenen): alleen vastleggen dát er iets gebeurde.
  const wis = (t: string | undefined) => (t && naam.length >= 3 && t.includes(naam) ? t.split(naam).join(VERWIJDERD) : t);
  db.audit.forEach((a) => {
    const oud = `${a.details ?? ""}|${a.actie}`;
    if (a.entiteitId === partnerId) a.details = undefined;
    else a.details = wis(a.details);
    a.actie = wis(a.actie) ?? a.actie;
    if (oud !== `${a.details ?? ""}|${a.actie}`) u.auditGeanonimiseerd++;
  });
  db.aiBewerkingen.forEach((b) => {
    b.omschrijving = wis(b.omschrijving);
    b.aanroepen.forEach((a) => (a.doel = wis(a.doel) ?? a.doel));
  });
  db.afwijsredenen.forEach((r) => {
    if (r.kandidaatNaam === naam) r.kandidaatNaam = VERWIJDERD;
  });
  return u;
}
