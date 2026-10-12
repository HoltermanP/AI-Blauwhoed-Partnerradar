"use server";
// US-04/US-06/US-08: één waarde afwijzen, waarden definitief valideren als beheerder en classificaties van projecten corrigeren.
// Alleen een mens wijst af, corrigeert of valideert; alles komt in de auditlog.
import { revalidatePath } from "next/cache";
import { vereisRecht } from "../auth";
import { basisveldWaarde, geenBronSleutel, wisGeenBron } from "../domain/herkomst";
import { verifieer } from "../domain/verificatie";
import type { BasisVeld, Projecttype } from "../domain/types";
import { muteer } from "../store";

type Resultaat<T = undefined> = { ok: true; data?: T } | { ok: false; fout: string };

async function veilig<T>(fn: () => Promise<T>): Promise<Resultaat<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

export type WaardeRef = { partnerId: string; factorId?: string; optieId?: string; basisveld?: BasisVeld };

const refTekst = (r: WaardeRef) => (r.basisveld ? `basis:${r.basisveld}` : `${r.factorId}${r.optieId ? `/${r.optieId}` : ""}`);

/**
 * US-04: een waarde afwijzen. Een factorwaarde blijft zichtbaar met status 'afgewezen' (wie, wanneer, waarom) maar telt
 * nergens meer mee; een basisveld wordt leeggemaakt en de afgewezen waarde bewaard in de herkomst. De verrijking vult
 * dezelfde waarde niet opnieuw in.
 */
export async function wijsWaardeAf(ref: WaardeRef, reden: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!reden.trim()) throw new Error("Geef een reden voor de afwijzing.");
    await muteer(g, { entiteit: "partner_factor", entiteitId: ref.partnerId, actie: "waarde afgewezen", details: `${refTekst(ref)}: ${reden}` }, (db) => {
      const p = db.partners.find((x) => x.id === ref.partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      const vandaag = new Date().toISOString().slice(0, 10);
      const afwijzing = { door: g.naam, rol: g.rol, op: vandaag, reden: reden.trim() };
      if (ref.basisveld) {
        const veld = ref.basisveld;
        const w = basisveldWaarde(p, veld);
        if (!w) throw new Error("Dit veld is leeg.");
        if (veld === "omschrijving") p.omschrijving = "";
        else if (veld === "sbiActiviteiten") p.sbiActiviteiten = [];
        else if (veld === "rechtsvorm") p.rechtsvorm = "Onbekend";
        else if (veld === "vestigingsplaats") throw new Error("De vestigingsplaats bepaalt de locatie in de matching; wijzig hem via Bewerken in plaats van hem af te wijzen.");
        else (p as unknown as Record<string, string | undefined>)[veld] = veld === "kvk" ? "" : undefined;
        const h = p.veldHerkomst?.[veld];
        p.veldHerkomst = p.veldHerkomst ?? {};
        p.veldHerkomst[veld] = { ...(h ?? { bron: "opgave", vastgesteldOp: vandaag, betrouwbaarheid: 0 }), status: "afgewezen", afwijzing: { ...afwijzing, waarde: w } };
      } else {
        const pf = p.factoren.find((x) => x.factorId === ref.factorId && (x.optieId ?? "") === (ref.optieId ?? ""));
        if (!pf) throw new Error("Deze waarde is niet vastgelegd (een berekende waarde uit de projecthistorie kan niet worden afgewezen).");
        if (pf.status === "afgewezen") throw new Error("Deze waarde is al afgewezen.");
        pf.status = "afgewezen";
        pf.afwijzing = afwijzing;
      }
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/partners/${ref.partnerId}`);
    revalidatePath("/datakwaliteit");
  });
}

/** Een afgewezen factorwaarde weer verwijderen uit het dossier (bijv. na een herstelde fout). */
export async function herstelAfgewezen(ref: WaardeRef) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    await muteer(g, { entiteit: "partner_factor", entiteitId: ref.partnerId, actie: "afgewezen waarde opgeruimd", details: refTekst(ref) }, (db) => {
      const p = db.partners.find((x) => x.id === ref.partnerId);
      if (!p) throw new Error("Partner niet gevonden.");
      if (ref.basisveld) {
        if (p.veldHerkomst?.[ref.basisveld]?.status === "afgewezen") delete p.veldHerkomst[ref.basisveld];
      } else p.factoren = p.factoren.filter((x) => !(x.factorId === ref.factorId && (x.optieId ?? "") === (ref.optieId ?? "") && x.status === "afgewezen"));
      wisGeenBron(p, ref.basisveld ? geenBronSleutel({ basisveld: ref.basisveld }) : geenBronSleutel({ factorId: ref.factorId }));
    });
    revalidatePath(`/partners/${ref.partnerId}`);
  });
}

/**
 * US-08: een beheerder valideert waarden definitief (tweede controle, label 'beheerdersgeverifieerd'). Werkt per stuk en in
 * bulk vanuit de werklijst. Afgewezen waarden en berekende waarden worden overgeslagen.
 */
export async function valideerAlsBeheerder(refs: WaardeRef[]) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    if (!refs.length) throw new Error("Selecteer eerst een of meer waarden.");
    return muteer(g, { entiteit: "partner_factor", entiteitId: refs.length === 1 ? refs[0].partnerId : "werklijst", actie: "beheerdersvalidatie", details: `${refs.length} waarde(n): ${refs.slice(0, 5).map(refTekst).join(", ")}` }, (db) => {
      let n = 0;
      refs.forEach((ref) => {
        const p = db.partners.find((x) => x.id === ref.partnerId);
        if (!p) return;
        if (ref.basisveld) {
          const h = p.veldHerkomst?.[ref.basisveld];
          if (!h || h.status === "afgewezen" || !basisveldWaarde(p, ref.basisveld)) return;
          verifieer(h, g);
          n++;
          return;
        }
        const pf = p.factoren.find((x) => x.factorId === ref.factorId && (x.optieId ?? "") === (ref.optieId ?? ""));
        if (!pf || pf.status === "afgewezen" || pf.afgeleid) return;
        pf.peildatum = verifieer(pf, g);
        n++;
      });
      return n;
    });
  }).then((r) => {
    revalidatePath("/vrijgave");
    refs.forEach((x) => revalidatePath(`/partners/${x.partnerId}`));
    return r;
  });
}

/** US-06: de classificatie van een project corrigeren (bijv. projecttype), met reden; de correctie geldt boven het AI-label. */
export async function corrigeerProjecttype(projectId: string, naar: Projecttype, reden: string) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!reden.trim()) throw new Error("Geef een reden voor de correctie.");
    await muteer(g, { entiteit: "project", entiteitId: projectId, actie: "classificatie gecorrigeerd", details: `type → ${naar}: ${reden}` }, (db) => {
      const p = db.projecten.find((x) => x.id === projectId);
      if (!p) throw new Error("Project niet gevonden.");
      if (p.type === naar) throw new Error("Het project heeft dit type al.");
      p.correcties = [...(p.correcties ?? []), { veld: "type", van: p.type, naar, reden: reden.trim(), door: g.naam, op: new Date().toISOString() }];
      p.type = naar;
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/projecten/${projectId}`);
  });
}
