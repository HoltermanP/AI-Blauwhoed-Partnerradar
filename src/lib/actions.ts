"use server";
// Alle mutaties van het systeem. Elke actie toetst rechten (US-45) en schrijft een auditregel (US-46).
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { after } from "next/server";
import { cookies } from "next/headers";
import { DEMO_GEBRUIKERS, heeftRecht, vereisRecht } from "./auth";
import { demoModus } from "@/authjs";
import { afwijsPenalty, demoConnector, kandidaatNaarConcept, normaliseerNaam, samenvattingVoor, vindDubbel } from "./domain/discovery";
import { extraheerVoorstellen, factorNogBevestigd, inhoudsHash, striptHtml } from "./domain/enrichment";
import { extraheerProjectprofiel } from "./domain/extractie";
import { haalBasisprofiel, kvkConnector, kvkKoppelingActief, sbiTekst, type KvkBasisprofiel } from "./domain/kvk";
import { controleerRegisters, teBevestigen, verwerkRegisterUitkomsten, type RegisterUitkomst } from "./domain/registers";
import { haalDocumentTekst } from "./documenttekst";
import { leidEisenAf } from "./domain/projectfactoren";
import { importeerEngagements } from "./domain/csv";
import { geocodeer } from "./domain/geocode";
import { rijNaarPartner, voegPartnersToe, voegRijenSamen, type ImportRij, type ImportUitkomst } from "./domain/partnerimport";
import { diagnoseTekst, kandidaatVanWebsite, laatsteZoekDiagnose, webzoekConnector, zoekUrls } from "./domain/webzoek";
import { ROL_LABEL } from "./format";
import { BASISVELD_VAN_LABEL, BASISVELDEN, haalDetailTekst, leesSbi, verrijkVanuitInternet, vindDetailLink } from "./domain/webverrijking";
import { basisveldenMomentopname, effectieveStatus, geenBronSleutel, herkomstExport, isGoudstandaard, markeerGeenBron, registreerHandmatigeBasisvelden, vulOntbrekendeHerkomst, wisGeenBron, wisHerkomst, zetBasisveldHerkomst } from "./domain/herkomst";
import { huidigeHerkomst, optieVanVoorstel, veldenZonderBron, verwerkVoorstellen } from "./domain/voorstellen";
import { gezochteVelden } from "./domain/goudstandaard";
import { aanvullingPlaatsen, laadAanvulling } from "./domain/aanvulling";
import { maakSeedIdGenerator } from "./domain/migratie";
import { aiBeschikbaar, aiChatOpgemaakt, aiZoekBedrijfswebsites, aiFactorExtractie, aiPartnerRegistratie, aiProjectExtractie, aiSamenvatting, alsAIBewerking, providerLabel, zetAanroepDoel } from "./ai";
import { zichtbaar } from "./domain/zichtbaarheid";
import { SYSTEEM_SLEUTEL, type SysteemSleutel } from "./systeem";
import { geldigeRollen, normaliseerWebsite, regelConcept, vrijgaveBlokkades, type RegistratieConcept } from "./domain/registratie";
import { chatContext } from "./domain/chat";
import { budgetStatus, schatVerrijkingsronde } from "./domain/kosten";
import { schemaVan, selecteerPartners } from "./domain/schema";
import type { BronConnector } from "./domain/discovery";
import { slaNuOp } from "./store";
import { matchProject, valideerGewichten } from "./domain/matching";
import { risicoklasse } from "./domain/signalen";
import { afgeleideTotaalscore, controleerTotaal } from "./domain/tevredenheid";
import { controleerVerwijderen, pseudoniem, verwijderPartnerDefinitief } from "./domain/verwijderen";
import { stelTeamSamen } from "./domain/team";
import type {
  BasisVeld,
  Bron,
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
  PartnerDocument,
  PartnerFactor,
  PartnerStatus,
  Project,
  ProjectRequirement,
  RequirementFactor,
  Rol,
  VerrijkingsSchema
} from "./domain/types";
import { BRON_BETROUWBAARHEID, KWALIFICATIE_ITEMS } from "./domain/types";
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
/** Demo-rolwisselaar: alleen zonder echte authenticatie in ontwikkelmodus (US-64). */
export async function wisselGebruiker(id: string) {
  if (!demoModus()) return;
  if (!DEMO_GEBRUIKERS.some((g) => g.id === id)) return;
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
  telefoon?: string;
  email?: string;
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
    if (invoer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invoer.email)) throw new Error("Het algemene e-mailadres is ongeldig.");
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
        const voor = basisveldenMomentopname(p);
        Object.assign(p, { ...invoer, telefoon: invoer.telefoon || undefined, email: invoer.email || undefined, kvk, locatie: geo, bijgewerktOp: nu });
        // US-52: handmatig gewijzigde basisvelden zijn door een mens vastgesteld (bron opgave, gevalideerd).
        registreerHandmatigeBasisvelden(p, voor, g.naam);
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
      registreerHandmatigeBasisvelden(nieuw, {}, g.naam);
      db.partners.push(nieuw);
      return nieuw.id;
    });
  }).then((r) => {
    revalidatePath("/partners");
    // B3: verrijking bij aanmaken — na de response, zodat de gebruiker niet wacht op internetbronnen.
    if (!id && r.ok && r.data) after(() => startVerrijking(String(r.data)).catch(() => undefined));
    return r;
  });
}

/** US-52: een basisveld handmatig bevestigen zet de status op gevalideerd, met naam en datum. Alleen een mens valideert. */
export async function bevestigBasisveld(partnerId: string, veld: BasisVeld) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "partner", entiteitId: partnerId, actie: `basisveld ${veld} bevestigd` }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      const vandaag = new Date().toISOString().slice(0, 10);
      const h = p.veldHerkomst?.[veld];
      zetBasisveldHerkomst(p, veld, { bron: h?.bron ?? "opgave", bronDetail: h?.bronDetail ?? "handmatig bevestigd", vastgesteldOp: h?.vastgesteldOp ?? vandaag, betrouwbaarheid: h?.betrouwbaarheid, status: "gevalideerd", gevalideerdDoor: g.naam, gevalideerdOp: vandaag });
    });
    revalidatePath(`/partners/${partnerId}`);
  });
}

