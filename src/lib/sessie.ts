// US-64: de ingelogde gebruiker. Met Auth.js komt het e-mailadres uit de sessie; de gebruiker (en zijn rol) staat in de
// eigen database. Nieuwe medewerkers krijgen bij de eerste inlog de rol gebruiker; het adres uit EERSTE_BEHEERDER_EMAIL is
// altijd beheerder. Zonder inlogconfiguratie werkt in ontwikkelmodus de demo-rolwisselaar (cookie).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, demoModus, emailToegestaan } from "@/authjs";
import type { Gebruiker } from "./domain/types";
import { getDb, planOpslaanExtern } from "./store";

/** Demo-accounts voor ontwikkelmodus. */
export const DEMO_GEBRUIKERS: Gebruiker[] = [
  { id: "u-gebruiker", naam: "Gebruiker (demo)", rol: "gebruiker" },
  { id: "u-beheer", naam: "Beheerder (demo)", rol: "beheerder" }
];
/** Oude demo-ID's (vóór v3.1: lezer, ontwikkelingsmanager, inkoper) vallen onder de rol gebruiker. */
export const OUDE_DEMO_IDS: Record<string, string> = { "u-lezer": "u-gebruiker", "u-om": "u-gebruiker", "u-inkoper": "u-gebruiker" };
const DEMO = DEMO_GEBRUIKERS;
const OUD = OUDE_DEMO_IDS;

export { eersteBeheerder, vindOfRegistreer } from "./domain/gebruikers";
import { vindOfRegistreer } from "./domain/gebruikers";

export async function huidigeSessieGebruiker(): Promise<Gebruiker> {
  if (demoModus()) {
    const jar = await cookies();
    const id = jar.get("pr_gebruiker")?.value ?? "";
    return DEMO.find((g) => g.id === (OUD[id] ?? id)) ?? DEMO[0];
  }
  const sessie = await auth();
  const email = sessie?.user?.email;
  if (!email) redirect("/inloggen");
  if (!emailToegestaan(email)) redirect("/inloggen?fout=domein");
  const db = await getDb();
  db.gebruikers = db.gebruikers ?? [];
  const { gebruiker, nieuw } = vindOfRegistreer(db.gebruikers, email, sessie?.user?.name ?? undefined);
  if (gebruiker.actief === false) redirect("/inloggen?fout=geblokkeerd");
  const nu = new Date();
  // Laatste inlog hooguit eens per uur bijwerken (scheelt schrijfacties).
  if (nieuw || !gebruiker.laatstIngelogdOp || nu.getTime() - new Date(gebruiker.laatstIngelogdOp).getTime() > 3_600_000) {
    gebruiker.laatstIngelogdOp = nu.toISOString();
    if (nieuw) db.audit.unshift({ id: `audit-login-${nu.getTime().toString(36)}`, op: nu.toISOString(), door: gebruiker.naam, gebruikerId: gebruiker.id, gebruikersrol: gebruiker.rol, entiteit: "gebruiker", entiteitId: gebruiker.id, actie: "eerste inlog (account aangemaakt)", details: `rol ${gebruiker.rol}` });
    planOpslaanExtern();
  }
  return gebruiker;
}
