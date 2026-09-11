"use server";
// Alle mutaties van het systeem. Elke actie toetst rechten (US-45) en schrijft een auditregel (US-46).
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { GEBRUIKERS, vereisRecht } from "./auth";
import { afwijsPenalty, demoConnector, kandidaatNaarPartner, normaliseerNaam, samenvattingVoor, vindDubbel } from "./domain/discovery";
import { extraheerVoorstellen } from "./domain/enrichment";
import { extraheerProjectprofiel } from "./domain/extractie";
import { kvkConnector } from "./domain/kvk";
import { leidEisenAf } from "./domain/projectfactoren";
import { importeerEngagements } from "./domain/csv";
import { geocodeer } from "./domain/geocode";
import { rijNaarPartner, voegPartnersToe, voegRijenSamen, type ImportRij, type ImportUitkomst } from "./domain/partnerimport";
import { webzoekConnector } from "./domain/webzoek";
import { BASISVELDEN, verrijkVanuitInternet } from "./domain/webverrijking";
import { effectieveStatus, herkomstExport, wisHerkomst } from "./domain/herkomst";
import { aanvullingPlaatsen, laadAanvulling } from "./domain/aanvulling";
import { maakSeedIdGenerator } from "./domain/migratie";
import { aiBeschikbaar, aiFactorExtractie, aiProjectExtractie, aiSamenvatting } from "./ai";
import type { BronConnector } from "./domain/discovery";
import { slaNuOp } from "./store";
import { matchProject, valideerGewichten } from "./domain/matching";
import { risicoklasse } from "./domain/signalen";
import { stelTeamSamen } from "./domain/team";
import type {
  Certificaat,
  Contactpersoon,
  Database,
  EnrichmentVoorstel,
  Evaluatie,
  Factor,
  FactorOption,
  FactorWaarde,
  Financieel,
  Gebruiker,
  Geo,
  KwalificatieItem,
  MatchFeedback,
  Partner,
  PartnerFactor,
  PartnerStatus,
  Project,
  ProjectRequirement,
  RequirementFactor,
  Rol
} from "./domain/types";
import { KWALIFICATIE_ITEMS } from "./domain/types";
import { getDb, muteer, nieuwId, resetNaarSeed } from "./store";

export type ActieResultaat<T = undefined> = { ok: true; data?: T; melding?: string } | { ok: false; fout: string };

async function veilig<T>(fn: () => Promise<T>): Promise<ActieResultaat<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Gebruiker / rollen ----------
export async function wisselGebruiker(id: string) {
  if (!GEBRUIKERS.some((g) => g.id === id)) return;
  const jar = await cookies();
  jar.set("pr_gebruiker", id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function resetDemo(modus: "demo" | "leeg" = "leeg") {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await resetNaarSeed(g, modus);
    revalidatePath("/", "layout");
  });
}

// ---------- Partners (Epic 1) ----------
export type PartnerInvoer = {
  naam: string;
  kvk: string;
  rechtsvorm: string;
  vestigingsplaats: string;
  adres?: string;
  werkgebiedKm: number;
  rollen: Rol[];
  website?: string;
  omschrijving: string;
  referenties: string[];
  omzet?: number;
  medewerkers?: number;
  maxGelijktijdigeProjecten?: number;
  typischeProjectomvang?: { min: number; max: number };
  tags?: string[];
};

export async function slaPartnerOp(id: string | null, invoer: PartnerInvoer) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const kvk = invoer.kvk.replace(/\D/g, "");
    if (kvk && kvk.length !== 8) throw new Error("KVK-nummer moet uit 8 cijfers bestaan (of leeg blijven tot het bekend is).");
    const db = await getDb();
    const dubbel = kvk ? db.partners.find((p) => p.kvk === kvk && p.id !== id) : db.partners.find((p) => normaliseerNaam(p.naam) === normaliseerNaam(invoer.naam) && p.id !== id);
    if (dubbel) throw new Error(`${kvk ? `KVK ${kvk}` : "Deze naam"} bestaat al: ${dubbel.naam} (${dubbel.id}).`);
    const gevonden = (invoer.adres ? await geocodeer(`${invoer.adres}, ${invoer.vestigingsplaats}`) : null) ?? (await geocodeer(invoer.vestigingsplaats));
    if (!gevonden) throw new Error(`Vestigingsplaats '${invoer.vestigingsplaats}' kon niet worden gevonden (PDOK Locatieserver). Controleer de spelling.`);
    const geo = gevonden.locatie;
    return muteer(g, { entiteit: "partner", entiteitId: id ?? "nieuw", actie: id ? "bijgewerkt" : "aangemaakt", details: invoer.naam }, (db) => {
      const nu = new Date().toISOString();
      if (id) {
        const p = db.partners.find((x) => x.id === id);
        if (!p) throw new Error("Partner niet gevonden.");
        Object.assign(p, { ...invoer, kvk, locatie: geo, bijgewerktOp: nu });
        return p.id;
      }
      const nieuw: Partner = {
        id: nieuwId("p"),
        ...invoer,
        kvk,
        locatie: geo,
        status: "bekend",
        beschikbaarheid: [],
        factoren: [],
        certificaten: [],
        contactpersonen: [],
        kwalificatie: [],
        bronnen: [],
        tags: invoer.tags ?? [],
        aangemaaktOp: nu,
        bijgewerktOp: nu
      };
      db.partners.push(nieuw);
      return nieuw.id;
    });
  }).then((r) => {
    revalidatePath("/partners");
    return r;
  });
}