export async function zetPartnerStatus(id: string, status: PartnerStatus, reden: string, geblokkeerdTot?: string) {
  return veilig(async () => {
    const recht = status === "preferred" || status === "geblokkeerd" ? "prospect_promoveren" : "bewerken";
    const g = await vereisRecht(recht);
    await muteer(g, { entiteit: "partner", entiteitId: id, actie: `status ${status}`, details: reden }, (db) => {
      const p = db.partners.find((x) => x.id === id);
      if (!p) throw new Error("Partner niet gevonden.");
      if (p.status === "concept" || status === "concept") throw new Error("Een concept (AI-voorstel) wordt alleen door een beheerder vrijgegeven of afgewezen, via de vrijgavewachtrij.");
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
    // US-49: goudstandaardwaarden zijn leidend; alleen de beheerder legt ze vast.
    if (factor.bron === "goudstandaard" && !heeftRecht(g.rol, "beheer")) throw new Error("Alleen een beheerder legt goudstandaardwaarden vast.");
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
      wisGeenBron(p, geenBronSleutel({ factorId: factor.factorId }));
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

export async function importeerPartners(rijen: ImportRij[], bronnaam: string, bron: Bron = "opgave") {
  return veilig(async (): Promise<ImportUitkomst> => {
    const g = await vereisRecht("bewerken");
    if (!["goudstandaard", "eigen_uitgave", "opgave", "document", "web"].includes(bron)) throw new Error("Ongeldige bron voor een import.");
    if ((bron === "goudstandaard") && !heeftRecht(g.rol, "beheer")) throw new Error("Alleen een beheerder importeert goudstandaardwaarden.");
    const gelezen = rijen.map((r) => rijNaarPartner(r, bron, BRON_BETROUWBAARHEID[bron])).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const partners = voegRijenSamen(gelezen);
    // Geocodeer vooraf (PDOK, met cache); onbekende plaats -> midden van Nederland met tag.
    const locaties = new Map<string, Geo | null>();
    for (const p of partners) if (p.plaats && !locaties.has(p.plaats)) locaties.set(p.plaats, (await geocodeer(p.plaats))?.locatie ?? null);
    const uitkomst = await muteer(g, { entiteit: "partner", entiteitId: "import", actie: "partners geïmporteerd", details: `${bronnaam}: ${partners.length} organisaties` }, (db) => voegPartnersToe(db, partners, locaties, bronnaam, nieuwId, bron));
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
    // US-63: projectnummer is uniek.
    const nummer = invoer.projectnummer?.trim() || undefined;
    invoer = { ...invoer, projectnummer: nummer };
    if (nummer) {
      const bestaand = (await getDb()).projecten.find((p) => p.projectnummer?.toLowerCase() === nummer.toLowerCase() && p.id !== id);
      if (bestaand) throw new Error(`Projectnummer ${nummer} is al in gebruik bij ${bestaand.naam}.`);
    }
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
    const g = await vereisRecht("bewerken");
    const regels = extraheerProjectprofiel(tekst);
    const ai = await alsAIBewerking("projectextractie", g.naam, "projectprofiel uit document", () => {
      zetAanroepDoel("projectextractie");
      return aiProjectExtractie(tekst);
    }, "extractie");
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
      provider: await providerLabel("extractie")
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
    const controle = controleerTotaal(ev);
    if (controle) throw new Error(controle);
    if (ev.totaalscore !== undefined && Math.abs(ev.totaalscore - afgeleideTotaalscore(ev)) <= 0.049) ev = { ...ev, totaalscore: undefined, totaalToelichting: undefined };
    await muteer(g, { entiteit: "evaluatie", entiteitId: ev.engagementId, actie: "beoordeling vastgelegd", details: `${ev.partnerId}: k${ev.kwaliteit} p${ev.planning} b${ev.budget} s${ev.samenwerking} d${ev.duurzaamheid}${ev.totaalscore !== undefined ? `; totaal bijgesteld naar ${ev.totaalscore}` : ""}` }, (db) => {
      db.evaluaties = db.evaluaties.filter((x) => x.engagementId !== ev.engagementId);
      db.evaluaties.push({ ...ev, id: nieuwId("ev"), door: g.naam, datum: ev.datum ?? new Date().toISOString().slice(0, 10) });
    });
    revalidatePath(`/projecten/${ev.projectId}`);
    revalidatePath(`/partners/${ev.partnerId}`);
  });
}

// ---------- Partnerregistratie door AI ----------
export type RegistratieInvoer = { naam?: string; website?: string; tekst?: string };

/**
 * Laat AI een partner registreren uit een naam, website en/of aangeleverde tekst. De partner krijgt status 'concept' (US-54)
 * met herkomst per veld en telt nergens mee tot een beheerder hem vrijgeeft (beoordeelRegistratie).
 */
export async function registreerPartnerViaAI(invoer: RegistratieInvoer) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const naamHint = invoer.naam?.trim() || undefined;
    const websiteHint = normaliseerWebsite(invoer.website);
    if (invoer.website?.trim() && !websiteHint) throw new Error("De website is geen geldige URL.");
    const tekst = invoer.tekst?.trim() ?? "";
    if (!naamHint && !websiteHint && tekst.length < 40) throw new Error("Geef een bedrijfsnaam, een website of een stuk tekst (minimaal 40 tekens) over de partner.");
    const db = await getDb();
    const extern = db.instellingen.externeBronnenToegestaan;
    if (!extern && !tekst) throw new Error("Externe bronnen staan uit (Beheer), dus de website kan niet worden gelezen. Plak een tekst over de partner.");

    const id = nieuwId("p");
    const nu = new Date().toISOString();
    const leeg: Partner = { id, naam: naamHint ?? "", kvk: "", rechtsvorm: "Onbekend", vestigingsplaats: "", locatie: { lat: 52.1, lng: 5.3 }, werkgebiedKm: 75, status: "concept", rollen: [], website: websiteHint, omschrijving: "", referenties: [], beschikbaarheid: [], factoren: [], certificaten: [], contactpersonen: [], kwalificatie: [], bronnen: [], tags: ["ai-registratie"], aangemaaktOp: nu, bijgewerktOp: nu };
    const web = extern && (naamHint || websiteHint) ? await verrijkVanuitInternet(leeg, new Date(), 25000) : null;
    const bronTekst = [tekst, web?.tekst].filter(Boolean).join("\n\n");
    if (!bronTekst) throw new Error(`Geen openbare informatie gevonden${naamHint ? ` voor '${naamHint}'` : ""}. Geef de website op of plak een tekst over de partner.`);

    const regels = regelConcept({ naam: naamHint, website: websiteHint }, tekst, web?.voorstellen ?? []);
    const ai = await alsAIBewerking("partnerregistratie", g.naam, `registratie ${naamHint ?? websiteHint ?? "uit tekst"}`, () => {
      zetAanroepDoel("partnerregistratie");
      return aiPartnerRegistratie({ naam: naamHint, website: web?.website ?? websiteHint }, bronTekst);
    }, "extractie");
    const concept: RegistratieConcept = ai
      ? {
          velden: {
            naam: naamHint ?? ai.naam ?? regels.velden.naam,
            kvk: (ai.kvk ?? "").replace(/\D/g, "") || regels.velden.kvk,
            rechtsvorm: ai.rechtsvorm ?? regels.velden.rechtsvorm,
            vestigingsplaats: ai.vestigingsplaats ?? regels.velden.vestigingsplaats,
            adres: ai.adres,
            rollen: geldigeRollen(ai.rollen).length ? geldigeRollen(ai.rollen) : regels.velden.rollen,
            website: websiteHint ?? normaliseerWebsite(ai.website) ?? regels.velden.website,
            omschrijving: (ai.omschrijving ?? regels.velden.omschrijving).slice(0, 600),
            referenties: ai.referenties.length ? ai.referenties.slice(0, 8) : regels.velden.referenties,
            medewerkers: ai.medewerkers
          },
          herkomst: ai.herkomst,
          waarschuwingen: ai.watIsOnzeker
        }
      : regels;
    const v = concept.velden;
    if (!v.naam) throw new Error("Er kon geen bedrijfsnaam worden vastgesteld. Geef de naam op.");
    if (v.kvk && !/^\d{8}$/.test(v.kvk)) {
      concept.waarschuwingen.push(`Gevonden KVK-nummer '${v.kvk}' is geen 8 cijfers en is weggelaten.`);
      v.kvk = "";
    }
    const dubbel = vindDubbel({ naam: v.naam, kvk: v.kvk || undefined, adres: v.adres, vestigingsplaats: v.vestigingsplaats }, db.partners);
    if (dubbel && v.kvk && dubbel.partner.kvk === v.kvk) throw new Error(`KVK ${v.kvk} bestaat al: ${dubbel.partner.naam} (${dubbel.partner.id}).`);
    if (dubbel) concept.waarschuwingen.push(`Mogelijke dubbel: ${dubbel.reden}.`);
    const gevonden = v.vestigingsplaats ? ((v.adres ? await geocodeer(`${v.adres}, ${v.vestigingsplaats}`) : null) ?? (await geocodeer(v.vestigingsplaats))) : null;
    if (v.vestigingsplaats && !gevonden) {
      concept.waarschuwingen.push(`Vestigingsplaats '${v.vestigingsplaats}' kon niet worden gevonden; vul hem in via Bewerken.`);
      v.vestigingsplaats = "";
    }
    if (!v.rollen.length) concept.waarschuwingen.push("Geen rol vastgesteld; kies er een vóór vrijgave.");

    const partner: Partner = {
      ...leeg,
      ...v,
      locatie: gevonden?.locatie ?? leeg.locatie,
      statusReden: `Door AI geregistreerd op verzoek van ${g.naam}; wacht op controle door een beheerder.`,
      bronnen: (web?.paginas ?? []).map((url) => ({ url, opgehaaldOp: nu, soort: "web (AI-registratie)" })),
      registratie: {
        herkomstSoort: "ai-registratie",
        aangevraagdDoor: g.naam,
        op: nu,
        provider: ai ? "Claude" : "regels (geen externe AI)",
        bronnen: [...(web?.paginas ?? []), ...(tekst ? ["aangeleverde tekst"] : [])],
        herkomst: concept.herkomst,
        waarschuwingen: concept.waarschuwingen,
        mogelijkeDubbelVan: dubbel ? `${dubbel.partner.id}|${dubbel.reden}` : undefined
      }
    };
    // US-52: herkomst per basisveld — AI-registratie uit website is indicatief, uit aangeleverde tekst een aangeleverd document.
    vulOntbrekendeHerkomst(partner, { bron: web?.paginas.length ? "web" : "document", status: "voorgesteld", bronDetail: partner.registratie!.bronnen.join(", ") || undefined });
    concept.herkomst.forEach((h) => {
      const veld = ({ kvk: "kvk", website: "website", vestigingsplaats: "vestigingsplaats", plaats: "vestigingsplaats", omschrijving: "omschrijving", rechtsvorm: "rechtsvorm", adres: "adres" } as Record<string, BasisVeld>)[h.veld.toLowerCase()];
      const vh = veld ? partner.veldHerkomst?.[veld] : undefined;
      if (vh) vh.betrouwbaarheid = h.betrouwbaarheid;
    });
    await muteer(g, { entiteit: "partner", entiteitId: id, actie: "aangemaakt via AI (concept)", details: `${partner.naam}; bronnen: ${partner.registratie!.bronnen.join(", ") || "–"}` }, (db) => {
      db.partners.push(partner);
    });
    revalidatePath("/partners");
    return id;
  });
}

/** US-54: alleen de beheerder geeft een concept (AI-registratie, discovery, AI-aandraag) vrij als bekend of prospect, of wijst het af. */
export async function beoordeelRegistratie(id: string, besluit: "vrijgegeven" | "afgewezen", nieuweStatus: "bekend" | "prospect", toelichting: string) {
  const r = await veilig(async () => {
    const g = await vereisRecht("partners_vrijgeven");
    if (besluit === "afgewezen" && !toelichting.trim()) throw new Error("Afwijzen vraagt om een toelichting.");
    await muteer(g, { entiteit: "partner", entiteitId: id, actie: besluit === "vrijgegeven" ? `concept vrijgegeven (${nieuweStatus})` : "concept afgewezen", details: toelichting || undefined }, (db) => {
      const p = db.partners.find((x) => x.id === id);
      if (!p) throw new Error("Partner niet gevonden.");
      if (p.status !== "concept") throw new Error("Deze partner is geen concept (meer) en wacht niet op vrijgave.");
      if (besluit === "vrijgegeven") {
        const blokkades = vrijgaveBlokkades(p);
        if (blokkades.length) throw new Error(`Nog niet vrij te geven: ${blokkades.join(" ")} Pas de gegevens aan via Bewerken.`);
        if (p.registratie?.mogelijkeDubbelVan && !toelichting.trim()) throw new Error("Er is een mogelijke dubbel gesignaleerd; licht toe waarom dit een aparte partner is.");
      }
      const nu = new Date().toISOString();
      p.status = besluit === "vrijgegeven" ? nieuweStatus : "afgewezen";
      p.statusReden = besluit === "vrijgegeven" ? `AI-voorstel vrijgegeven door ${g.naam}${toelichting ? `: ${toelichting}` : ""}` : `AI-voorstel afgewezen door ${g.naam}: ${toelichting}`;
      // Een afgewezen concept blijft bewaard (niet gewist), maar telt nergens mee: gearchiveerd met reden.
      if (besluit === "afgewezen") p.status = "gearchiveerd";
      p.registratie = { ...(p.registratie ?? { aangevraagdDoor: "onbekend", op: p.aangemaaktOp, provider: "onbekend", bronnen: [], herkomst: [], waarschuwingen: [] }), besluit, beoordeeldDoor: g.naam, beoordeeldOp: nu, toelichting: toelichting || undefined };
      p.bijgewerktOp = nu;
    });
  });
  revalidatePath("/partners");
  revalidatePath("/vrijgave");
  revalidatePath(`/partners/${id}`);
  // Na vrijgave: factorwaarden laten voorstellen (na de response; de beheerder wacht niet op internetbronnen).
  if (r.ok && besluit === "vrijgegeven") after(() => startVerrijking(id).catch(() => undefined));
  return r;
}

// ---------- Discovery (Epic 5) ----------
export type DiscoveryUitkomst = { gevonden: number; nieuw: number; alInWachtrij: number; mogelijkeDubbelen: number; bronnen: string[]; regio?: string; melding?: string };

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
    const diagnose = laatsteZoekDiagnose;
    const bronnamen = connectors.map((c) => c.naam);
    let melding: string | undefined;
    // Locatie en AI-samenvatting vóór de mutatie (async), zodat de mutatie zelf synchroon blijft. Eén discovery-run = één AI-bewerking.
    const verrijkt = await alsAIBewerking("discovery", g.naam, `discovery ${rollen.join(",")} ${trefwoorden}`.trim(), async () => {
      // Terugval: blokkeren de zoekmachines het verkeer van de server, dan zoekt Claude (web search) de bedrijfswebsites op.
      if (!gevonden.length && db.instellingen.externeBronnenToegestaan && aiBeschikbaar()) {
        const extra = woorden.filter((w) => w.length > 4).slice(0, 3).join(" ");
        const vragen = rollen.map((r) => `${ROL_LABEL[r].toLowerCase()} woningbouw ${extra} ${regio ?? ""}`.replace(/\s+/g, " ").trim());
        zetAanroepDoel("bedrijfswebsites zoeken (terugval)");
        const urls = (await aiZoekBedrijfswebsites(vragen)) ?? [];
        const gelezen = await Promise.all(urls.map((u, i) => kandidaatVanWebsite(u, rollen[i % rollen.length], "Webzoek via Claude", vragen[i % vragen.length], regio || undefined)));
        gelezen.forEach((k) => k && gevonden.push(k));
        if (urls.length) bronnamen.push("Webzoek via Claude (terugval)");
      }
      return Promise.all(
        gevonden.map(async (k) => {
          const locatie = k.locatie ?? (k.vestigingsplaats ? (await geocodeer(k.vestigingsplaats))?.locatie : undefined);
          const tekst = String(k.ruweData.websiteTekst ?? k.ruweData.profiel ?? "");
          const samenvatting = aiBeschikbaar() && tekst ? await aiSamenvatting({ ...k, id: "", status: "nieuw", opgehaaldOp: "" }, project, tekst) : null;
          return { ...k, locatie, samenvatting: samenvatting ?? undefined };
        })
      );
    }, "aandragen");
    if (!gevonden.length) {
      const geblokkeerd = diagnose.some((d) => d.geblokkeerd);
      melding = geblokkeerd
        ? `De zoekmachines gaven geen resultaat terug of weigerden het verzoek van de server (${diagnoseTekst(diagnose)}). Dit gebeurt vaak bij hosting in een datacenter.${aiBeschikbaar() ? " Ook de terugval via Claude vond geen bedrijfswebsites." : " Met een ANTHROPIC_API_KEY zoekt de app dan via Claude; of stel KVK_API_KEY in voor het KVK-register."}`
        : `Geen bedrijfswebsites gevonden voor deze zoekopdracht (${diagnoseTekst(diagnose) || "geen zoekopdrachten uitgevoerd"}). Probeer bredere trefwoorden of een andere regio.`;
    }
    const nu = new Date().toISOString();
    const uitkomst = await muteer(g, { entiteit: "discovery", entiteitId: projectId ?? "algemeen", actie: "zoekopdracht gestart", details: `${rollen.join(", ")}; ${trefwoorden}${regio ? `; regio ${regio}` : ""}` }, (db) => {
      const u: DiscoveryUitkomst = { gevonden: gevonden.length, nieuw: 0, alInWachtrij: 0, mogelijkeDubbelen: 0, bronnen: bronnamen, regio: regio || undefined, melding };
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
    // US-54: accepteren maakt geen zichtbare partner meer, maar een concept dat een beheerder vrijgeeft.
    const g = await vereisRecht("discovery_goedkeuren");
    if (beslissing === "afgewezen" && !reden?.trim()) throw new Error("Afwijzen vraagt om een reden; die traint de filtering.");
    await muteer(g, { entiteit: "discovery", entiteitId: id, actie: beslissing, details: reden }, (db) => {
      const k = db.kandidaten.find((x) => x.id === id);
      if (!k) throw new Error("Kandidaat niet gevonden.");
      // Eerst controleren, dan muteren: een mogelijke dubbel mag de kandidaat niet half-geaccepteerd achterlaten.
      if (beslissing === "geaccepteerd" && k.mogelijkeDubbelVan) throw new Error("Mogelijke dubbel: koppel eerst aan de bestaande partner of markeer als geen dubbel.");
      k.status = beslissing;
      k.reden = reden;
      k.beoordeeldOp = new Date().toISOString();
      k.beoordeeldDoor = g.naam;
      if (beslissing === "afgewezen") db.afwijsredenen.push({ reden: reden!, op: k.beoordeeldOp, kandidaatNaam: k.naam });
      if (beslissing === "geaccepteerd") {
        const p = kandidaatNaarConcept(k, g.naam);
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

// ---------- Chat over het partnerbestand (B5) ----------
export type ChatAntwoord = { antwoord: string; partners: Array<{ id: string; naam: string }>; viaAI: boolean; bronnen: Array<{ titel: string; url: string }>; metInternet: boolean };

/**
 * B5: beantwoord een vraag over het partnerbestand, als Markdown (wordt als HTML getoond). Partnergegevens komen
 * uitsluitend uit databaserecords; met `metInternet` zoekt de chat daarnaast op internet (indicatief, met bronnen).
 * Elke vraag is één AI-bewerking. Zonder API-sleutel: semantische treffers en, met internet, zoekresultaten als links.
 */
export async function stelChatVraag(vraag: string, historie: Array<{ vraag: string; antwoord: string }> = [], metInternet = false) {
  return veilig(async (): Promise<ChatAntwoord> => {
    const g = await vereisRecht("lezen");
    if (!vraag.trim()) throw new Error("Stel een vraag.");
    const db = await getDb();
    if (metInternet && !db.instellingen.externeBronnenToegestaan) throw new Error("Externe bronnen staan uit (Beheer); zoeken op internet is daardoor niet mogelijk.");
    const { partners, records } = chatContext(db, vraag);
    if (aiBeschikbaar()) {
      const r = await alsAIBewerking("chat", g.naam, `${metInternet ? "[met internet] " : ""}${vraag.slice(0, 120)}`, () => {
        zetAanroepDoel(metInternet ? "chatvraag met web search" : "chatvraag");
        return aiChatOpgemaakt(vraag, JSON.stringify(records), historie.slice(-4), metInternet);
      }, "chat");
      if (r) {
        const genoemd = r.partnerIds.map((id) => db.partners.find((p) => p.id === id)).filter((p): p is Partner => Boolean(p) && zichtbaar(p!) && records.some((x) => x.id === p!.id));
        return { antwoord: r.antwoord, partners: genoemd.map((p) => ({ id: p.id, naam: p.naam })), viaAI: true, bronnen: r.bronnen, metInternet };
      }
    }
    // Terugval zonder AI: semantische treffers als opgemaakte lijst, en met internet de zoekresultaten als links.
    const lijst = partners.slice(0, 8);
    const regels = [
      "### Uit het partnerbestand",
      lijst.length
        ? `De partnerrecords die het best bij de vraag passen (semantisch, zonder AI):\n\n| Partner | Rol | Plaats |\n| --- | --- | --- |\n${lijst.map((p) => `| **${p.naam.replace(/\|/g, "/")}** | ${p.rollen.map((x) => ROL_LABEL[x]).join(", ")} | ${p.vestigingsplaats || "–"} |`).join("\n")}`
        : "Geen passende partners gevonden in de database voor deze vraag."
    ];
    let bronnen: Array<{ titel: string; url: string }> = [];
    if (metInternet) {
      const urls = await zoekUrls(vraag, 6);
      bronnen = urls.map((u) => ({ titel: new URL(u).hostname.replace(/^www\./, ""), url: u }));
      regels.push("### Van internet (indicatief – niet gevalideerd)", bronnen.length ? "Zoekresultaten zonder samenvatting (AI staat uit); zie de bronnen hieronder." : "Geen zoekresultaten gevonden.");
    }
    if (!aiBeschikbaar()) regels.push("_AI staat uit (geen ANTHROPIC_API_KEY): er is geen gegenereerd antwoord._");
    return { antwoord: regels.join("\n\n"), partners: lijst.map((p) => ({ id: p.id, naam: p.naam })), viaAI: false, bronnen, metInternet };
  });
}

// ---------- Zoekprofielen (B4) ----------
export async function slaZoekprofielOp(naam: string, rollen: Rol[], trefwoorden: string, regio?: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!naam.trim()) throw new Error("Geef het zoekprofiel een naam.");
    if (!rollen.length) throw new Error("Een zoekprofiel heeft minstens één rol.");
    await muteer(g, { entiteit: "zoekprofiel", entiteitId: naam, actie: "zoekprofiel opgeslagen", details: `${rollen.join(", ")}; ${trefwoorden}` }, (db) => {
      const bestaand = db.zoekprofielen.find((z) => z.naam.toLowerCase() === naam.trim().toLowerCase());
      if (bestaand) Object.assign(bestaand, { rollen, trefwoorden, regio, door: g.naam, op: new Date().toISOString() });
      else db.zoekprofielen.push({ id: nieuwId("zp"), naam: naam.trim(), rollen, trefwoorden, regio, door: g.naam, op: new Date().toISOString() });
    });
    revalidatePath("/discovery");
  });
}

export async function verwijderZoekprofiel(id: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "zoekprofiel", entiteitId: id, actie: "zoekprofiel verwijderd" }, (db) => {
      db.zoekprofielen = db.zoekprofielen.filter((z) => z.id !== id);
    });
    revalidatePath("/discovery");
  });
}

