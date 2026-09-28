"use server";
// US-64/65: gebruikersbeheer — rollen toekennen (gebruiker/beheerder), accounts blokkeren of vooraf aanmelden.
// Alleen de beheerder. Het aantal gebruikers is onbeperkt.
import { revalidatePath } from "next/cache";
import { emailToegestaan } from "@/authjs";
import { vereisRecht } from "../auth";
import type { Gebruikersrol } from "../domain/types";
import { eersteBeheerder, vindOfRegistreer } from "../sessie";
import { muteer } from "../store";

type Resultaat = { ok: true } | { ok: false; fout: string };

async function veilig(fn: () => Promise<void>): Promise<Resultaat> {
  try {
    await fn();
    revalidatePath("/beheer/gebruikers");
    return { ok: true };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

export async function zetGebruikersrol(id: string, rol: Gebruikersrol) {
  return veilig(async () => {
    const g = await vereisRecht("gebruikers_beheren");
    if (rol !== "gebruiker" && rol !== "beheerder") throw new Error("Onbekende rol.");
    await muteer(g, { entiteit: "gebruiker", entiteitId: id, actie: `rol gewijzigd naar ${rol}` }, (db) => {
      const doel = db.gebruikers.find((x) => x.id === id);
      if (!doel) throw new Error("Gebruiker niet gevonden.");
      if (rol === "gebruiker" && doel.email && doel.email === eersteBeheerder()) throw new Error("De eerste beheerder (EERSTE_BEHEERDER_EMAIL) blijft altijd beheerder.");
      if (rol === "gebruiker" && doel.rol === "beheerder" && db.gebruikers.filter((x) => x.rol === "beheerder" && x.actief !== false).length <= 1) throw new Error("Er moet minstens één actieve beheerder overblijven.");
      doel.rol = rol;
    });
  });
}

export async function zetGebruikerActief(id: string, actief: boolean) {
  return veilig(async () => {
    const g = await vereisRecht("gebruikers_beheren");
    if (!actief && id === g.id) throw new Error("U kunt uw eigen account niet blokkeren.");
    await muteer(g, { entiteit: "gebruiker", entiteitId: id, actie: actief ? "account geactiveerd" : "account geblokkeerd" }, (db) => {
      const doel = db.gebruikers.find((x) => x.id === id);
      if (!doel) throw new Error("Gebruiker niet gevonden.");
      if (!actief && doel.email === eersteBeheerder()) throw new Error("De eerste beheerder kan niet worden geblokkeerd.");
      doel.actief = actief;
    });
  });
}

/** Een medewerker vooraf aanmelden (bijv. direct als beheerder); bij de eerste inlog wordt het account gekoppeld. */
export async function meldGebruikerAan(email: string, naam: string, rol: Gebruikersrol) {
  return veilig(async () => {
    const g = await vereisRecht("gebruikers_beheren");
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Ongeldig e-mailadres.");
    if (!emailToegestaan(e)) throw new Error("Dit e-maildomein is niet toegestaan (AUTH_TOEGESTANE_DOMEINEN).");
    await muteer(g, { entiteit: "gebruiker", entiteitId: e, actie: `vooraf aangemeld als ${rol}` }, (db) => {
      db.gebruikers = db.gebruikers ?? [];
      const { gebruiker, nieuw } = vindOfRegistreer(db.gebruikers, e, naam);
      if (!nieuw) throw new Error("Deze medewerker heeft al een account.");
      gebruiker.rol = rol === "beheerder" ? "beheerder" : gebruiker.rol;
    });
  });
}
