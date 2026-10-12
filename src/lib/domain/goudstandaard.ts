// US-49: goudstandaard per partnertype. Blauwhoed legt per rol vast welke velden verplicht of gewenst zijn en op welke
// criteria een partner wordt beoordeeld. Waarden met bron goudstandaard/eigen uitgave (rang 1) zijn leidend: AI zet er
// hooguit een voorstel naast (zie markeerAlternatieven in herkomst.ts).
import { basisveldWaarde } from "./herkomst";
import { BASISVELD_LABEL, ROLLEN } from "./types";
import type { BasisVeld, Database, Factor, GoudstandaardProfiel, GoudstandaardVeld, Partner, Rol } from "./types";

/**
 * Startpunt zolang Blauwhoed de eigen goudstandaard nog niet heeft vastgesteld (volledig aan te passen in Beheer, zonder
 * ontwikkelaar). Per type eigen verplichte en gewenste kenmerken (US-01); de architect heeft bewust een kleinere vaste set.
 */
const STANDAARD_FACTOREN: Record<Rol, { verplicht: string[]; gewenst: string[] }> = {
  houtbouwer: { verplicht: ["mpg", "paris_proof", "productietijd", "levertijd", "kosten_m2", "productinformatie"], gewenst: ["bouwsysteem", "prefabricage", "biobased", "demontabel"] },
  architect: { verplicht: ["projecttype"], gewenst: ["architectuurstijl", "biobased"] },
  aannemer: { verplicht: ["projecttype", "bouwsysteem"], gewenst: ["prefabricage", "mpg", "co2_ladder", "bouwteam"] },
  installateur: { verplicht: ["projecttype", "beng"], gewenst: ["co2_ladder", "bim"] },
  adviseur: { verplicht: ["projecttype"], gewenst: ["circulariteit", "bim"] },
  constructeur: { verplicht: ["projecttype", "bouwsysteem"], gewenst: ["demontabel", "bim"] },
  leverancier: { verplicht: ["bouwsysteem", "productinformatie"], gewenst: ["prefabricage", "biobased", "levertijd", "kosten_m2"] },
  ontwikkelpartner: { verplicht: ["projecttype"], gewenst: ["prijssegment", "conceptbouw"] }
};

/** Basisvelden per type: de architect heeft een kleinere vaste set (geen rechtsvorm als gewenst veld). */
const STANDAARD_BASIS = (rol: Rol): GoudstandaardVeld[] => [
  { sleutel: "basis:kvk", niveau: "verplicht" },
  { sleutel: "basis:vestigingsplaats", niveau: "verplicht" },
  { sleutel: "basis:website", niveau: "verplicht" },
  { sleutel: "basis:omschrijving", niveau: rol === "architect" ? "gewenst" : "verplicht" },
  ...(rol === "architect" ? [] : [{ sleutel: "basis:rechtsvorm", niveau: "gewenst" as const }])
];

export function standaardGoudstandaard(rol: Rol, factoren: Factor[], nu = new Date()): GoudstandaardProfiel {
  const bestaand = new Set(factoren.map((f) => f.id));
  const set = STANDAARD_FACTOREN[rol];
  const velden: GoudstandaardVeld[] = [
    ...STANDAARD_BASIS(rol),
    ...set.verplicht.filter((id) => bestaand.has(id)).map((id) => ({ sleutel: `factor:${id}`, niveau: "verplicht" as const })),
    ...set.gewenst.filter((id) => bestaand.has(id)).map((id) => ({ sleutel: `factor:${id}`, niveau: "gewenst" as const }))
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
  return p.factoren.some((f) => f.factorId === fid && f.status !== "afgewezen");
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