// ---------- Verrijking (Epic 6) ----------
type ExtraBron = { naam: string; url: string; tekst: string; html: string; bron: Bron };

/** Haal de geconfigureerde extra bronwebsites (Conceptenboulevard, Woningconceptenbrochure, …) één keer per ronde op: tekst plus HTML (voor detaillinks per partner). */
async function haalExtraBronnen(db: Database): Promise<ExtraBron[]> {
  if (!db.instellingen.externeBronnenToegestaan) return [];
  const actief = (db.instellingen.verrijkingsbronnen ?? []).filter((b) => b.actief);
  const r = await Promise.all(
    actief.map(async (b) => {
      try {
        const res = await fetch(b.url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (verrijking; alleen openbare bedrijfsinformatie)", accept: "text/html" } });
        if (!res.ok) return null;
        const html = await res.text();
        return { naam: b.naam, url: b.url, html, tekst: striptHtml(html).slice(0, 60000), bron: (b.categorie === "eigen_uitgave" ? "eigen_uitgave" : "web") as Bron };
      } catch {
        return null;
      }
    })
  );
  return r.filter((b): b is ExtraBron => Boolean(b?.tekst));
}

type DocTekst = { docId: string; tekst?: string; melding?: string };
type VerzamelUitkomst = { voorstellen: EnrichmentVoorstel[]; paginas: string[]; websiteGevonden: boolean; webHash?: string; overgeslagen: boolean; geenBron: string[]; doorzocht: string[]; documentTeksten?: DocTekst[]; registers?: RegisterUitkomst[] };
type Geraadpleegd = { partnerId: string; paginas: string[]; webHash?: string; overgeslagen: boolean; geenBron?: string[]; doorzocht?: string[]; documentTeksten?: DocTekst[]; registers?: RegisterUitkomst[] };

/** Openbare pagina als platte tekst (voor registers); null als de bron niet bereikbaar is. */
async function haalPlatteTekst(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (certificaatverificatie; alleen openbare registers)", accept: "text/html,application/json" } });
    if (!res.ok) return null;
    return striptHtml(await res.text()).slice(0, 200000);
  } catch {
    return null;
  }
}

