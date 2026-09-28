// US-49: goudstandaard per partnertype. Blauwhoed legt per rol vast welke velden verplicht of gewenst zijn en op welke
// criteria een partner wordt beoordeeld. Waarden met bron goudstandaard/eigen uitgave (rang 1) zijn leidend: AI zet er
// hooguit een voorstel naast (zie markeerAlternatieven in herkomst.ts).
import { basisveldWaarde } from "./herkomst";
import { BASISVELD_LABEL, ROLLEN } from "./types";
import type { BasisVeld, Database, Factor, GoudstandaardProfiel, GoudstandaardVeld, Partner, Rol } from "./types";

/** Startpunt zolang Blauwhoed de eigen goudstandaard nog niet heeft aangeleverd (volledig aan te passen in Beheer). */
const STANDAARD_FACTOREN: Record<Rol, string[]> = {
  architect: ["projecttype", "architectuurstijl", "welstand", "biobased", "circulariteit"],
  aannemer: ["projecttype", "bouwsysteem", "prefabricage", "mpg", "co2_ladder", "bouwteam"],
  installateur: ["projecttype", "beng", "co2_ladder", "bim"],
  adviseur: ["projecttype", "circulariteit", "bim"],
  leverancier: ["bouwsysteem", "prefabricage", "biobased", "demontabel"],
  ontwikkelpartner: ["projecttype", "prijssegment", "conceptbouw"]
};

export function standaardGoudstandaard(rol: Rol, factoren: Factor[], nu = new Date()): GoudstandaardProfiel {
  const bestaand = new Set(factoren.map((f) => f.id));
  const velden: GoudstandaardVeld[] = [
    { sleutel: "basis:kvk", niveau: "verplicht" },
    { sleutel: "basis:vestigingsplaats", niveau: "verplicht" },
    { sleutel: "basis:website", niveau: "verplicht" },
    { sleutel: "basis:omschrijving", niveau: "verplicht" },
    { sleutel: "basis:rechtsvorm", niveau: "gewenst" },
    ...STANDAARD_FACTOREN[rol].filter((id) => bestaand.has(id)).map((id, i) => ({ sleutel: `factor:${id}`, niveau: (i < 2 ? "verplicht" : "gewenst") as GoudstandaardVeld["niveau"] }))
  ];
  return {
    rol,
    velden,
    criteria: [
      { id: "kwaliteit", naam: "Kwaliteit", omschrijving: "Kwaliteit van het opgeleverde werk (evaluatie Blauwhoed)." },
      { id: "samenwerking", naam: "Samenwerking", omschrijving: "Samenwerking en communicatie in het projectteam." },
      { id: "duurzaamheid", naam: "Duurzaamheid", omschrijving: "Aantoonbare duurzaamheidsprestatie (MPG, biobased, circulariteit)." }
    ],
    versie: 0,
    bijgewerktOp: nu.toISOString(),
    door: "standaard (nog niet door Blauwhoed vastgesteld)"
  };
}

/** De goudstandaard voor een rol: vastgelegd door de beheerder, anders het startpunt. */
export function goudstandaardVoor(db: Pick<Database, "goudstandaard" | "factoren">, rol: Rol): GoudstandaardProfiel {
  return db.goudstandaard?.[rol] ?? standaardGoudstandaard(rol, db.factoren);
}

export function veldnaam(sleutel: string, factoren: Factor[]) {
  if (sleutel.startsWith("basis:")) return BASISVELD_LABEL[sleutel.slice(6) as BasisVeld] ?? sleutel;
  const f = factoren.find((x) => x.id === sleutel.slice(7));
  return f?.naam ?? sleutel;
}

export function veldGevuld(p: Partner, sleutel: string) {
  if (sleutel.startsWith("basis:")) return Boolean(basisveldWaarde(p, sleutel.slice(6) as BasisVeld));
  const fid = sleutel.slice(7);
  return p.factoren.some((f) => f.factorId === fid);
}

export type GoudstandaardRegel = GoudstandaardVeld & { naam: string; gevuld: boolean; geenBron: boolean; rollen: Rol[] };

/** Goudstandaardvelden van één partner (samengevoegd over zijn rollen; verplicht gaat voor gewenst). */
export function goudstandaardVoorPartner(p: Partner, db: Pick<Database, "goudstandaard" | "factoren">): GoudstandaardRegel[] {
  const map = new Map<string, GoudstandaardRegel>();
  p.rollen.forEach((rol) =>
    goudstandaardVoor(db, rol).velden.forEach((v) => {
      const b = map.get(v.sleutel);
      if (b) {
        b.rollen.push(rol);
        if (v.niveau === "verplicht") b.niveau = "verplicht";
        return;
      }
      map.set(v.sleutel, { ...v, naam: veldnaam(v.sleutel, db.factoren), gevuld: veldGevuld(p, v.sleutel), geenBron: Boolean(p.geenBron?.[v.sleutel]), rollen: [rol] });
    })
  );
  return Array.from(map.values()).sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === "verplicht" ? -1 : 1));
}

export function goudstandaardVolledigheid(p: Partner, db: Pick<Database, "goudstandaard" | "factoren">) {
  const regels = goudstandaardVoorPartner(p, db);
  const verplicht = regels.filter((r) => r.niveau === "verplicht");
  return {
    totaal: regels.length,
    gevuld: regels.filter((r) => r.gevuld).length,
    pct: regels.length ? Math.round((regels.filter((r) => r.gevuld).length / regels.length) * 100) : 100,
    verplichtOpen: verplicht.filter((r) => !r.gevuld).map((r) => r.naam),
    regels
  };
}

/** US-66: percentage gevulde goudstandaardvelden per partnertype (alleen zichtbare partners). */
export function goudstandaardPerRol(db: Database, partners: Partner[]) {
  return ROLLEN.map((rol) => {
    const lijst = partners.filter((p) => p.rollen.includes(rol));
    const velden = goudstandaardVoor(db, rol).velden;
    const totaal = lijst.length * velden.length;
    const gevuld = lijst.reduce((s, p) => s + velden.filter((v) => veldGevuld(p, v.sleutel)).length, 0);
    const onvolledig = lijst.filter((p) => velden.some((v) => v.niveau === "verplicht" && !veldGevuld(p, v.sleutel))).length;
    return { rol, partners: lijst.length, pct: totaal ? Math.round((gevuld / totaal) * 100) : null, onvolledig };
  }).filter((r) => r.partners > 0);
}

/** Velden die bij verrijking worden gezocht (voor de markering "geen betrouwbare bron", US-53). */
export function gezochteVelden(p: Partner, db: Pick<Database, "goudstandaard" | "factoren">): string[] {
  const basis = ["basis:website", "basis:kvk", "basis:vestigingsplaats", "basis:omschrijving"];
  const gs = p.rollen.length ? goudstandaardVoorPartner(p, db).map((r) => r.sleutel) : [];
  return Array.from(new Set([...basis, ...gs]));
}