export async function zetPartnerStatus(id: string, status: PartnerStatus, reden: string, geblokkeerdTot?: string) {
  return veilig(async () => {
    const recht = status === "preferred" || status === "geblokkeerd" ? "prospect_promoveren" : "bewerken";
    const g = await vereisRecht(recht);
    await muteer(g, { entiteit: "partner", entiteitId: id, actie: `status ${status}`, details: reden }, (db) => {
      const p = db.partners.find((x) => x.id === id);
      if (!p) throw new Error("Partner niet gevonden.");
      if (status === "preferred") {
        const ontbreekt = KWALIFICATIE_ITEMS.filter((k) => !p.kwalificatie.find((q) => q.item === k.id && q.afgevinkt));
        if (ontbreekt.length) throw new Error(`Preferred vereist volledige kwalificatie. Nog open: ${ontbreekt.map((k) => k.label).join("; ")}.`);
      }
      p.status = status;
      p.statusReden = reden;
      p.geblokkeerdTot = status === "geblokkeerd" ? geblokkeerdTot : undefined;
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/partners/${id}`);
  });
}

export async function slaPartnerFactorOp(partnerId: string, factor: Omit<PartnerFactor, "peildatum"> & { peildatum?: string }) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "partner_factor", entiteitId: partnerId, actie: "factorwaarde vastgelegd", details: `${factor.factorId}${factor.optieId ? `/${factor.optieId}` : ""} = ${JSON.stringify(factor.waarde)} (${factor.bron})` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      const f = db.factoren.find((x) => x.id === factor.factorId);
      if (!f || !f.actief) throw new Error("Factor bestaat niet of is gearchiveerd.");
      if (f.opties && factor.optieId && !f.opties.some((o) => o.id === factor.optieId && o.actief)) throw new Error("Optie komt niet uit de waardenlijst.");
      const idx = p.factoren.findIndex((x) => x.factorId === factor.factorId && (x.optieId ?? "") === (factor.optieId ?? ""));
      // Handmatige invoer is een menselijke vaststelling: status 'gevalideerd' met naam en datum (eis 1).
      const record: PartnerFactor = { ...factor, peildatum: factor.peildatum ?? new Date().toISOString().slice(0, 10), status: "gevalideerd", gevalideerdDoor: g.naam, gevalideerdOp: new Date().toISOString().slice(0, 10) };
      if (idx >= 0) p.factoren[idx] = record;
      else p.factoren.push(record);
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function verwijderPartnerFactor(partnerId: string, factorId: string, optieId?: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "partner_factor", entiteitId: partnerId, actie: "factorwaarde verwijderd", details: `${factorId}/${optieId ?? ""}` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      p.factoren = p.factoren.filter((x) => !(x.factorId === factorId && (x.optieId ?? "") === (optieId ?? "")));
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function slaCertificaatOp(partnerId: string, cert: Omit<Certificaat, "id"> & { id?: string }) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "certificaat", entiteitId: partnerId, actie: cert.id ? "certificaat bijgewerkt" : "certificaat toegevoegd", details: `${cert.type} ${cert.nummer} geldig tot ${cert.geldigTot}` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      if (cert.id) {
        const idx = p.certificaten.findIndex((c) => c.id === cert.id);
        if (idx >= 0) p.certificaten[idx] = { ...cert, id: cert.id };
      } else p.certificaten.push({ ...cert, id: nieuwId("cert") });
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function verwijderCertificaat(partnerId: string, certId: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "certificaat", entiteitId: partnerId, actie: "certificaat verwijderd", details: certId }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (p) p.certificaten = p.certificaten.filter((c) => c.id !== certId);
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function slaBeschikbaarheidOp(partnerId: string, items: Partner["beschikbaarheid"]) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "partner", entiteitId: partnerId, actie: "beschikbaarheid bijgewerkt" }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (p) p.beschikbaarheid = items;
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function slaContactpersoonOp(partnerId: string, cp: Omit<Contactpersoon, "id" | "vastgelegdOp"> & { id?: string }) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "contactpersoon", entiteitId: partnerId, actie: cp.id ? "contactpersoon bijgewerkt" : "contactpersoon toegevoegd", details: `grondslag ${cp.grondslag}, bewaartermijn ${cp.bewaartermijnMaanden} mnd` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      if (cp.id) {
        const idx = p.contactpersonen.findIndex((c) => c.id === cp.id);
        if (idx >= 0) p.contactpersonen[idx] = { ...p.contactpersonen[idx], ...cp, id: cp.id };
      } else p.contactpersonen.push({ ...cp, id: nieuwId("cp"), vastgelegdOp: new Date().toISOString().slice(0, 10) });
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function verwijderContactpersoon(partnerId: string, cpId: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "contactpersoon", entiteitId: partnerId, actie: "contactpersoon verwijderd (AVG)", details: cpId }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (p) p.contactpersonen = p.contactpersonen.filter((c) => c.id !== cpId);
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function vinkKwalificatieAf(partnerId: string, item: KwalificatieItem, afgevinkt: boolean, toelichting?: string) {
  return veilig(async () => {
    const g = await vereisRecht("kwalificeren");
    await muteer(g, { entiteit: "kwalificatie", entiteitId: partnerId, actie: `${item} ${afgevinkt ? "afgevinkt" : "opengezet"}`, details: toelichting }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      const idx = p.kwalificatie.findIndex((k) => k.item === item);
      const record = { item, afgevinkt, door: g.naam, op: new Date().toISOString().slice(0, 10), toelichting };
      if (idx >= 0) p.kwalificatie[idx] = record;
      else p.kwalificatie.push(record);
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function slaFinancieelOp(partnerId: string, fin: Omit<Financieel, "risicoklasse">) {
  return veilig(async () => {
    const g = await vereisRecht("kwalificeren");
    await muteer(g, { entiteit: "financieel", entiteitId: partnerId, actie: "kerncijfers bijgewerkt", details: `boekjaar ${fin.boekjaar}` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      p.financieel = { ...fin, risicoklasse: risicoklasse(fin) };
      p.omzet = fin.omzet;
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

// ---------- Partners importeren (Excel/CSV) ----------

export async function importeerPartners(rijen: ImportRij[], bronnaam: string) {
  return veilig(async (): Promise<ImportUitkomst> => {
    const g = await vereisRecht("bewerken");
    const gelezen = rijen.map((r) => rijNaarPartner(r)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const partners = voegRijenSamen(gelezen);
    // Geocodeer vooraf (PDOK, met cache); onbekende plaats -> midden van Nederland met tag.
    const locaties = new Map<string, Geo | null>();
    for (const p of partners) if (p.plaats && !locaties.has(p.plaats)) locaties.set(p.plaats, (await geocodeer(p.plaats))?.locatie ?? null);
    const uitkomst = await muteer(g, { entiteit: "partner", entiteitId: "import", actie: "partners geïmporteerd", details: `${bronnaam}: ${partners.length} organisaties` }, (db) => voegPartnersToe(db, partners, locaties, bronnaam, nieuwId));
    uitkomst.gelezen = rijen.length;
    await slaNuOp();
    revalidatePath("/partners");
    return uitkomst;
  });
}

/** Laadt het Blauwhoed-overzicht houtbouwers (uit de meegeleverde Excel-export) als echte partners. */
export async function laadHoutbouwersOverzicht() {
  const seed = (await import("@/data/houtbouwers-seed.json")).default as { sourceFile: string; partners: Array<{ values: Record<string, string | number | boolean> }> };
  return importeerPartners(seed.partners.map((p) => p.values), seed.sourceFile);
}

/** Laadt de aanvullende dataset (partners, projecten, engagements en websites van bestaande partners; samengesteld uit openbare bronnen). */
export async function laadAanvullendeData() {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const plaatsen = aanvullingPlaatsen();
    const locaties = new Map<string, Geo | null>();
    await Promise.all(plaatsen.map(async (pl) => locaties.set(pl, (await geocodeer(pl))?.locatie ?? null)));
    const u = await muteer(g, { entiteit: "database", entiteitId: "aanvulling", actie: "aanvullende dataset geladen" }, (db) => laadAanvulling(db, locaties, maakSeedIdGenerator([...db.partners, ...db.projecten, ...db.engagements].map((x) => x.id))));
    await slaNuOp();
    ["/partners", "/projecten", "/kaart", "/historie", "/beheer"].forEach((p) => revalidatePath(p));
    return u;
  });
}

// ---------- Factorbeheer (US-04) ----------
export async function slaFactorOp(factor: Factor) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "factor", entiteitId: factor.id, actie: "factor opgeslagen", details: `${factor.naam} (${factor.type})` }, (db) => {
      const idx = db.factoren.findIndex((f) => f.id === factor.id);
      if (idx >= 0) db.factoren[idx] = { ...factor, versie: db.factoren[idx].versie + 1 };
      else db.factoren.push({ ...factor, versie: 1 });
    });
    revalidatePath("/beheer/factoren");
  });
}

export async function archiveerFactor(factorId: string) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "factor", entiteitId: factorId, actie: "gearchiveerd" }, (db) => {
      const f = db.factoren.find((x) => x.id === factorId);
      if (!f) throw new Error("Factor niet gevonden.");
      f.actief = false;
      f.gearchiveerdOp = new Date().toISOString();
      f.versie += 1;
    });
    revalidatePath("/beheer/factoren");
  });
}

export async function heractiveerFactor(factorId: string) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "factor", entiteitId: factorId, actie: "geheractiveerd" }, (db) => {
      const f = db.factoren.find((x) => x.id === factorId);
      if (f) {
        f.actief = true;
        f.gearchiveerdOp = undefined;
        f.versie += 1;
      }
    });
    revalidatePath("/beheer/factoren");
  });
}

/** Samenvoegen hernoemt bestaande koppelingen, verwijdert ze niet. */
export async function voegFactorenSamen(bronId: string, doelId: string) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "factor", entiteitId: bronId, actie: "samengevoegd", details: `in ${doelId}` }, (db) => {
      const bron = db.factoren.find((x) => x.id === bronId);
      const doel = db.factoren.find((x) => x.id === doelId);
      if (!bron || !doel || bron.id === doel.id) throw new Error("Bron- en doelfactor moeten verschillend en bestaand zijn.");
      let hernoemd = 0;
      db.partners.forEach((p) =>
        p.factoren.forEach((pf) => {
          if (pf.factorId === bronId) {
            pf.factorId = doelId;
            hernoemd++;
          }
        })
      );
      db.projecten.forEach((pr) => pr.eisen.forEach((e) => e.eisen.forEach((rf) => rf.factorId === bronId && (rf.factorId = doelId))));
      db.gewichtsprofielen.forEach((gp) => Object.values(gp.perRol).forEach((lijst) => lijst?.forEach((rf) => rf.factorId === bronId && (rf.factorId = doelId))));
      bron.actief = false;
      bron.samengevoegdIn = doelId;
      bron.gearchiveerdOp = new Date().toISOString();
      return hernoemd;
    });
    revalidatePath("/beheer/factoren");
  });
}

export async function slaFactorOptieOp(factorId: string, optie: FactorOption) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "factor_option", entiteitId: factorId, actie: "optie opgeslagen", details: optie.label }, (db) => {
      const f = db.factoren.find((x) => x.id === factorId);
      if (!f) throw new Error("Factor niet gevonden.");
      f.opties = f.opties ?? [];
      const idx = f.opties.findIndex((o) => o.id === optie.id);
      if (idx >= 0) f.opties[idx] = optie;
      else f.opties.push(optie);
      f.versie += 1;
    });
    revalidatePath("/beheer/factoren");
  });
}

// ---------- Projecten (Epic 2) ----------
export type ProjectInvoer = Omit<Project, "id" | "locatie" | "aangemaaktOp" | "bijgewerktOp" | "eisen"> & { plaats: string; eisen?: ProjectRequirement[] };

export async function slaProjectOp(id: string | null, invoer: ProjectInvoer) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const gevonden = await geocodeer(invoer.plaats);
    if (!gevonden) throw new Error(`Plaats '${invoer.plaats}' kon niet worden gevonden (PDOK Locatieserver).`);
    const geo = gevonden.locatie;
    return muteer(g, { entiteit: "project", entiteitId: id ?? "nieuw", actie: id ? "bijgewerkt" : "aangemaakt", details: invoer.naam }, (db) => {
      const nu = new Date().toISOString();
      const { plaats, eisen, ...rest } = invoer;
      if (id) {
        const p = db.projecten.find((x) => x.id === id);
        if (!p) throw new Error("Project niet gevonden.");
        Object.assign(p, { ...rest, locatie: { ...geo, plaats }, eisen: eisen ?? p.eisen, bijgewerktOp: nu });
        return p.id;
      }
      const nieuw: Project = { id: nieuwId("proj"), ...rest, locatie: { ...geo, plaats }, eisen: eisen ?? [], aangemaaktOp: nu, bijgewerktOp: nu };
      db.projecten.push(nieuw);
      return nieuw.id;
    });
  }).then((r) => {
    revalidatePath("/projecten");
    return r;
  });
}

export async function slaProjectEisenOp(projectId: string, eisen: ProjectRequirement[], gewichtsprofielId?: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    for (const e of eisen) {
      const v = valideerGewichten(e.eisen, db.factoren);
      if (!v.geldig) throw new Error(`Gewichten voor rol ${e.rol} tellen op tot ${v.som}%, niet 100%.`);
    }
    await muteer(g, { entiteit: "project", entiteitId: projectId, actie: "eisen bijgewerkt", details: `${eisen.length} rol(len)` }, (db) => {
      const p = db.projecten.find((x) => x.id === projectId);
      if (!p) throw new Error("Project niet gevonden.");
      p.eisen = eisen;
      p.gewichtsprofielId = gewichtsprofielId;
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/projecten/${projectId}`);
  });
}

export async function extraheerProject(tekst: string) {
  return veilig(async () => {
    await vereisRecht("bewerken");
    const regels = extraheerProjectprofiel(tekst);
    const ai = await aiProjectExtractie(tekst);
    if (!ai) return regels;
    const types = ["grondgebonden", "appartementen", "hoogbouw", "transformatie", "zorgwonen", "gebiedsontwikkeling"];
    const stijlen = ["traditioneel", "modern", "industrieel", "dorps", "hoogstedelijk"];
    const segmenten = ["sociaal", "middenhuur", "koop", "vrije sector"];
    return {
      velden: {
        naam: ai.naam ?? regels.velden.naam,
        type: (types.includes(ai.type ?? "") ? ai.type : regels.velden.type) as typeof regels.velden.type,
        plaats: ai.plaats ?? regels.velden.plaats,
        woningen: ai.woningen ?? regels.velden.woningen,
        prijssegment: (ai.prijssegment?.filter((x) => segmenten.includes(x)) as typeof regels.velden.prijssegment) ?? regels.velden.prijssegment,
        bouwstijl: (stijlen.includes(ai.bouwstijl ?? "") ? ai.bouwstijl : regels.velden.bouwstijl) as typeof regels.velden.bouwstijl,
        ambitieDuurzaamheid: (ai.ambitieDuurzaamheid && ai.ambitieDuurzaamheid >= 1 && ai.ambitieDuurzaamheid <= 5 ? ai.ambitieDuurzaamheid : regels.velden.ambitieDuurzaamheid) as typeof regels.velden.ambitieDuurzaamheid,
        start: ai.start ?? regels.velden.start,
        eind: ai.eind ?? regels.velden.eind,
        omschrijving: ai.omschrijving ?? regels.velden.omschrijving
      },
      herkomst: ai.herkomst.length ? ai.herkomst : regels.herkomst,
      provider: "Claude (claude-opus-5)"
    };
  });
}

/** Factoren vaststellen op basis van projectinformatie; geeft een voorstel terug dat de gebruiker in de editor bevestigt. */
export async function leidProjectEisenAfActie(projectId: string) {
  return veilig(async () => {
    await vereisRecht("bewerken");
    const db = await getDb();
    const project = db.projecten.find((p) => p.id === projectId);
    if (!project) throw new Error("Project niet gevonden.");
    return leidEisenAf(project, db.factoren, db.gewichtsprofielen);
  });
}

// ---------- Matching (Epic 3) ----------
export async function voerMatchUit(projectId: string, naam?: string, vrijeOmschrijving?: string) {
  return veilig(async () => {
    const g = await vereisRecht("lezen");
    const db = await getDb();
    const project = db.projecten.find((p) => p.id === projectId);
    if (!project) throw new Error("Project niet gevonden.");
    if (!project.eisen.length) throw new Error("Project heeft nog geen rollen en eisen.");
    const eisen = vrijeOmschrijving ? project.eisen.map((e) => ({ ...e, vrijeOmschrijving: vrijeOmschrijving })) : project.eisen;
    const resultaat = matchProject({ db, project }, eisen);
    const vorige = db.matchRuns.filter((r) => r.projectId === projectId).sort((a, b) => b.gestartOp.localeCompare(a.gestartOp))[0];
    const id = await muteer(g, { entiteit: "match_run", entiteitId: projectId, actie: "matchrun uitgevoerd", details: naam }, (db) => {
      const run = {
        id: nieuwId("run"),
        projectId,
        naam: naam || `Match ${new Date().toLocaleDateString("nl-NL")} ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`,
        gestartOp: new Date().toISOString(),
        door: g.naam,
        input: { eisen, vrijeOmschrijving },
        resultaat,
        vorigeRunId: vorige?.id
      };
      db.matchRuns.unshift(run);
      return run.id;
    });
    revalidatePath(`/projecten/${projectId}`);
    return id;
  });
}

export async function geefMatchFeedback(fb: Omit<MatchFeedback, "id" | "door" | "op">) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "match_feedback", entiteitId: fb.matchRunId, actie: `${fb.beslissing}: ${fb.partnerId}`, details: fb.reden }, (db) => {
      db.feedback = db.feedback.filter((x) => !(x.matchRunId === fb.matchRunId && x.rol === fb.rol && x.partnerId === fb.partnerId));
      db.feedback.push({ ...fb, id: nieuwId("fb"), door: g.naam, op: new Date().toISOString() });
    });
    revalidatePath(`/projecten/${fb.projectId}`);
  });
}