/** US-60: voorstellen uit het KVK Basisprofiel (bron 'KVK – gevalideerde registratie', rang 2). */
function kvkVoorstellen(p: Partner, profiel: KvkBasisprofiel): EnrichmentVoorstel[] {
  const nu = new Date().toISOString();
  const bronUrl = `KVK-handelsregister, Basisprofiel ${profiel.kvkNummer}`;
  const uit: EnrichmentVoorstel[] = [];
  const voeg = (veld: string, huidig: string | undefined, nieuw: string | undefined) => {
    if (!nieuw || (huidig ?? "").trim().toLowerCase() === nieuw.trim().toLowerCase()) return;
    uit.push({ id: nieuwId("ev-kvk"), partnerId: p.id, veld, huidig: huidig || null, voorgesteld: nieuw, bron: "kvk", bronUrl, betrouwbaarheid: 0.9, soort: "aantoonbaar", citaat: `${veld} volgens het KVK-handelsregister (Basisprofiel ${profiel.kvkNummer}): ${nieuw}`, status: "open", gevondenOp: nu });
  };
  voeg(BASISVELDEN.statutaireNaam, p.statutaireNaam, profiel.statutaireNaam);
  voeg(BASISVELDEN.rechtsvorm, p.rechtsvorm === "Onbekend" ? "" : p.rechtsvorm, profiel.rechtsvorm);
  voeg(BASISVELDEN.sbi, sbiTekst(p.sbiActiviteiten ?? []), profiel.sbiActiviteiten.length ? sbiTekst(profiel.sbiActiviteiten) : undefined);
  voeg(BASISVELDEN.adres, p.adres, profiel.adres);
  voeg(BASISVELDEN.plaats, p.vestigingsplaats, profiel.plaats);
  voeg(BASISVELDEN.oprichtingsdatum, p.oprichtingsdatum, profiel.oprichtingsdatum);
  return uit;
}

