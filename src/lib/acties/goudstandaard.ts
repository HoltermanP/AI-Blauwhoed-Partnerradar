"use server";
// US-49: goudstandaard per partnertype beheren. Alleen de beheerder; elke wijziging in de auditlog.
import { revalidatePath } from "next/cache";
import { vereisRecht } from "../auth";
import { goudstandaardVoor } from "../domain/goudstandaard";
import { ROLLEN, type Beoordelingscriterium, type GoudstandaardVeld, type Rol } from "../domain/types";
import { BASISVELD_LABEL } from "../domain/types";
import { getDb, muteer } from "../store";

export type GoudstandaardInvoer = { velden: GoudstandaardVeld[]; criteria: Beoordelingscriterium[] };

export async function slaGoudstandaardOp(rol: Rol, invoer: GoudstandaardInvoer) {
  try {
    const g = await vereisRecht("beheer");
    if (!ROLLEN.includes(rol)) throw new Error("Onbekend partnertype.");
    const db = await getDb();
    const geldig = (sleutel: string) => (sleutel.startsWith("basis:") ? sleutel.slice(6) in BASISVELD_LABEL : sleutel.startsWith("factor:") && db.factoren.some((f) => f.id === sleutel.slice(7) && f.actief));
    const velden = invoer.velden.filter((v, i, a) => geldig(v.sleutel) && a.findIndex((x) => x.sleutel === v.sleutel) === i);
    const criteria = invoer.criteria.filter((c) => c.naam.trim()).map((c, i) => ({ ...c, id: c.id || `crit-${i + 1}`, naam: c.naam.trim(), omschrijving: c.omschrijving.trim() }));
    if (!velden.length) throw new Error("Een goudstandaard heeft minstens één veld.");
    await muteer(g, { entiteit: "goudstandaard", entiteitId: rol, actie: "goudstandaard opgeslagen", details: `${velden.filter((v) => v.niveau === "verplicht").length} verplicht, ${velden.filter((v) => v.niveau === "gewenst").length} gewenst, ${criteria.length} criteria` }, (db) => {
      const vorige = goudstandaardVoor(db, rol);
      db.goudstandaard = db.goudstandaard ?? {};
      db.goudstandaard[rol] = { rol, velden, criteria, versie: vorige.versie + 1, bijgewerktOp: new Date().toISOString(), door: g.naam };
    });
    revalidatePath("/beheer/goudstandaard");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, fout: e instanceof Error ? e.message : String(e) };
  }
}
