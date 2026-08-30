// US-45: rollen en rechten. Demo-authenticatie via cookie; koppel later aan SSO (Entra ID).
import { cookies } from "next/headers";
import type { Gebruiker, Gebruikersrol } from "./domain/types";

export const GEBRUIKERS: Gebruiker[] = [
  { id: "u-lezer", naam: "Lezer (projectleider)", rol: "lezer" },
  { id: "u-om", naam: "Ontwikkelingsmanager", rol: "bewerker" },
  { id: "u-inkoper", naam: "Inkoper", rol: "inkoper" },
  { id: "u-beheer", naam: "Beheerder", rol: "beheerder" }
];

export type Recht = "lezen" | "bewerken" | "discovery_goedkeuren" | "prospect_promoveren" | "beheer" | "evalueren" | "kwalificeren";

const RECHTEN: Record<Gebruikersrol, Recht[]> = {
  lezer: ["lezen", "evalueren"],
  bewerker: ["lezen", "bewerken", "evalueren", "discovery_goedkeuren"],
  inkoper: ["lezen", "bewerken", "evalueren", "discovery_goedkeuren", "prospect_promoveren", "kwalificeren"],
  beheerder: ["lezen", "bewerken", "evalueren", "discovery_goedkeuren", "prospect_promoveren", "kwalificeren", "beheer"]
};

export function heeftRecht(rol: Gebruikersrol, recht: Recht) {
  return RECHTEN[rol].includes(recht);
}

export async function huidigeGebruiker(): Promise<Gebruiker> {
  const jar = await cookies();
  const id = jar.get("pr_gebruiker")?.value;
  return GEBRUIKERS.find((g) => g.id === id) ?? GEBRUIKERS[1];
}

export async function vereisRecht(recht: Recht): Promise<Gebruiker> {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, recht)) throw new Error(`Geen recht '${recht}' voor rol ${g.rol}.`);
  return g;
}