export async function maakTeamvoorstel(matchRunId: string, variant: "voorkeur" | "alternatief") {
  return veilig(async () => {
    const g = await vereisRecht("lezen");
    const db = await getDb();
    const run = db.matchRuns.find((r) => r.id === matchRunId);
    if (!run) throw new Error("Matchrun niet gevonden.");
    const project = db.projecten.find((p) => p.id === run.projectId)!;
    const voorkeur = db.teams.find((t) => t.matchRunId === matchRunId && t.variant === "voorkeur");
    const uitsluiten = variant === "alternatief" && voorkeur ? voorkeur.leden.map((l) => l.partnerId) : [];
    const team = stelTeamSamen(run, db, project, variant, uitsluiten);
    if (!team) throw new Error("Geen team samen te stellen: te weinig kandidaten.");
    await muteer(g, { entiteit: "team", entiteitId: team.id, actie: `teamvoorstel ${variant}`, details: `score ${team.teamScore}` }, (db) => {
      db.teams = db.teams.filter((t) => !(t.matchRunId === matchRunId && t.variant === variant));
      db.teams.push(team);
    });
    revalidatePath(`/projecten/${run.projectId}/team`);
    return team.id;
  });
}

// ---------- Historie (Epic 4) ----------
export async function slaEngagementOp(inv: { partnerId: string; projectId: string; rol: Rol; van: string; tot?: string; contractwaarde: number; ramingBijStart?: number; eindafrekening?: number; geplandeOplevering?: string; werkelijkeOplevering?: string; bouwsysteem?: string }) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "engagement", entiteitId: inv.projectId, actie: "engagement vastgelegd", details: `${inv.partnerId} als ${inv.rol}` }, (db) => {
      db.engagements.push({ id: nieuwId("eng"), partnerId: inv.partnerId, projectId: inv.projectId, rol: inv.rol, periode: { van: inv.van, tot: inv.tot || undefined }, contractwaarde: inv.contractwaarde, ramingBijStart: inv.ramingBijStart, eindafrekening: inv.eindafrekening, geplandeOplevering: inv.geplandeOplevering, werkelijkeOplevering: inv.werkelijkeOplevering, bouwsysteem: inv.bouwsysteem, bron: "handmatig" });
    });
    revalidatePath(`/projecten/${inv.projectId}`);
    revalidatePath(`/partners/${inv.partnerId}`);
  });
}