/**
 * Verzamel voorstellen voor één partner: via internet (website zoeken + pagina's lezen) als externe bronnen aan staan,
 * anders uit geplakte/profieltekst. Delta-selectie: is de webinhoud niet gewijzigd sinds de vorige ronde, dan wordt de
 * partner overgeslagen. Web-waarden die niet meer op de bron terug te vinden zijn, worden 'niet langer bevestigd'.
 */
async function verzamelVoorstellen(p: Partner, db: Database, tekst?: string, extraBronnen: ExtraBron[] = [], alleenGewijzigd = false): Promise<VerzamelUitkomst> {
  const voorstellen: EnrichmentVoorstel[] = [];
  let bronTekst = tekst ?? null;
  let bronUrl = tekst ? "handmatig aangeleverde openbare tekst" : p.website ?? "";
  let paginas: string[] = [];
  let websiteGevonden = false;
  let webHash: string | undefined;
  let vanInternet = false;
  let ongewijzigd = false;
  if (!bronTekst && db.instellingen.externeBronnenToegestaan) {
    const web = await verrijkVanuitInternet(p);
    voorstellen.push(...web.voorstellen);
    paginas = web.paginas;
    websiteGevonden = web.websiteGevonden;
    if (web.tekst) {
      bronTekst = web.tekst;
      bronUrl = web.website ?? bronUrl;
      vanInternet = true;
      webHash = inhoudsHash(web.tekst);
      // Delta-selectie (US-59): alleen wat sinds de vorige ronde gewijzigd kan zijn wordt opnieuw geëxtraheerd; een
      // ongewijzigde website kost geen AI-bewerking. Extra bronnen en documenten worden (regelgebaseerd) wel gelezen.
      ongewijzigd = Boolean(p.webHash && p.webHash === webHash);
      if (ongewijzigd && (alleenGewijzigd || !extraBronnen.length)) return { voorstellen: [], paginas, websiteGevonden, webHash, overgeslagen: true, geenBron: [], doorzocht: paginas };
      if (ongewijzigd) voorstellen.length = 0;
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
  const extraDoorzocht: string[] = [];
  // US-60: KVK-handelsregister (Basisprofiel) voor partners met een KVK-nummer, als de koppeling actief is.
  if (db.instellingen.externeBronnenToegestaan && kvkKoppelingActief() && /^\d{8}$/.test(p.kvk)) {
    const profiel = await haalBasisprofiel(p.kvk);
    extraDoorzocht.push("KVK-handelsregister (Basisprofiel)");
    if (profiel) voorstellen.push(...kvkVoorstellen(p, profiel));
  }
  // US-61: nog niet gelezen geüploade documenten (PDF, Word, tekst) eerst lezen; de tekst wordt bij het document bewaard.
  const documentTeksten: DocTekst[] = [];
  for (const d of (p.documenten ?? []).filter((d) => d.bestandUrl && !d.geextraheerdeTekst && !d.extractieMelding)) {
    const r = await haalDocumentTekst(d.bestandUrl!, d.bestandType, d.naam);
    documentTeksten.push({ docId: d.id, ...r });
    if (r.tekst) d.geextraheerdeTekst = r.tekst; // lokaal voor deze ronde; de mutatie legt het vast
  }
  // US-62: openbare keurmerk- en brancheregisters.
  const registers = db.instellingen.externeBronnenToegestaan ? await controleerRegisters(p, db.instellingen.registerbronnen ?? [], haalPlatteTekst) : [];
  registers.forEach((u) => extraDoorzocht.push(u.url));
  teBevestigen(p, registers).forEach((u) => {
    const bestaat = p.certificaten.some((c) => c.type === u.certificaat);
    voorstellen.push({ id: nieuwId("ev-reg"), partnerId: p.id, veld: `Certificaat: ${u.certificaat}`, huidig: bestaat ? "geclaimd" : null, voorgesteld: `${u.certificaat} (gevonden in ${u.register})`, bron: "register", bronUrl: u.url, betrouwbaarheid: 0.9, soort: "aantoonbaar", citaat: `${p.naam} lijkt voor te komen in ${u.register} (${u.op}); controleer de registerpagina. Accepteren zet het certificaat op geverifieerd met dit register als bron${bestaat ? "" : "; nummer en geldigheid nog aanvullen"}.`, status: "open", gevondenOp: new Date().toISOString() });
  });
  // Extra geconfigureerde bronwebsites (Conceptenboulevard, Woningconceptenbrochure, …): zoek de partnernaam in de
  // overzichtstekst en volg waar mogelijk de detailpagina van de partner (bijv. /aanbieders/<naam>/).
  const naam = normaliseerNaam(p.naam);
  for (const b of extraBronnen) {
    const idx = normaliseerNaam(b.tekst).indexOf(naam);
    if (idx >= 0) {
      const context = b.tekst.slice(Math.max(0, idx - 600), idx + naam.length + 600);
      voorstellen.push(...extraheerVoorstellen(p, context, b.url, new Date(), b.bron));
    }
    const detailUrl = vindDetailLink(b.html, b.url, p.naam);
    if (detailUrl) {
      const detail = await haalDetailTekst(detailUrl);
      if (detail && normaliseerNaam(detail).includes(naam)) {
        voorstellen.push(...extraheerVoorstellen(p, detail, detailUrl, new Date(), b.bron));
        if (detail.length > 60 && (!p.omschrijving || p.omschrijving.length < 60)) {
          voorstellen.push({ id: nieuwId("ev-bron"), partnerId: p.id, veld: BASISVELDEN.omschrijving, huidig: p.omschrijving || null, voorgesteld: detail.slice(0, 400), bron: b.bron, bronUrl: detailUrl, betrouwbaarheid: b.bron === "eigen_uitgave" ? 0.9 : 0.5, soort: "geclaimd", citaat: detail.slice(0, 200), status: "open", gevondenOp: new Date().toISOString() });
        }
      }
    }
  }
  // US-61: aangeleverde documenten (geplakte tekst en de uit PDF/Word gelezen tekst) zijn bron 'aangeleverd document' (rang 2).
  (p.documenten ?? []).forEach((d) => {
    const docTekst = [d.tekst, d.geextraheerdeTekst].filter(Boolean).join("\n\n");
    if (docTekst) voorstellen.push(...extraheerVoorstellen(p, docTekst, `document: ${d.naam}${d.bestandUrl ? ` (${d.bestandUrl})` : d.url ? ` (${d.url})` : ""}`, new Date(), "document"));
  });
  if (aiBeschikbaar() && bronTekst && !ongewijzigd) {
    const ai = await aiFactorExtractie(p.naam, bronTekst, db.factoren);
    (ai ?? []).forEach((a) => {
      const f = db.factoren.find((x) => x.id === a.factorId);
      if (!f) return;
      const optieLabel = a.optieId ? f.opties?.find((o) => o.id === a.optieId)?.label : undefined;
      const huidig = p.factoren.find((x) => x.factorId === a.factorId && (x.optieId ?? "") === (a.optieId ?? ""));
      if (huidig && JSON.stringify(huidig.waarde) === JSON.stringify(a.waarde)) return;
      voorstellen.push({ id: nieuwId("ev-ai"), partnerId: p.id, factorId: a.factorId, optieId: a.optieId, veld: optieLabel ? `${f.naam}: ${optieLabel}` : f.naam, huidig: huidig?.waarde ?? null, voorgesteld: a.waarde, bron: "web", bronUrl, betrouwbaarheid: a.aantoonbaar ? 0.6 : 0.35, soort: a.aantoonbaar ? "aantoonbaar" : "geclaimd", citaat: `[Claude] ${a.citaat}`, status: "open", gevondenOp: new Date().toISOString() });
    });
  }
  // 'Niet langer bevestigd': eerder van het web overgenomen waarden waarvan geen enkel patroon meer op de bron matcht.
  if (vanInternet && bronTekst && !ongewijzigd) {
    const nu = new Date().toISOString();
    p.factoren
      .filter((f) => f.bron === "web" && !f.afgeleid && effectieveStatus(f, db.factoren.find((x) => x.id === f.factorId)) !== "verouderd")
      .forEach((f) => {
        if (factorNogBevestigd(f.factorId, bronTekst!)) return;
        const def = db.factoren.find((x) => x.id === f.factorId);
        const veld = def ? (f.optieId ? `${def.naam}: ${def.opties?.find((o) => o.id === f.optieId)?.label ?? f.optieId}` : def.naam) : f.factorId;
        voorstellen.push({ id: nieuwId("ev-nb"), partnerId: p.id, factorId: f.factorId, veld, huidig: f.waarde, voorgesteld: f.waarde, bron: "web", bronUrl, betrouwbaarheid: 0.5, soort: "geclaimd", aard: "niet_bevestigd", citaat: `De eerder gevonden waarde is bij deze ronde niet meer op ${bronUrl} aangetroffen. Accepteren markeert de waarde als verouderd.`, status: "open", gevondenOp: nu });
      });
  }
  // Eis 1 / US-50 / US-52: aard, conflicten met gevalideerde waarden (factoren én basisvelden) en alternatieven op bronrang.
  verwerkVoorstellen(p, voorstellen, db.factoren);
  // US-53: gezochte velden zonder enige bron blijven leeg en worden gemarkeerd, met de doorzochte bronnen.
  const doorzocht = [
    ...(paginas.length ? paginas : db.instellingen.externeBronnenToegestaan ? ["zoekmachine (DuckDuckGo): geen passende website"] : []),
    ...extraBronnen.map((b) => b.url),
    ...(p.documenten ?? []).filter((d) => d.tekst || d.geextraheerdeTekst).map((d) => `document: ${d.naam}`),
    ...(tekst ? ["aangeleverde tekst"] : []),
    ...extraDoorzocht
  ];
  const geenBron = doorzocht.length ? veldenZonderBron(p, voorstellen, gezochteVelden(p, db)) : [];
  return { voorstellen, paginas, websiteGevonden, webHash, overgeslagen: false, geenBron, doorzocht, documentTeksten, registers };
}

/** Schrijf nieuwe voorstellen (zonder dubbelen) naar de wachtrij, registreer raadpleging + inhoudshash, en werk de ronde bij. */
async function bewaarVoorstellen(g: Gebruiker, entiteitId: string, nieuweVoorstellen: EnrichmentVoorstel[], geraadpleegd: Geraadpleegd[], rondeId?: string, rondeKlaar?: boolean) {
  let toegevoegd = 0;
  await muteer(g, { entiteit: "verrijking", entiteitId, actie: "verrijkingsronde", details: `${nieuweVoorstellen.length} voorstellen` }, (db) => {
    const bestaand = new Set(db.verrijkingsvoorstellen.filter((x) => x.status === "open").map((x) => `${x.partnerId}|${x.veld}|${JSON.stringify(x.voorgesteld)}|${x.aard ?? ""}`));
    const geteld = { nieuw: 0, gewijzigd: 0, nietBevestigd: 0 };
    nieuweVoorstellen.forEach((v) => {
      const sleutel = `${v.partnerId}|${v.veld}|${JSON.stringify(v.voorgesteld)}|${v.aard ?? ""}`;
      if (bestaand.has(sleutel)) return;
      bestaand.add(sleutel);
      v.rondeId = rondeId;
      db.verrijkingsvoorstellen.unshift(v);
      toegevoegd++;
      if (v.aard === "niet_bevestigd") geteld.nietBevestigd++;
      else if (v.aard === "nieuw") geteld.nieuw++;
      else geteld.gewijzigd++;
    });
    const vandaag = new Date().toISOString().slice(0, 10);
    geraadpleegd.forEach(({ partnerId, paginas, webHash, geenBron, doorzocht, documentTeksten, registers }) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) return;
      (documentTeksten ?? []).forEach((t) => {
        const d = p.documenten?.find((x) => x.id === t.docId);
        if (!d) return;
        d.geextraheerdeTekst = t.tekst;
        d.extractieMelding = t.melding;
        d.tekstGeextraheerdOp = vandaag;
      });
      if (registers?.length) verwerkRegisterUitkomsten(p, registers);
      p.bronnen = p.bronnen.filter((b) => b.soort !== "web-verrijking" || !paginas.includes(b.url));
      paginas.forEach((url) => p.bronnen.push({ url, opgehaaldOp: vandaag, soort: "web-verrijking" }));
      if (webHash) p.webHash = webHash;
      (geenBron ?? []).forEach((sleutel) => markeerGeenBron(p, sleutel, doorzocht ?? []));
      p.laatstVerrijktOp = new Date().toISOString();
      // Alternatieven opnieuw bepalen over alle open voorstellen van deze partner (ook uit eerdere rondes).
      verwerkVoorstellen(p, db.verrijkingsvoorstellen.filter((v) => v.partnerId === p.id && v.status === "open"), db.factoren);
    });
    if (rondeId) {
      const ronde = db.verrijkingsrondes.find((r) => r.id === rondeId);
      if (ronde) {
        ronde.partnerIdsVerwerkt.push(...geraadpleegd.map((x) => x.partnerId));
        ronde.ongewijzigd += geraadpleegd.filter((x) => x.overgeslagen).length;
        ronde.nieuw += geteld.nieuw;
        ronde.gewijzigd += geteld.gewijzigd;
        ronde.nietBevestigd += geteld.nietBevestigd;
        ronde.bijgewerktOp = new Date().toISOString();
        if (rondeKlaar) ronde.klaarOp = ronde.bijgewerktOp;
      }
    }
    db.instellingen.laatsteVerrijking = new Date().toISOString();
  });
  return toegevoegd;
}

