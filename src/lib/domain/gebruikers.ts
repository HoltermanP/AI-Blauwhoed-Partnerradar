// US-64/65: gebruikers en rollen (pure logica, los van Auth.js en Next).
import type { Gebruiker, Gebruikersrol } from "./types";

export const GEBRUIKERSROL_LABEL: Record<Gebruikersrol, string> = { gebruiker: "Gebruiker", beheerder: "Beheerder" };

export type Recht =
  | "lezen"
  | "bewerken"
  | "discovery_goedkeuren"
  | "prospect_promoveren"
  | "beheer"
  | "evalueren"
  | "kwalificeren"
  | "partners_vrijgeven"
  | "gebruikers_beheren"
  | "definitief_verwijderen"
  | "volledige_export";

const GEBRUIKER_RECHTEN: Recht[] = ["lezen", "bewerken", "evalueren", "discovery_goedkeuren", "prospect_promoveren", "kwalificeren"];

/**
 * Alleen voor de beheerder (US-65): AI-voorstellen vrijgeven, weging, verrijkingsschema, goudstandaard, bronnen, budget en
 * modelinstellingen (recht 'beheer'), definitief verwijderen, volledige export en gebruikersbeheer.
 */
const RECHTEN: Record<Gebruikersrol, Recht[]> = {
  gebruiker: GEBRUIKER_RECHTEN,
  beheerder: [...GEBRUIKER_RECHTEN, "beheer", "partners_vrijgeven", "gebruikers_beheren", "definitief_verwijderen", "volledige_export"]
};

export const ALLE_RECHTEN: Recht[] = RECHTEN.beheerder;

export function heeftRecht(rol: Gebruikersrol, recht: Recht) {
  return (RECHTEN[rol] ?? RECHTEN.gebruiker).includes(recht);
}

/** Oude rolnamen (lezer, bewerker, inkoper) worden gebruiker. */
export function normaliseerRol(rol: string | undefined): Gebruikersrol {
  return rol === "beheerder" ? "beheerder" : "gebruiker";
}


export function eersteBeheerder() {
  return (process.env.EERSTE_BEHEERDER_EMAIL ?? "").trim().toLowerCase();
}

/** Zoek of registreer de gebruiker bij een e-mailadres (pure functie op de gebruikerslijst). */
export function vindOfRegistreer(gebruikers: Gebruiker[], email: string, naam: string | undefined, nu = new Date()): { gebruiker: Gebruiker; nieuw: boolean } {
  const e = email.toLowerCase();
  const bestaand = gebruikers.find((g) => g.email?.toLowerCase() === e);
  const isEerste = e === eersteBeheerder();
  if (bestaand) {
    if (isEerste) bestaand.rol = "beheerder"; // de eerste beheerder kan zichzelf niet buitensluiten
    return { gebruiker: bestaand, nieuw: false };
  }
  const gebruiker: Gebruiker = { id: `u-${e.replace(/[^a-z0-9]+/g, "-")}`, naam: naam?.trim() || e, email: e, rol: isEerste ? "beheerder" : "gebruiker", actief: true, aangemaaktOp: nu.toISOString() };
  gebruikers.push(gebruiker);
  return { gebruiker, nieuw: true };
}