export async function importeerCsv(csv: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    const res = importeerEngagements(csv, db);
    await muteer(g, { entiteit: "engagement", entiteitId: "csv", actie: "CSV-import", details: `${res.engagements.length} regels, ${res.wachtrij.length} naar controlewachtrij` }, (db) => {
      db.engagements.push(...res.engagements);
      res.wachtrij.forEach((w) => db.importWachtrij.push({ id: nieuwId("imp"), regel: w.regel, reden: w.reden, op: new Date().toISOString() }));
    });
    revalidatePath("/historie");
    return { geimporteerd: res.engagements.length, wachtrij: res.wachtrij.length };
  });
}

export async function verwijderUitImportWachtrij(id: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "import_wachtrij", entiteitId: id, actie: "verwijderd" }, (db) => {
      db.importWachtrij = db.importWachtrij.filter((x) => x.id !== id);
    });
    revalidatePath("/historie");
  });
}

export async function slaEvaluatieOp(ev: Omit<Evaluatie, "id" | "door" | "datum"> & { datum?: string }) {
  return veilig(async () => {
    const g = await vereisRecht("evalueren");
    await muteer(g, { entiteit: "evaluatie", entiteitId: ev.engagementId, actie: "beoordeling vastgelegd", details: `${ev.partnerId}: k${ev.kwaliteit} p${ev.planning} b${ev.budget} s${ev.samenwerking} d${ev.duurzaamheid}` }, (db) => {
      db.evaluaties = db.evaluaties.filter((x) => x.engagementId !== ev.engagementId);
      db.evaluaties.push({ ...ev, id: nieuwId("ev"), door: g.naam, datum: ev.datum ?? new Date().toISOString().slice(0, 10) });
    });
    revalidatePath(`/projecten/${ev.projectId}`);
    revalidatePath(`/partners/${ev.partnerId}`);
  });
}

