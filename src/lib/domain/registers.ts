// US-62: certificaten verifiëren in openbare keurmerk- en brancheregisters. Gevonden: een voorstel dat een mens bevestigt,
// waarna het certificaat het register als bron met datum krijgt (geverifieerd). Niet gevonden: blijft 'geclaimd' (US-30).
import { normaliseerNaam } from "./discovery";
import type { CertificaatType, Partner, RegisterBron } from "./types";

export function registerUrl(r: RegisterBron, p: Pick<Partner, "naam" | "kvk">) {
  return r.url.replace(/\{naam\}/g, encodeURIComponent(p.naam)).replace(/\{kvk\}/g, encodeURIComponent(p.kvk ?? ""));
}

/**
 * Komt de partner voor in de (platte) tekst van een registerpagina? Op KVK-nummer, of op genormaliseerde naam. Zoekt het
 * register op naam, dan herhaalt de resultatenpagina meestal de zoekterm ("Resultaten voor …"); dan telt de naam pas als
 * gevonden als hij vaker voorkomt dan die echo.
 */
export function partnerInRegister(tekst: string, p: Pick<Partner, "naam" | "kvk">, zochtOpNaam = false) {
  if (p.kvk && /^\d{8}$/.test(p.kvk) && tekst.includes(p.kvk)) return true;
  const naam = normaliseerNaam(p.naam);
  if (naam.length < 4) return false;
  const aantal = normaliseerNaam(tekst).split(naam).length - 1;
  return aantal >= (zochtOpNaam ? 2 : 1);
}

export type RegisterUitkomst = { registerId: string; register: string; certificaat: CertificaatType; url: string; gevonden: boolean; op: string };

export async function controleerRegisters(p: Pick<Partner, "naam" | "kvk">, registers: RegisterBron[], haal: (url: string) => Promise<string | null>, nu = new Date()): Promise<RegisterUitkomst[]> {
  const actief = registers.filter((r) => r.actief && (!r.url.includes("{kvk}") || /^\d{8}$/.test(p.kvk ?? "")));
  const uit = await Promise.all(
    actief.map(async (r) => {
      const url = registerUrl(r, p);
      const tekst = await haal(url);
      if (tekst === null) return null; // register niet bereikbaar: geen uitspraak
      return { registerId: r.id, register: r.naam, certificaat: r.certificaat, url, gevonden: partnerInRegister(tekst, p, r.url.includes("{naam}")), op: nu.toISOString().slice(0, 10) };
    })
  );
  return uit.filter((x): x is RegisterUitkomst => Boolean(x));
}

/**
 * Leg de registercontrole vast op de certificaten (binnen een mutatie). Niet gevonden: blijft of wordt 'geclaimd'.
 * Gevonden verandert hier niets: dat wordt een voorstel (zie teBevestigen) dat een mens accepteert.
 */
export function verwerkRegisterUitkomsten(p: Partner, uitkomsten: RegisterUitkomst[]) {
  uitkomsten.forEach((u) => {
    p.certificaten
      .filter((c) => c.type === u.certificaat)
      .forEach((c) => {
        c.registerControle = { register: u.register, url: u.url, op: u.op, gevonden: u.gevonden };
        if (!u.gevonden && c.verificatie !== "geverifieerd") c.verificatie = "geclaimd";
      });
  });
  return teBevestigen(p, uitkomsten);
}

/** Vondsten die een mens moet bevestigen: een ontbrekend certificaat, of een vastgelegd certificaat dat nog niet geverifieerd is. */
export function teBevestigen(p: Pick<Partner, "certificaten">, uitkomsten: RegisterUitkomst[]) {
  return uitkomsten.filter((u) => u.gevonden && !p.certificaten.some((c) => c.type === u.certificaat && c.verificatie === "geverifieerd"));
}