export type VerrijkingUitkomst = { partners: number; voorstellen: number; nieuw: number; websitesGevonden: number; overgeslagen: number; nogTeGaan: number; rondeId?: string };

/**
 * Verrijking: één partner (optioneel met geplakte tekst) of een hervatbare ronde over het hele bestand. Een ronde verwerkt
 * per aanroep maximaal `maxPerRonde` partners (nog niet in deze ronde verwerkt) en houdt een verschillenoverzicht bij:
 * nieuw / gewijzigd / niet langer bevestigd / ongewijzigd overgeslagen (delta-selectie).
 */
export type RondeOpties = {
  /** US-56: partners volgens de omvang van het schema (of een handmatige keuze); ontbreekt = het hele bestand. */
  selectie?: string[];
  omvang?: VerrijkingsSchema["omvang"];
  alleenGewijzigd?: boolean;
  gepland?: boolean;
  verwachteBewerkingen?: number;
};

export async function startVerrijking(partnerId?: string, tekst?: string, maxPerRonde = 20, gestartDoor?: SysteemSleutel, opties: RondeOpties = {}) {
  return veilig(async (): Promise<VerrijkingUitkomst> => {
    // Alleen de server (cron) kan als 'systeem' handelen: de sleutel is een Symbol dat niet via een aanroep vanuit de browser
    // kan worden meegestuurd. Iedere andere aanroep vraagt een ingelogde gebruiker met recht bewerken.
    const systeem = gestartDoor === SYSTEEM_SLEUTEL;
    const g = systeem ? { id: "systeem", naam: "systeem", rol: "beheerder" as const } : await vereisRecht("bewerken");
    if (!systeem) {
      maxPerRonde = Math.min(20, Math.max(1, Math.round(Number(maxPerRonde) || 20)));
      opties = { ...opties, gepland: false };
    }
    const db = await getDb();
    // US-58: boven het maandbudget krijgen interactieve functies voorrang; een ronde over (een deel van) het bestand start dan niet.
    if (!partnerId && budgetStatus(db).overschreden) throw new Error("Het AI-maandbudget (bewerkingen of tokenbudget) is bereikt. Verrijkingsrondes zijn gepauzeerd; verrijking van één partner en zoeken/chat blijven mogelijk. Pas het budget aan onder Beheer → AI-verbruik.");
    // Hervatbare ronde-administratie (alleen bij een ronde over het bestand).
    let ronde = partnerId ? undefined : db.verrijkingsrondes.find((r) => !r.klaarOp);
    if (!partnerId && !ronde) {
      const doel = opties.selectie ?? db.partners.filter((p) => p.status !== "geblokkeerd" && zichtbaar(p)).map((p) => p.id);
      ronde = { id: nieuwId("ronde"), gestartOp: new Date().toISOString(), bijgewerktOp: new Date().toISOString(), door: systeem ? "systeem" : g.naam, totaal: doel.length, partnerIdsVerwerkt: [], ongewijzigd: 0, nieuw: 0, gewijzigd: 0, nietBevestigd: 0, doelIds: opties.selectie, omvang: opties.omvang, gepland: opties.gepland, alleenGewijzigd: opties.alleenGewijzigd, verwachteBewerkingen: opties.verwachteBewerkingen };
      await muteer(g, { entiteit: "verrijking", entiteitId: ronde.id, actie: opties.gepland ? "geplande verrijkingsronde gestart" : "verrijkingsronde gestart", details: `${ronde.totaal} partners${opties.omvang ? ` (${opties.omvang})` : ""}${opties.verwachteBewerkingen !== undefined ? `; verwacht ${opties.verwachteBewerkingen} AI-bewerkingen` : ""}` }, (d) => d.verrijkingsrondes.unshift(ronde!));
    }
    const doelSet = ronde?.doelIds ? new Set(ronde.doelIds) : null;
    const kandidaten = partnerId
      ? db.partners.filter((p) => p.id === partnerId)
      : db.partners.filter((p) => p.status !== "geblokkeerd" && zichtbaar(p) && (!doelSet || doelSet.has(p.id)) && !ronde!.partnerIdsVerwerkt.includes(p.id));
    const doelen = partnerId ? kandidaten : kandidaten.slice(0, maxPerRonde);
    if (partnerId && !doelen.length) throw new Error("Partner niet gevonden.");
    const extraBronnen = await haalExtraBronnen(db);
    const nieuweVoorstellen: EnrichmentVoorstel[] = [];
    const geraadpleegd: Geraadpleegd[] = [];
    let websitesGevonden = 0;
    // Beperkte parallelliteit: vriendelijk voor de bronnen, snel genoeg voor een ronde.
    const wachtrij = [...doelen];
    const door = systeem ? "systeem" : g.naam;
    // US-58: één verrijking van één partner is één AI-bewerking, ook binnen een ronde (niet de hele ronde als één).
    await Promise.all(
        Array.from({ length: Math.min(4, wachtrij.length) }, async () => {
          for (let p = wachtrij.shift(); p; p = wachtrij.shift()) {
            const partner = p;
            try {
              const r = await alsAIBewerking("verrijking", door, `verrijking ${partner.naam}${ronde ? " (ronde)" : ""}`, () => {
                zetAanroepDoel(`factorextractie ${partner.naam}`);
                return verzamelVoorstellen(partner, db, tekst, extraBronnen, ronde?.alleenGewijzigd ?? false);
              }, "extractie");
              nieuweVoorstellen.push(...r.voorstellen);
              if (r.websiteGevonden) websitesGevonden++;
              geraadpleegd.push({ partnerId: p.id, paginas: r.paginas, webHash: r.webHash, overgeslagen: r.overgeslagen, geenBron: r.geenBron, doorzocht: r.doorzocht, documentTeksten: r.documentTeksten, registers: r.registers });
            } catch (e) {
              console.warn("Verrijking overgeslagen voor", partner.naam, e instanceof Error ? e.message : e);
            }
          }
        })
      );
    const nogTeGaan = partnerId ? 0 : Math.max(0, kandidaten.length - doelen.length);
    const nieuw = await bewaarVoorstellen(g, partnerId ?? ronde?.id ?? "alle", nieuweVoorstellen, geraadpleegd, ronde?.id, !partnerId && nogTeGaan === 0);
    revalidatePath("/verrijking");
    if (partnerId) revalidatePath(`/partners/${partnerId}`);
    return { partners: doelen.length, voorstellen: nieuweVoorstellen.length, nieuw, websitesGevonden, overgeslagen: geraadpleegd.filter((x) => x.overgeslagen).length, nogTeGaan, rondeId: ronde?.id };
  });
}

