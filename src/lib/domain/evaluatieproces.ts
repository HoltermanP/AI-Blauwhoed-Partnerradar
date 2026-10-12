// US-20: evaluatieproces bewaken. Per afgerond project (fase opgeleverd of nazorg) welke betrokken organisaties nog geen
// evaluatie na oplevering hebben, met de verantwoordelijke ontwikkelaar en hoe lang de oplevering geleden is. Na de
// herinneringstermijn volgt een signaal. Eigenaarschap (voorstel: ontwikkelaar levert, procesbewaker bewaakt) is nog open.
import type { Database, Engagement, Project } from "./types";

export const HERINNERING_DAGEN = 14;

export type OpenEvaluaties = {
  project: Project;
  verantwoordelijke?: string;
  opgeleverdOp: string;
  dagenSindsOplevering: number;
  herinnering: boolean;
  open: Array<{ engagement: Engagement; partnerNaam: string }>;
  ingediend: number;
  totaal: number;
};

export function opleverdatum(p: Project, engagements: Engagement[]) {
  const werkelijk = engagements.map((e) => e.werkelijkeOplevering).filter((d): d is string => Boolean(d)).sort();
  return werkelijk[werkelijk.length - 1] ?? p.planning.eind;
}

export function herinneringDagen(db: Pick<Database, "instellingen">) {
  return db.instellingen?.evaluatieProces?.herinneringDagen ?? HERINNERING_DAGEN;
}

/** Hoort dit project bij deze gebruiker als verantwoordelijke ontwikkelaar (op naam of e-mailadres)? */
export function isVerantwoordelijke(p: Pick<Project, "verantwoordelijke">, g: { naam: string; email?: string }) {
  const v = (p.verantwoordelijke ?? "").trim().toLowerCase();
  return Boolean(v) && (v === g.naam.trim().toLowerCase() || (Boolean(g.email) && v === g.email!.toLowerCase()));
}

export function openstaandeEvaluaties(db: Pick<Database, "projecten" | "engagements" | "evaluaties" | "partners"> & Partial<Pick<Database, "instellingen">>, nu = new Date()): OpenEvaluaties[] {
  const termijn = db.instellingen ? herinneringDagen(db as Pick<Database, "instellingen">) : HERINNERING_DAGEN;
  return db.projecten
    .filter((p) => !p.extern && (p.fase === "opgeleverd" || p.fase === "nazorg"))
    .map((p) => {
      const eng = db.engagements.filter((e) => e.projectId === p.id);
      const opgeleverdOp = opleverdatum(p, eng);
      const dagen = Math.max(0, Math.floor((nu.getTime() - new Date(opgeleverdOp).getTime()) / 86_400_000));
      const open = eng
        .filter((e) => !db.evaluaties.some((ev) => ev.engagementId === e.id && (ev.moment ?? "oplevering") === "oplevering"))
        .map((e) => ({ engagement: e, partnerNaam: db.partners.find((x) => x.id === e.partnerId)?.naam ?? e.partnerId }));
      const ingediend = db.evaluaties.filter((ev) => ev.projectId === p.id && ev.status === "ingediend").length;
      return { project: p, verantwoordelijke: p.verantwoordelijke, opgeleverdOp, dagenSindsOplevering: dagen, herinnering: open.length > 0 && dagen >= termijn, open, ingediend, totaal: eng.length };
    })
    .filter((x) => x.totaal > 0)
    .sort((a, b) => b.open.length - a.open.length || b.dagenSindsOplevering - a.dagenSindsOplevering);
}