// ---------- Discovery (Epic 5) ----------
export type DiscoveryUitkomst = { gevonden: number; nieuw: number; alInWachtrij: number; mogelijkeDubbelen: number; bronnen: string[]; regio?: string };

export async function startDiscovery(projectId: string | null, rollen: Rol[], trefwoorden: string, regio?: string) {
  return veilig(async (): Promise<DiscoveryUitkomst> => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    const project = projectId ? db.projecten.find((p) => p.id === projectId) : undefined;
    const woorden = [trefwoorden, project?.omschrijving ?? "", project?.type ?? ""].join(" ").split(/\s+/).filter(Boolean);
    const connectors: BronConnector[] = [];
    if (db.instellingen.externeBronnenToegestaan) connectors.push(webzoekConnector);
    if (process.env.KVK_API_KEY && db.instellingen.externeBronnenToegestaan) connectors.push(kvkConnector(process.env.KVK_API_KEY));
    if (process.env.DEMO_DATA === "1") connectors.push(demoConnector);
    if (!connectors.length) throw new Error("Geen bronnen actief: sta externe bronnen toe in Beheer (webzoek) en/of zet KVK_API_KEY.");
    const gevonden = (await Promise.all(connectors.map((c) => c.zoek({ rollen, trefwoorden: woorden, regio: regio || undefined })))).flat();
    // Locatie en AI-samenvatting vóór de mutatie (async), zodat de mutatie zelf synchroon blijft.
    const verrijkt = await Promise.all(
      gevonden.map(async (k) => {
        const locatie = k.locatie ?? (k.vestigingsplaats ? (await geocodeer(k.vestigingsplaats))?.locatie : undefined);
        const tekst = String(k.ruweData.websiteTekst ?? k.ruweData.profiel ?? "");
        const samenvatting = aiBeschikbaar() && tekst ? await aiSamenvatting({ ...k, id: "", status: "nieuw", opgehaaldOp: "" }, project, tekst) : null;
        return { ...k, locatie, samenvatting: samenvatting ?? undefined };
      })
    );
    const nu = new Date().toISOString();
    const uitkomst = await muteer(g, { entiteit: "discovery", entiteitId: projectId ?? "algemeen", actie: "zoekopdracht gestart", details: `${rollen.join(", ")}; ${trefwoorden}${regio ? `; regio ${regio}` : ""}` }, (db) => {
      const u: DiscoveryUitkomst = { gevonden: gevonden.length, nieuw: 0, alInWachtrij: 0, mogelijkeDubbelen: 0, bronnen: connectors.map((c) => c.naam), regio: regio || undefined };
      verrijkt.forEach((k) => {
        const bestaand = db.kandidaten.find((x) => (x.kvk && x.kvk === k.kvk) || normaliseerNaam(x.naam) === normaliseerNaam(k.naam));
        if (bestaand) {
          u.alInWachtrij++;
          // Koppel een bestaande, nog open kandidaat ook aan dit project zodat hij in de projectcontext verschijnt.
          if (projectId && bestaand.status === "nieuw" && !bestaand.projectId) bestaand.projectId = projectId;
          return;
        }
        const dubbel = vindDubbel(k, db.partners);
        if (dubbel) u.mogelijkeDubbelen++;
        const penalty = afwijsPenalty(k, db.afwijsredenen);
        const kandidaat = { ...k, id: nieuwId("kand"), status: "nieuw" as const, opgehaaldOp: nu, projectId: projectId ?? undefined, mogelijkeDubbelVan: dubbel ? `${dubbel.partner.id}|${dubbel.reden}` : undefined, voorlopigeScore: Math.max(0, (k.voorlopigeScore ?? 0) - penalty) };
        kandidaat.samenvatting = k.samenvatting ?? samenvattingVoor(kandidaat, project);
        db.kandidaten.push(kandidaat);
        u.nieuw++;
      });
      return u;
    });
    revalidatePath("/discovery");
    return uitkomst;
  });
}

