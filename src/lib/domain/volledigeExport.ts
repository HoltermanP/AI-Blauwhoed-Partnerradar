// US-68: volledige data-export met herkomst (art. 15.4): alle partners, velden, factoren, projecten, evaluaties, verbanden,
// concepten en het verbruik, inclusief herkomst en status per gegeven. Als JSON (volledig) en als CSV-tabellen (ZIP).
import { historieRijen, partnersRijen, waardenRijen } from "./export";
import { herkomstExport } from "./herkomst";
import { verbruikSpecificatie } from "./kosten";
import { totaalscore } from "./tevredenheid";
import type { Database } from "./types";
import { leidVerbandenAf } from "./verbanden";

export function volledigeExportJson(db: Database, door: string, nu = new Date()) {
  const verbanden = leidVerbandenAf(db);
  return {
    export: {
      soort: "volledige export partnerdatabase Blauwhoed",
      gemaaktOp: nu.toISOString(),
      door,
      databaseversie: db.versie,
      toelichting: "Bevat de volledige opgeslagen staat (alle partners inclusief concepten en gearchiveerde, velden, factoren, projecten, evaluaties, verbruik en instellingen) plus afgeleide gegevens: verbanden (signalen met bron) en herkomst per gegeven."
    },
    database: db,
    afgeleid: {
      verbanden: verbanden.map((v) => ({ a: v.a, b: v.b, bronnen: v.bronnen, toelichting: "Uit bronnen afgeleid signaal; geen bevestiging van samenwerking of exclusiviteit." })),
      herkomstPerPartner: db.partners.map((p) => ({ status: p.status, ...herkomstExport(p, db.factoren, nu) })),
      tevredenheidPerEvaluatie: db.evaluaties.map((e) => ({ id: e.id, totaalscore: totaalscore(e), bijgesteld: e.totaalscore !== undefined, toelichting: e.totaalToelichting ?? null }))
    }
  };
}

