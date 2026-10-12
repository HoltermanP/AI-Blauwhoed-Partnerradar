"use server";
// US-03: verouderingstermijn per veld en drempels; gerichte verrijking van partners met ontbrekende waarden (US-02/US-15).
import { revalidatePath } from "next/cache";
import { startVerrijking } from "../actions";
import { vereisRecht } from "../auth";
import { BASISVELD_LABEL, type BasisVeld } from "../domain/types";
import { getDb, muteer } from "../store";

type Resultaat<T = undefined> = { ok: true; data?: T } | { ok: false; fout: string };

async function veilig<T>(fn: () => Promise<T>): Promise<Resultaat<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

const maanden = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) || n <= 0 ? undefined : Math.min(240, Math.round(n)));

export type TermijnInvoer = { factoren: Record<string, number | null>; basis: Partial<Record<BasisVeld, number | null>>; betrouwbaarheidDrempel: number; dekkingDrempel: number };

export async function slaTermijnenOp(invoer: TermijnInvoer) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    if (!(invoer.betrouwbaarheidDrempel >= 0 && invoer.betrouwbaarheidDrempel <= 1)) throw new Error("De betrouwbaarheidsdrempel ligt tussen 0 en 100%.");
    if (!(invoer.dekkingDrempel >= 0 && invoer.dekkingDrempel <= 100)) throw new Error("De dekkingsdrempel ligt tussen 0 en 100%.");
    await muteer(g, { entiteit: "instellingen", entiteitId: "datakwaliteit", actie: "verouderingstermijnen en drempels opgeslagen", details: `drempel betrouwbaarheid ${Math.round(invoer.betrouwbaarheidDrempel * 100)}%, dekking ${invoer.dekkingDrempel}%` }, (db) => {
      Object.entries(invoer.factoren).forEach(([id, n]) => {
        const f = db.factoren.find((x) => x.id === id);
        if (!f) return;
        const nieuw = maanden(n);
        if (nieuw !== f.vervalMaanden) {
          f.vervalMaanden = nieuw;
          f.versie += 1;
        }
      });
      const basis: Partial<Record<BasisVeld, number>> = {};
      (Object.keys(BASISVELD_LABEL) as BasisVeld[]).forEach((v) => {
        const n = maanden(invoer.basis[v]);
        if (n) basis[v] = n;
      });
      db.instellingen.basisveldVerval = basis;
      db.instellingen.betrouwbaarheidDrempel = invoer.betrouwbaarheidDrempel;
      db.instellingen.dekkingDrempel = Math.round(invoer.dekkingDrempel);
    });
    revalidatePath("/datakwaliteit");
  });
}

/** Verrijk precies deze partners als (hervatbare) ronde; zelfde budgetregels als een gewone ronde. */
export async function startGerichteRonde(ids: string[]) {
  const db = await getDb();
  if (db.verrijkingsrondes.some((r) => !r.klaarOp)) return { ok: false as const, fout: "Er loopt al een verrijkingsronde. Hervat of rond die eerst af op de pagina Verrijking." };
  const geldig = ids.filter((id) => db.partners.some((p) => p.id === id));
  if (!geldig.length) return { ok: false as const, fout: "Geen partners geselecteerd." };
  const r = await startVerrijking(undefined, undefined, 20, undefined, { selectie: geldig, omvang: "alles" });
  revalidatePath("/datakwaliteit");
  return r;
}