export async function beoordeelKandidaat(id: string, beslissing: "geaccepteerd" | "afgewezen" | "geparkeerd", reden?: string) {
  return veilig(async () => {
    const g = await vereisRecht(beslissing === "geaccepteerd" ? "prospect_promoveren" : "discovery_goedkeuren");
    if (beslissing === "afgewezen" && !reden?.trim()) throw new Error("Afwijzen vraagt om een reden; die traint de filtering.");
    await muteer(g, { entiteit: "discovery", entiteitId: id, actie: beslissing, details: reden }, (db) => {
      const k = db.kandidaten.find((x) => x.id === id);
      if (!k) throw new Error("Kandidaat niet gevonden.");
      k.status = beslissing;
      k.reden = reden;
      k.beoordeeldOp = new Date().toISOString();
      k.beoordeeldDoor = g.naam;
      if (beslissing === "afgewezen") db.afwijsredenen.push({ reden: reden!, op: k.beoordeeldOp, kandidaatNaam: k.naam });
      if (beslissing === "geaccepteerd") {
        if (k.mogelijkeDubbelVan) throw new Error("Mogelijke dubbel: koppel eerst aan de bestaande partner of markeer als geen dubbel.");
        const p = kandidaatNaarPartner(k);
        db.partners.push(p);
        k.gepromoveerdTot = p.id;
      }
    });
    revalidatePath("/discovery");
  });
}

export async function markeerGeenDubbel(id: string) {
  return veilig(async () => {
    const g = await vereisRecht("discovery_goedkeuren");
    await muteer(g, { entiteit: "discovery", entiteitId: id, actie: "geen dubbel" }, (db) => {
      const k = db.kandidaten.find((x) => x.id === id);
      if (k) k.mogelijkeDubbelVan = undefined;
    });
    revalidatePath("/discovery");
  });
}

// ---------- Verrijking (Epic 6) ----------
/** Verzamel voorstellen voor één partner: via internet (website zoeken + pagina's lezen) als externe bronnen aan staan, anders uit geplakte/profieltekst. */
async function verzamelVoorstellen(p: Partner, db: Database, tekst?: string): Promise<{ voorstellen: EnrichmentVoorstel[]; bronUrl: string; paginas: string[]; websiteGevonden: boolean }> {
  const voorstellen: EnrichmentVoorstel[] = [];
  let bronTekst = tekst ?? null;
  let bronUrl = tekst ? "handmatig aangeleverde openbare tekst" : p.website ?? "";
  let paginas: string[] = [];
  let websiteGevonden = false;
  if (!bronTekst && db.instellingen.externeBronnenToegestaan) {
    const web = await verrijkVanuitInternet(p);
    voorstellen.push(...web.voorstellen);
    paginas = web.paginas;
    websiteGevonden = web.websiteGevonden;
    if (web.tekst) {
      bronTekst = web.tekst;
      bronUrl = web.website ?? bronUrl;
    }
  }
  if (!bronTekst) {
    // Zonder externe bronnen of website: gebruik de al vastgelegde openbare profieltekst en referenties (bron web).
    bronTekst = [p.omschrijving, ...p.referenties].join(". ");
    bronUrl = bronUrl || "profieltekst";
    voorstellen.push(...extraheerVoorstellen(p, bronTekst, bronUrl));
  } else if (tekst) {
    voorstellen.push(...extraheerVoorstellen(p, bronTekst, bronUrl));
  }
  if (aiBeschikbaar() && bronTekst) {
    const ai = await aiFactorExtractie(p.naam, bronTekst, db.factoren);
    (ai ?? []).forEach((a) => {
      const f = db.factoren.find((x) => x.id === a.factorId);
      if (!f) return;
      const optieLabel = a.optieId ? f.opties?.find((o) => o.id === a.optieId)?.label : undefined;
      const huidig = p.factoren.find((x) => x.factorId === a.factorId && (x.optieId ?? "") === (a.optieId ?? ""));
      if (huidig && JSON.stringify(huidig.waarde) === JSON.stringify(a.waarde)) return;
      voorstellen.push({ id: nieuwId("ev-ai"), partnerId: p.id, factorId: a.factorId, veld: optieLabel ? `${f.naam}: ${optieLabel}` : f.naam, huidig: huidig?.waarde ?? null, voorgesteld: a.waarde, bron: "web", bronUrl, betrouwbaarheid: a.aantoonbaar ? 0.6 : 0.35, soort: a.aantoonbaar ? "aantoonbaar" : "geclaimd", citaat: `[Claude] ${a.citaat}`, status: "open", gevondenOp: new Date().toISOString() });
    });
  }
  // Eis 1: markeer per voorstel de aard (nieuw/gewijzigd) en of het afwijkt van een door een mens gevalideerde waarde.
  voorstellen.forEach((v) => {
    v.aard = v.aard ?? (v.huidig === null ? "nieuw" : "gewijzigd");
    if (!v.factorId) return;
    const huidige = p.factoren.find((x) => x.factorId === v.factorId && (v.veld.includes(":") ? Boolean(x.optieId) : !x.optieId));
    const f = db.factoren.find((x) => x.id === v.factorId);
    if (huidige && effectieveStatus(huidige, f) === "gevalideerd" && JSON.stringify(huidige.waarde) !== JSON.stringify(v.voorgesteld)) v.conflictMetGevalideerd = true;
  });
  return { voorstellen, bronUrl, paginas, websiteGevonden };
}