/** CSV-tabellen voor de volledige export (één bestand per tabel). */
export function volledigeExportTabellen(db: Database): Record<string, Array<Record<string, unknown>>> {
  const alle = db.partners;
  const partnerNaam = (id: string) => db.partners.find((p) => p.id === id)?.naam ?? id;
  const projectVan = (id: string) => db.projecten.find((p) => p.id === id);
  const verbruik = verbruikSpecificatie(db);
  return {
    // Alle vrijgegeven en gearchiveerde partners met kerngegevens; concepten staan in 'concepten'.
    partners: partnersRijen(db, true),
    "partners-alle-statussen": alle.map((p) => ({ Id: p.id, Naam: p.naam, KVK: p.kvk, Status: p.status, Statusreden: p.statusReden ?? "", Rollen: p.rollen.join(", "), Plaats: p.vestigingsplaats, Aangemaakt: p.aangemaaktOp, Bijgewerkt: p.bijgewerktOp, "Laatst verrijkt": p.laatstVerrijktOp ?? "" })),
    "waarden-met-herkomst": waardenRijen(db, alle),
    concepten: alle.filter((p) => p.status === "concept").map((p) => ({ Id: p.id, Naam: p.naam, Herkomst: p.registratie?.herkomstSoort ?? "", "Aangevraagd door": p.registratie?.aangevraagdDoor ?? "", Op: p.registratie?.op ?? "", Provider: p.registratie?.provider ?? "", Bronnen: (p.registratie?.bronnen ?? []).join(" | "), "Waarom past het": p.registratie?.onderbouwing?.waaromPast ?? "", Onzeker: (p.registratie?.onderbouwing?.onzeker ?? p.registratie?.waarschuwingen ?? []).join(" | ") })),
    certificaten: alle.flatMap((p) => p.certificaten.map((c) => ({ Partner: p.naam, Type: c.type, Nummer: c.nummer, Niveau: c.niveau ?? "", "Geldig tot": c.geldigTot, Verificatie: c.verificatie ?? (c.geverifieerdOp ? "geverifieerd" : "geclaimd"), "Geverifieerd op": c.geverifieerdOp ?? "", Bron: c.bronUrl ?? "" }))),
    contactpersonen: alle.flatMap((p) => p.contactpersonen.map((c) => ({ Partner: p.naam, Naam: c.naam, Functie: c.functie, Email: c.email ?? "", Telefoon: c.telefoon ?? "", Grondslag: c.grondslag, "Vastgelegd op": c.vastgelegdOp, "Bewaartermijn (mnd)": c.bewaartermijnMaanden }))),
    documenten: alle.flatMap((p) => (p.documenten ?? []).map((d) => ({ Partner: p.naam, Naam: d.naam, Soort: d.soort, URL: d.url ?? "", Bestand: d.bestandUrl ?? "", "Tekst (tekens)": (d.tekst?.length ?? 0) + (d.geextraheerdeTekst?.length ?? 0), "Toegevoegd door": d.toegevoegdDoor, Op: d.op }))),
    factoren: db.factoren.map((f) => ({ Id: f.id, Code: f.code, Naam: f.naam, Categorie: f.categorie, Type: f.type, Schaal: f.schaal.soort, Rollen: f.rollen.join(", "), Actief: f.actief, "Vervaltermijn (mnd)": f.vervalMaanden ?? "", Versie: f.versie })),
    goudstandaard: Object.values(db.goudstandaard ?? {}).flatMap((g) => (g ? g.velden.map((v) => ({ Partnertype: g.rol, Veld: v.sleutel, Niveau: v.niveau, Toelichting: v.toelichting ?? "", Versie: g.versie, Door: g.door })) : [])),
    projecten: db.projecten.map((p) => ({ Id: p.id, Projectnummer: p.projectnummer ?? "", Naam: p.naam, Type: p.type, Plaats: p.locatie.plaats, Woningen: p.woningen, Fase: p.fase, Start: p.planning.start, Eind: p.planning.eind, Omschrijving: p.omschrijving })),
    projecthistorie: historieRijen(db),
    evaluaties: db.evaluaties.map((e) => ({ Projectnummer: projectVan(e.projectId)?.projectnummer ?? "", Project: projectVan(e.projectId)?.naam ?? e.projectId, Partner: partnerNaam(e.partnerId), Datum: e.datum, Door: e.door, Kwaliteit: e.kwaliteit, Planning: e.planning, Budget: e.budget, Samenwerking: e.samenwerking, Duurzaamheid: e.duurzaamheid, Totaalscore: totaalscore(e), Bijgesteld: e.totaalscore !== undefined ? "ja" : "nee", "Toelichting bijstelling": e.totaalToelichting ?? "", Toelichting: e.toelichting })),
    verbanden: leidVerbandenAf(db).map((v) => ({ "Partner A": v.a.naam, "Partner B": v.b.naam, Bronnen: v.bronnen.map((b) => `${b.soort}: ${b.label}`).join(" | "), Toelichting: "Signaal uit bronnen, geen bevestigde samenwerking" })),
    "discovery-kandidaten": db.kandidaten.map((k) => ({ Naam: k.naam, KVK: k.kvk ?? "", Status: k.status, Bron: k.bron, "Bron-URL": k.bronUrl, Opgehaald: k.opgehaaldOp, "Beoordeeld door": k.beoordeeldDoor ?? "", Reden: k.reden ?? "" })),
    verrijkingsvoorstellen: db.verrijkingsvoorstellen.map((v) => ({ Partner: partnerNaam(v.partnerId), Veld: v.veld, Huidig: JSON.stringify(v.huidig), Voorgesteld: JSON.stringify(v.voorgesteld), Bron: v.bron, "Bron-URL": v.bronUrl ?? "", Status: v.status, Gevonden: v.gevondenOp })),
    "ai-verbruik": verbruik.regels,
    "ai-verbruik-per-maand": verbruik.perMaand,
    gebruikers: db.gebruikers.map((g) => ({ Naam: g.naam, Email: g.email ?? "", Rol: g.rol, Actief: g.actief !== false, "Laatste inlog": g.laatstIngelogdOp ?? "" })),
    auditlog: db.audit.map((a) => ({ Op: a.op, Door: a.door, Rol: a.gebruikersrol, Entiteit: a.entiteit, Id: a.entiteitId, Actie: a.actie, Details: a.details ?? "" }))
  };
}