/** US-56/57: handmatige ronde met een omvang uit het schema (hervat een lopende ronde als die er is). */
export async function startRonde(omvang: VerrijkingsSchema["omvang"] = "alles") {
  const db = await getDb();
  if (db.verrijkingsrondes.some((r) => !r.klaarOp)) return startVerrijking();
  const schema = schemaVan(db);
  const selectie = selecteerPartners(db, { ...schema, omvang });
  const schatting = schatVerrijkingsronde(selectie, db, aiBeschikbaar(), { alleenGewijzigd: omvang === "gewijzigde_website" });
  return startVerrijking(undefined, undefined, 20, undefined, { selectie: omvang === "alles" ? undefined : selectie.map((p) => p.id), omvang, alleenGewijzigd: omvang === "gewijzigde_website", verwachteBewerkingen: schatting.bewerkingen });
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
      const p = db.partners.find((x) => x.id === v.partnerId);
      // US-49: de goudstandaard van Blauwhoed gaat altijd voor; een voorstel uit een lagere bron overschrijft haar nooit.
      const h = p ? huidigeHerkomst(p, v, db.factoren) : undefined;
      if (accepteer && h && isGoudstandaard(h.bron) && !isGoudstandaard(v.bron) && v.aard !== "niet_bevestigd")
        throw new Error("De huidige waarde komt uit de goudstandaard of een eigen uitgave van Blauwhoed en gaat altijd voor. Dit voorstel blijft als alternatief zichtbaar; wijzig de goudstandaard zo nodig handmatig.");
      v.status = accepteer ? "geaccepteerd" : "afgewezen";
      if (!accepteer) return;
      if (!p) return;
      partnerId = p.id;
      const nu = new Date().toISOString();
      const vandaag = nu.slice(0, 10);
      if (!v.factorId) {
        // Basisveld (website, KVK, plaats, omschrijving, KVK-gegevens, contactgegevens) of referentie.
        const waarde = String(v.voorgesteld);
        const veld = BASISVELD_VAN_LABEL[v.veld];
        if (v.veld.startsWith("Certificaat: ")) {
          // US-62: certificaat gevonden in een openbaar register; nummer en geldigheid vult een mens aan.
          const type = v.veld.slice(13) as Certificaat["type"];
          const controle = { register: v.bronUrl ?? "register", url: v.bronUrl ?? "", op: v.gevondenOp.slice(0, 10), gevonden: true };
          p.certificaten.filter((c) => c.type === type).forEach((c) => Object.assign(c, { verificatie: "geverifieerd", geverifieerdOp: v.gevondenOp.slice(0, 10), bronUrl: v.bronUrl, registerControle: controle }));
          if (!p.certificaten.some((c) => c.type === type)) p.certificaten.push({ id: nieuwId("cert"), type, nummer: "aanvullen (uit register)", geldigTot: "", verificatie: "geverifieerd", geverifieerdOp: v.gevondenOp.slice(0, 10), bronUrl: v.bronUrl, registerControle: { register: v.bronUrl ?? "register", url: v.bronUrl ?? "", op: v.gevondenOp.slice(0, 10), gevonden: true } });
          p.bijgewerktOp = nu;
          return;
        }
        if (v.veld === BASISVELDEN.referentie) {
          if (!p.referenties.includes(waarde)) p.referenties.push(waarde);
        } else if (!veld) throw new Error(`Onbekend veld '${v.veld}'.`);
        else if (veld === "vestigingsplaats") {
          p.vestigingsplaats = waarde;
          if (geo) {
            p.locatie = geo;
            p.tags = p.tags.filter((t) => t !== "locatie onbekend");
          }
        } else if (veld === "sbiActiviteiten") p.sbiActiviteiten = leesSbi(waarde);
        else p[veld] = waarde;
        if (veld) zetBasisveldHerkomst(p, veld, { bron: v.bron, bronDetail: v.bronUrl, vastgesteldOp: v.gevondenOp.slice(0, 10), betrouwbaarheid: v.betrouwbaarheid, status: "gevalideerd", gevalideerdDoor: g.naam, gevalideerdOp: vandaag });
        p.bronnen.push({ url: v.bronUrl ?? "", opgehaaldOp: v.gevondenOp.slice(0, 10), soort: "verrijking" });
        p.bijgewerktOp = nu;
        return;
      }
      const optie = optieVanVoorstel(v, db.factoren);
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
      wisGeenBron(p, geenBronSleutel({ factorId: v.factorId }));
      const record: PartnerFactor = { factorId: v.factorId, optieId: optie, waarde: v.voorgesteld as FactorWaarde, bron: v.bron, betrouwbaarheid: v.betrouwbaarheid, bewijs: { soort: v.bron === "document" ? "document" : "url", ref: v.bronUrl ?? "", label: v.bronUrl ?? v.bron }, peildatum: v.gevondenOp.slice(0, 10), status: "gevalideerd", gevalideerdDoor: g.naam, gevalideerdOp: nu.slice(0, 10), toelichting: `${v.soort}: ${v.citaat}` };
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

/** B3: extra verrijkingsbronnen beheren (toevoegen/aan-uit/verwijderen) zonder codewijziging. */
export async function slaVerrijkingsBronOp(bron: { id?: string; naam: string; url: string; actief: boolean; categorie?: "eigen_uitgave" | "web" } | { verwijderId: string }) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "instellingen", entiteitId: "verrijkingsbronnen", actie: "verwijderId" in bron ? "bron verwijderd" : "bron opgeslagen", details: "verwijderId" in bron ? bron.verwijderId : `${bron.naam} (${bron.url})` }, (db) => {
      db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
      if ("verwijderId" in bron) {
        db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen.filter((b) => b.id !== bron.verwijderId);
        return;
      }
      if (!/^https?:\/\//.test(bron.url)) throw new Error("Bron-URL moet met http(s) beginnen.");
      const idx = db.instellingen.verrijkingsbronnen.findIndex((b) => b.id === bron.id);
      if (idx >= 0) db.instellingen.verrijkingsbronnen[idx] = { ...db.instellingen.verrijkingsbronnen[idx], naam: bron.naam, url: bron.url, actief: bron.actief, categorie: bron.categorie ?? db.instellingen.verrijkingsbronnen[idx].categorie };
      else db.instellingen.verrijkingsbronnen.push({ id: nieuwId("vb"), naam: bron.naam, url: bron.url, actief: bron.actief, categorie: bron.categorie ?? "web" });
    });
    revalidatePath("/verrijking");
  });
}