/** Schrijf nieuwe voorstellen (zonder dubbelen) naar de wachtrij en registreer de raadpleging bij de partner. */
async function bewaarVoorstellen(g: Gebruiker, entiteitId: string, nieuweVoorstellen: EnrichmentVoorstel[], geraadpleegd: Array<{ partnerId: string; paginas: string[] }>) {
  let toegevoegd = 0;
  await muteer(g, { entiteit: "verrijking", entiteitId, actie: "verrijkingsronde", details: `${nieuweVoorstellen.length} voorstellen` }, (db) => {
    const bestaand = new Set(db.verrijkingsvoorstellen.filter((x) => x.status === "open").map((x) => `${x.partnerId}|${x.veld}|${JSON.stringify(x.voorgesteld)}`));
    nieuweVoorstellen.forEach((v) => {
      const sleutel = `${v.partnerId}|${v.veld}|${JSON.stringify(v.voorgesteld)}`;
      if (bestaand.has(sleutel)) return;
      bestaand.add(sleutel);
      db.verrijkingsvoorstellen.unshift(v);
      toegevoegd++;
    });
    const vandaag = new Date().toISOString().slice(0, 10);
    geraadpleegd.forEach(({ partnerId, paginas }) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) return;
      p.bronnen = p.bronnen.filter((b) => b.soort !== "web-verrijking" || !paginas.includes(b.url));
      paginas.forEach((url) => p.bronnen.push({ url, opgehaaldOp: vandaag, soort: "web-verrijking" }));
    });
    db.instellingen.laatsteVerrijking = new Date().toISOString();
  });
  return toegevoegd;
}

export type VerrijkingUitkomst = { partners: number; voorstellen: number; nieuw: number; websitesGevonden: number; nogTeGaan: number };

/**
 * Verrijkingsronde: één partner (optioneel met geplakte tekst) of alle partners. Bij 'alle' worden per ronde maximaal
 * `maxPerRonde` partners via internet verrijkt (de minst recent geraadpleegde eerst) zodat de ronde binnen de tijd blijft.
 */
export async function startVerrijking(partnerId?: string, tekst?: string, maxPerRonde = 20) {
  return veilig(async (): Promise<VerrijkingUitkomst> => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    const laatstGeraadpleegd = (p: Partner) => p.bronnen.filter((b) => b.soort === "web-verrijking").map((b) => b.opgehaaldOp).sort().pop() ?? "";
    const kandidaten = partnerId ? db.partners.filter((p) => p.id === partnerId) : db.partners.filter((p) => p.status !== "geblokkeerd").sort((a, b) => laatstGeraadpleegd(a).localeCompare(laatstGeraadpleegd(b)));
    const doelen = partnerId ? kandidaten : kandidaten.slice(0, maxPerRonde);
    if (partnerId && !doelen.length) throw new Error("Partner niet gevonden.");
    const nieuweVoorstellen: EnrichmentVoorstel[] = [];
    const geraadpleegd: Array<{ partnerId: string; paginas: string[] }> = [];
    let websitesGevonden = 0;
    // Beperkte parallelliteit: vriendelijk voor de bronnen, snel genoeg voor een ronde.
    const wachtrij = [...doelen];
    await Promise.all(
      Array.from({ length: Math.min(4, wachtrij.length) }, async () => {
        for (let p = wachtrij.shift(); p; p = wachtrij.shift()) {
          try {
            const r = await verzamelVoorstellen(p, db, tekst);
            nieuweVoorstellen.push(...r.voorstellen);
            if (r.websiteGevonden) websitesGevonden++;
            geraadpleegd.push({ partnerId: p.id, paginas: r.paginas });
          } catch (e) {
            console.warn("Verrijking overgeslagen voor", p.naam, e instanceof Error ? e.message : e);
          }
        }
      })
    );
    const nieuw = await bewaarVoorstellen(g, partnerId ?? "alle", nieuweVoorstellen, geraadpleegd);
    revalidatePath("/verrijking");
    if (partnerId) revalidatePath(`/partners/${partnerId}`);
    return { partners: doelen.length, voorstellen: nieuweVoorstellen.length, nieuw, websitesGevonden, nogTeGaan: Math.max(0, kandidaten.length - doelen.length) };
  });
}

