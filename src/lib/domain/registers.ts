// US-62: certificaten verifiëren in openbare keurmerk- en brancheregisters. Gevonden: het certificaat krijgt het register
// als bron met datum. Niet gevonden: het certificaat blijft 'geclaimd' (US-30).
import { normaliseerNaam } from "./discovery";
import type { CertificaatType, Partner, RegisterBron } from "./types";

export function registerUrl(r: RegisterBron, p: Pick<Partner, "naam" | "kvk">) {
  return r.url.replace(/\{naam\}/g, encodeURIComponent(p.naam)).replace(/\{kvk\}/g, encodeURIComponent(p.kvk ?? ""));
}

/** Komt de partner voor in de (platte) tekst van een registerpagina? Op KVK-nummer of genormaliseerde naam. */
export function partnerInRegister(tekst: string, p: Pick<Partner, "naam" | "kvk">) {
  if (p.kvk && /^\d{8}$/.test(p.kvk) && tekst.includes(p.kvk)) return true;
  const naam = normaliseerNaam(p.naam);
  return naam.length >= 4 && normaliseerNaam(tekst).includes(naam);
}

export type RegisterUitkomst = { registerId: string; register: string; certificaat: CertificaatType; url: string; gevonden: boolean; op: string };

export async function controleerRegisters(p: Pick<Partner, "naam" | "kvk">, registers: RegisterBron[], haal: (url: string) => Promise<string | null>, nu = new Date()): Promise<RegisterUitkomst[]> {
  const actief = registers.filter((r) => r.actief && (!r.url.includes("{kvk}") || /^\d{8}$/.test(p.kvk ?? "")));
  const uit = await Promise.all(
    actief.map(async (r) => {
      const url = registerUrl(r, p);
      const tekst = await haal(url);
      if (tekst === null) return null; // register niet bereikbaar: geen uitspraak
      return { registerId: r.id, register: r.naam, certificaat: r.certificaat, url, gevonden: partnerInRegister(tekst, p), op: nu.toISOString().slice(0, 10) };
    })
  );
  return uit.filter((x): x is RegisterUitkomst => Boolean(x));
}

/** Verwerk de uitkomsten op de certificaten van een partner (binnen een mutatie). Geeft certificaattypen terug die gevonden zijn maar ontbreken. */
export function verwerkRegisterUitkomsten(p: Partner, uitkomsten: RegisterUitkomst[]) {
  const ontbrekend: RegisterUitkomst[] = [];
  uitkomsten.forEach((u) => {
    const certs = p.certificaten.filter((c) => c.type === u.certificaat);
    if (!certs.length) {
      if (u.gevonden) ontbrekend.push(u);
      return;
    }
    certs.forEach((c) => {
      c.registerControle = { register: u.register, url: u.url, op: u.op, gevonden: u.gevonden };
      if (u.gevonden) {
        c.verificatie = "geverifieerd";
        c.geverifieerdOp = u.op;
        c.bronUrl = u.url;
      } else if (c.verificatie !== "geverifieerd" || !c.geverifieerdOp) c.verificatie = "geclaimd";
    });
  });
  return ontbrekend;
}
