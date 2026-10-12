"use server";
// US-25: extern project vastleggen uit een openbare bron, met de betrokken partijen als samenwerkingssignaal.
import { revalidatePath } from "next/cache";
import { vereisRecht } from "../auth";
import { striptHtml } from "../domain/enrichment";
import { genoemdePartners, isLinkedIn, paginaTitel } from "../domain/externprojecten";
import { geocodeer } from "../domain/geocode";
import { zichtbaar } from "../domain/zichtbaarheid";
import { ROLLEN, type Project, type Projecttype, type Rol } from "../domain/types";
import { getDb, muteer, nieuwId } from "../store";

type Resultaat<T = undefined> = { ok: true; data?: T } | { ok: false; fout: string };
async function veilig<T>(fn: () => Promise<T>): Promise<Resultaat<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

export type ExternVoorstel = { titel: string; genoemd: Array<{ id: string; naam: string; rollen: Rol[] }>; melding?: string };

/** Lees een openbare projectpagina en stel voor welke partners erin worden genoemd. LinkedIn wordt niet gelezen. */
export async function leesExternProject(url: string) {
  return veilig(async (): Promise<ExternVoorstel> => {
    await vereisRecht("bewerken");
    if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) throw new Error("Geef een geldige URL (https://…).");
    if (isLinkedIn(url)) return { titel: "", genoemd: [], melding: "LinkedIn-pagina's worden niet automatisch gelezen (voorwaarden van LinkedIn en de AVG). De URL wordt als bron vermeld; kies de betrokken partijen zelf." };
    const db = await getDb();
    if (!db.instellingen.externeBronnenToegestaan) return { titel: "", genoemd: [], melding: "Externe bronnen staan uit (Beheer); kies de betrokken partijen zelf." };
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (extern project; alleen openbare informatie)", accept: "text/html" } }).catch(() => null);
    if (!res?.ok) return { titel: "", genoemd: [], melding: "De pagina kon niet worden gelezen; kies de betrokken partijen zelf." };
    const html = await res.text();
    const genoemd = genoemdePartners(striptHtml(html).slice(0, 80000), db.partners.filter(zichtbaar));
    return { titel: paginaTitel(html), genoemd, melding: genoemd.length ? undefined : "Op de pagina zijn geen partners uit het bestand herkend; kies ze zelf." };
  });
}

export type ExternProjectInvoer = { naam: string; plaats: string; jaar: number; bronUrl: string; type?: Projecttype; woningen?: number; betrokkenen: Array<{ partnerId: string; rol: Rol }> };

export async function slaExternProjectOp(invoer: ExternProjectInvoer) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!invoer.naam.trim()) throw new Error("Geef de projectnaam.");
    if (!/^https?:\/\//.test(invoer.bronUrl.trim())) throw new Error("Een extern project heeft altijd een bron (URL).");
    if (invoer.betrokkenen.length < 2) throw new Error("Kies minstens twee betrokken partijen; een samenwerking heeft twee kanten.");
    if (!(invoer.jaar >= 1990 && invoer.jaar <= new Date().getFullYear() + 5)) throw new Error("Geef een geldig jaar.");
    const geo = await geocodeer(invoer.plaats);
    if (!geo) throw new Error(`Plaats '${invoer.plaats}' niet gevonden.`);
    const id = nieuwId("proj");
    const nu = new Date().toISOString();
    await muteer(g, { entiteit: "project", entiteitId: id, actie: "extern project vastgelegd", details: `${invoer.naam}; bron ${invoer.bronUrl}; ${invoer.betrokkenen.length} partijen` }, (db) => {
      invoer.betrokkenen.forEach((b) => {
        if (!db.partners.some((p) => p.id === b.partnerId)) throw new Error("Onbekende partner gekozen.");
        if (!ROLLEN.includes(b.rol)) throw new Error("Onbekende rol.");
      });
      const project: Project = {
        id,
        bron: "web",
        extern: true,
        naam: invoer.naam.trim(),
        type: invoer.type ?? "grondgebonden",
        locatie: { ...geo.locatie, plaats: invoer.plaats },
        woningen: Math.max(0, Math.round(invoer.woningen ?? 0)),
        prijssegment: [],
        bouwstijl: "modern",
        ambitieDuurzaamheid: 3,
        planning: { start: `${invoer.jaar}-01-01`, eind: `${invoer.jaar}-12-31` },
        fase: "opgeleverd",
        omschrijving: `Extern project (buiten de eigen portefeuille), vastgelegd uit ${invoer.bronUrl}.`,
        herkomst: [{ veld: "bron", citaat: invoer.bronUrl, betrouwbaarheid: 0.5 }],
        eisen: [],
        aangemaaktOp: nu,
        bijgewerktOp: nu
      };
      db.projecten.push(project);
      invoer.betrokkenen.forEach((b) => db.engagements.push({ id: nieuwId("eng"), partnerId: b.partnerId, projectId: id, rol: b.rol, periode: { van: project.planning.start, tot: project.planning.eind }, contractwaarde: 0, bron: "extern", bronUrl: invoer.bronUrl }));
    });
    revalidatePath("/verbanden");
    revalidatePath("/projecten");
    return id;
  });
}