export async function beoordeelVoorstel(id: string, accepteer: boolean) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const dbLees = await getDb();
    const vooraf = dbLees.verrijkingsvoorstellen.find((x) => x.id === id);
    // Plaatswijziging: eerst geocoderen (netwerk), daarna pas muteren.
    const geo: Geo | null = accepteer && vooraf && !vooraf.factorId && vooraf.veld === BASISVELDEN.plaats ? ((await geocodeer(String(vooraf.voorgesteld)))?.locatie ?? null) : null;
    let partnerId: string | undefined;
    await muteer(g, { entiteit: "verrijking", entiteitId: id, actie: accepteer ? "voorstel geaccepteerd" : "voorstel afgewezen" }, (db) => {
      const v = db.verrijkingsvoorstellen.find((x) => x.id === id);
      if (!v) throw new Error("Voorstel niet gevonden.");
      v.status = accepteer ? "geaccepteerd" : "afgewezen";
      if (!accepteer) return;
      const p = db.partners.find((x) => x.id === v.partnerId);
      if (!p) return;
      partnerId = p.id;
      const nu = new Date().toISOString();
      if (!v.factorId) {
        // Basisveld (website, KVK, plaats, omschrijving, referentie).
        const waarde = String(v.voorgesteld);
        if (v.veld === BASISVELDEN.website) p.website = waarde;
        else if (v.veld === BASISVELDEN.kvk) p.kvk = waarde;
        else if (v.veld === BASISVELDEN.plaats) {
          p.vestigingsplaats = waarde;
          if (geo) {
            p.locatie = geo;
            p.tags = p.tags.filter((t) => t !== "locatie onbekend");
          }
        } else if (v.veld === BASISVELDEN.omschrijving) p.omschrijving = waarde;
        else if (v.veld === BASISVELDEN.referentie) {
          if (!p.referenties.includes(waarde)) p.referenties.push(waarde);
        } else throw new Error(`Onbekend veld '${v.veld}'.`);
        p.bronnen.push({ url: v.bronUrl ?? "", opgehaaldOp: v.gevondenOp.slice(0, 10), soort: "verrijking" });
        p.bijgewerktOp = nu;
        return;
      }
      const optieLabel = v.veld.includes(":") ? v.veld.split(":")[1].trim().toLowerCase() : undefined;
      const optie = optieLabel ? db.factoren.find((f) => f.id === v.factorId)?.opties?.find((o) => o.label.toLowerCase() === optieLabel || o.id === optieLabel.replace(/ /g, "_"))?.id : undefined;
      if (v.aard === "niet_bevestigd") {
        // 'Niet langer bevestigd' geaccepteerd: de waarde blijft staan maar wordt door een mens op 'verouderd' gezet.
        const doel = p.factoren.find((x) => x.factorId === v.factorId && (x.optieId ?? "") === (optie ?? "") && JSON.stringify(x.waarde) === JSON.stringify(v.huidig)) ?? p.factoren.find((x) => x.factorId === v.factorId && (x.optieId ?? "") === (optie ?? ""));
        if (doel) {
          doel.status = "verouderd";
          doel.toelichting = [doel.toelichting, `Niet langer bevestigd op ${v.bronUrl ?? "bron"} (${v.gevondenOp.slice(0, 10)}), beoordeeld door ${g.naam}.`].filter(Boolean).join(" ");
        }
        p.bronnen.push({ url: v.bronUrl ?? "", opgehaaldOp: v.gevondenOp.slice(0, 10), soort: "verrijking" });
        p.bijgewerktOp = nu;
        return;
      }
      // Acceptatie is een menselijke beoordeling: de nieuwe waarde is daarmee gevalideerd (eis 1).
      const record: PartnerFactor = { factorId: v.factorId, optieId: optie, waarde: v.voorgesteld as FactorWaarde, bron: "web", betrouwbaarheid: v.betrouwbaarheid, bewijs: { soort: "url", ref: v.bronUrl ?? "", label: v.bronUrl ?? "web" }, peildatum: v.gevondenOp.slice(0, 10), status: "gevalideerd", gevalideerdDoor: g.naam, gevalideerdOp: nu.slice(0, 10), toelichting: `${v.soort}: ${v.citaat}` };
      const idx = p.factoren.findIndex((x) => x.factorId === record.factorId && (x.optieId ?? "") === (record.optieId ?? ""));
      if (idx >= 0) p.factoren[idx] = record;
      else p.factoren.push(record);
      p.bronnen.push({ url: v.bronUrl ?? "", opgehaaldOp: v.gevondenOp.slice(0, 10), soort: "verrijking" });
      p.bijgewerktOp = nu;
    });
    revalidatePath("/verrijking");
    if (partnerId) revalidatePath(`/partners/${partnerId}`);
  });
}

// ---------- Herkomst (AVG, eis 1) ----------
/** AVG: exporteer alle herkomstinformatie (bron, datum, betrouwbaarheid, status per waarde) van één partner. */
export async function exporteerHerkomst(partnerId: string) {
  return veilig(async () => {
    await vereisRecht("lezen");
    const db = await getDb();
    const p = db.partners.find((x) => x.id === partnerId);
    if (!p) throw new Error("Partner niet gevonden.");
    return herkomstExport(p, db.factoren);
  });
}

/** AVG: verwijder alle herkomstinformatie van één partner (bronnen, bewijs, citaten, ruwe brondata). */
export async function wisHerkomstPartner(partnerId: string) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    const n = await muteer(g, { entiteit: "partner", entiteitId: partnerId, actie: "herkomst gewist (AVG)" }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      const n = wisHerkomst(p);
      p.bijgewerktOp = new Date().toISOString();
      return n;
    });
    revalidatePath(`/partners/${partnerId}`);
    return n;
  });
}

// ---------- Gewichtsprofielen met versiebeheer (US-44) ----------
export async function slaGewichtsprofielOp(id: string, perRol: Partial<Record<Rol, RequirementFactor[]>>, semantischGewicht: number, toelichting: string) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    const db = await getDb();
    for (const [rol, lijst] of Object.entries(perRol)) {
      const v = valideerGewichten(lijst ?? [], db.factoren);
      if (!v.geldig) throw new Error(`Rol ${rol}: gewichten tellen op tot ${v.som}%.`);
    }
    await muteer(g, { entiteit: "gewichtsprofiel", entiteitId: id, actie: "nieuwe versie", details: toelichting }, (db) => {
      const gp = db.gewichtsprofielen.find((x) => x.id === id);
      if (!gp) throw new Error("Profiel niet gevonden.");
      gp.versie += 1;
      gp.perRol = perRol;
      gp.semantischGewicht = semantischGewicht;
      gp.versies.push({ versie: gp.versie, op: new Date().toISOString(), door: g.naam, toelichting, snapshot: JSON.parse(JSON.stringify(perRol)) });
    });
    revalidatePath("/beheer/gewichten");
  });
}

export async function draaiGewichtsprofielTerug(id: string, versie: number) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "gewichtsprofiel", entiteitId: id, actie: `teruggedraaid naar v${versie}` }, (db) => {
      const gp = db.gewichtsprofielen.find((x) => x.id === id);
      const v = gp?.versies.find((x) => x.versie === versie);
      if (!gp || !v) throw new Error("Versie niet gevonden.");
      gp.versie += 1;
      gp.perRol = JSON.parse(JSON.stringify(v.snapshot));
      gp.versies.push({ versie: gp.versie, op: new Date().toISOString(), door: g.naam, toelichting: `Teruggedraaid naar versie ${versie}`, snapshot: JSON.parse(JSON.stringify(v.snapshot)) });
    });
    revalidatePath("/beheer/gewichten");
  });
}

export async function zetInstelling(sleutel: "aiProvider" | "externeBronnenToegestaan" | "afgeschermdeOmgeving", waarde: string | boolean) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "instellingen", entiteitId: sleutel, actie: `gewijzigd naar ${waarde}` }, (db) => {
      if (sleutel === "aiProvider") db.instellingen.aiProvider = waarde === "anthropic" ? "anthropic" : "uit";
      else db.instellingen[sleutel] = Boolean(waarde);
    });
    revalidatePath("/beheer");
  });
}