// ---------- Documenten per partner (onderdeel 1) ----------
export async function slaPartnerDocumentOp(partnerId: string, doc: { id?: string; naam: string; soort: PartnerDocument["soort"]; url?: string; tekst?: string; toelichting?: string; bestandUrl?: string; bestandType?: string; bestandGrootte?: number }) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!doc.naam.trim()) throw new Error("Geef het document een naam.");
    if (doc.url && !/^https?:\/\//.test(doc.url)) throw new Error("Document-URL moet met http(s) beginnen.");
    const docId = await muteer(g, { entiteit: "partner_document", entiteitId: partnerId, actie: doc.id ? "document bijgewerkt" : "document toegevoegd", details: doc.naam }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      p.documenten = p.documenten ?? [];
      const idx = p.documenten.findIndex((d) => d.id === doc.id);
      const vorige = idx >= 0 ? p.documenten[idx] : undefined;
      const record: PartnerDocument = { id: doc.id ?? nieuwId("doc"), naam: doc.naam.trim(), soort: doc.soort, url: doc.url || undefined, tekst: doc.tekst?.slice(0, 40000) || undefined, bestandUrl: doc.bestandUrl || undefined, bestandType: doc.bestandType || undefined, bestandGrootte: doc.bestandGrootte || undefined, toelichting: doc.toelichting || undefined, toegevoegdDoor: g.naam, op: new Date().toISOString().slice(0, 10) };
      // Een al gelezen bestand hoeft niet opnieuw gelezen te worden als het bestand gelijk bleef.
      if (vorige?.bestandUrl && vorige.bestandUrl === record.bestandUrl) Object.assign(record, { geextraheerdeTekst: vorige.geextraheerdeTekst, tekstGeextraheerdOp: vorige.tekstGeextraheerdOp, extractieMelding: vorige.extractieMelding });
      if (idx >= 0) p.documenten[idx] = record;
      else p.documenten.push(record);
      p.bijgewerktOp = new Date().toISOString();
      return record.bestandUrl && !record.geextraheerdeTekst ? record.id : null;
    });
    revalidatePath(`/partners/${partnerId}`);
    // US-61: een geüpload bestand direct lezen (na de response), zodat de tekst bij de volgende verrijking als bron meetelt.
    if (docId) after(() => leesDocumentIntern(g, partnerId, docId).catch(() => undefined));
  });
}

/** US-61: tekst uit een geüpload document (PDF, Word, tekst) lezen en bij het document bewaren. */
export async function leesDocumentTekst(partnerId: string, docId: string) {
  return veilig(async () => leesDocumentIntern(await vereisRecht("bewerken"), partnerId, docId));
}

async function leesDocumentIntern(g: Gebruiker, partnerId: string, docId: string) {
    const db = await getDb();
    const doc = db.partners.find((x) => x.id === partnerId)?.documenten?.find((d) => d.id === docId);
    if (!doc?.bestandUrl) throw new Error("Dit document heeft geen geüpload bestand.");
    const r = await haalDocumentTekst(doc.bestandUrl, doc.bestandType, doc.naam);
    await muteer(g, { entiteit: "partner_document", entiteitId: partnerId, actie: r.tekst ? "documenttekst gelezen" : "documenttekst niet leesbaar", details: `${doc.naam}${r.tekst ? ` (${r.tekst.length} tekens)` : `: ${r.melding}`}` }, (db) => {
      const d = db.partners.find((x) => x.id === partnerId)?.documenten?.find((x) => x.id === docId);
      if (!d) return;
      d.geextraheerdeTekst = r.tekst;
      d.extractieMelding = r.melding;
      d.tekstGeextraheerdOp = new Date().toISOString().slice(0, 10);
    });
    revalidatePath(`/partners/${partnerId}`);
    return r.tekst ? r.tekst.length : 0;
}

export async function verwijderPartnerDocument(partnerId: string, docId: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    const bestand = db.partners.find((x) => x.id === partnerId)?.documenten?.find((d) => d.id === docId)?.bestandUrl;
    await muteer(g, { entiteit: "partner_document", entiteitId: partnerId, actie: "document verwijderd", details: docId }, (db) => {
      const p = db.partners.find((x) => x.id === partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      p.documenten = (p.documenten ?? []).filter((d) => d.id !== docId);
      p.bijgewerktOp = new Date().toISOString();
    });
    // Bijbehorend Blob-bestand opruimen (na de mutatie; falen mag de verwijdering niet blokkeren).
    if (bestand && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(bestand);
      } catch (e) {
        console.warn("Blob verwijderen mislukt:", e instanceof Error ? e.message : e);
      }
    }
    revalidatePath(`/partners/${partnerId}`);
  });
}

// ---------- Definitief verwijderen (US-69, AVG) ----------
/**
 * Alleen de beheerder, alleen een gearchiveerde partner, met dubbele bevestiging (naam typen) en een verplichte reden.
 * De auditlog bewaart alleen dát er verwijderd is (wie, wanneer, reden, intern id), zonder persoonsgegevens.
 */
export async function verwijderPartnerDefinitiefActie(partnerId: string, reden: string, bevestiging: string) {
  return veilig(async () => {
    const g = await vereisRecht("definitief_verwijderen");
    const db = await getDb();
    const fout = controleerVerwijderen(db.partners.find((x) => x.id === partnerId), reden, bevestiging);
    if (fout) throw new Error(fout);
    const u = await muteer(g, { entiteit: "partner", entiteitId: pseudoniem(partnerId), actie: "definitief verwijderd (AVG)", details: `reden: ${reden.trim().slice(0, 300)}` }, (db) => verwijderPartnerDefinitief(db, partnerId));
    // Bestanden in Vercel Blob opruimen (na de mutatie; falen blokkeert de verwijdering niet).
    if (u.blobs.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(u.blobs);
      } catch (e) {
        console.warn("Blob verwijderen mislukt:", e instanceof Error ? e.message : e);
      }
    }
    await slaNuOp();
    ["/partners", "/", "/historie", "/verbanden", "/vrijgave"].forEach((p) => revalidatePath(p));
    return u;
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

export async function zetInstelling(sleutel: "aiProvider" | "externeBronnenToegestaan" | "afgeschermdeOmgeving", waarde: string | boolean | number) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    await muteer(g, { entiteit: "instellingen", entiteitId: sleutel, actie: `gewijzigd naar ${waarde}` }, (db) => {
      if (sleutel === "aiProvider") db.instellingen.aiProvider = waarde === "anthropic" ? "anthropic" : "uit";
      else db.instellingen[sleutel] = Boolean(waarde);
    });
    revalidatePath("/beheer");
  });
}
