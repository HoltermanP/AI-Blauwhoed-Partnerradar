// US-45 / US-65: twee rollen conform de overeenkomst — gebruiker en beheerder. De fijnmazige rechten blijven intern bestaan.
// US-64: wie er is ingelogd komt uit Auth.js (Microsoft Entra ID); zie src/lib/sessie.ts. De demo-rolwisselaar werkt alleen
// in ontwikkelmodus (of expliciet met AUTH_DEMO_MODUS=1).
import type { Gebruiker } from "./domain/types";
import { huidigeSessieGebruiker } from "./sessie";

export { DEMO_GEBRUIKERS, OUDE_DEMO_IDS } from "./sessie";

export { ALLE_RECHTEN, GEBRUIKERSROL_LABEL, heeftRecht, normaliseerRol, type Recht } from "./domain/gebruikers";
import { GEBRUIKERSROL_LABEL, heeftRecht, type Recht } from "./domain/gebruikers";

export async function huidigeGebruiker(): Promise<Gebruiker> {
  return huidigeSessieGebruiker();
}

export async function vereisRecht(recht: Recht): Promise<Gebruiker> {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, recht)) throw new Error(`Geen recht '${recht}' voor rol ${GEBRUIKERSROL_LABEL[g.rol] ?? g.rol}.`);
  return g;
}
