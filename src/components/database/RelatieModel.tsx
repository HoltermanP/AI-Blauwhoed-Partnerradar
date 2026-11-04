// Relatiemodel van de database als diagram (SVG, op de server getekend). Overzicht: alle tabellen in kolommen per groep,
// met lijnen voor geneste gegevens (ouder → kind) en verwijzingen (id-veld → tabel). Focus: één tabel met al zijn kolommen,
// links wat ernaar verwijst en rechts waar hij naar verwijst. Hover over een tabel licht zijn relaties op (alleen CSS).
import Link from "next/link";
import { GROEPVOLGORDE, type Relatie, type Tabel } from "@/lib/domain/databaseverkenner";

const B = 232; // breedte van een tabelvak
const KOP = 34;
const RIJ = 20;
const VOET = 18;
const TUSSEN_Y = 14;
const TUSSEN_X = 120;
const RAND = 24;
const INSPRING = 14; // per nestingniveau

type Vak = { naam: string; x: number; y: number; b: number; h: number; rijY: Map<string, number> };

const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
const diepte = (naam: string) => naam.split(".").length - 1;
const kort = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
const titel = (t: Tabel) => (t.ouder ? `› ${t.naam.split(".").slice(1).join(" › ")}` : t.label);
const link = (t: string) => `/database?weergave=model&t=${encodeURIComponent(t)}`;

/** Lijn tussen twee punten als vloeiende curve; aan de zijkant als bron en doel in dezelfde kolom staan. */
function pad(x1: number, y1: number, x2: number, y2: number, zijkant?: number) {
  if (zijkant !== undefined) return `M${x1},${y1} C${zijkant},${y1} ${zijkant},${y2} ${x2},${y2}`;
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  const r = x2 >= x1 ? 1 : -1;
  return `M${x1},${y1} C${x1 + dx * r},${y1} ${x2 - dx * r},${y2} ${x2},${y2}`;
}

function TabelVak({ t, vak, rijen, voet, actief, volledig }: { t: Tabel; vak: Vak; rijen: Array<{ kolom: string; doel?: string; soort?: Relatie["soort"] }>; voet?: string; actief?: boolean; volledig?: boolean }) {
  const groepKlas = `g-${slug(t.groep)}`;
  return (
    <a href={link(t.naam)} className={`vak v-${slug(t.naam)} ${groepKlas}${actief ? " actief" : ""}${t.rijen.length ? "" : " leeg"}`}>
      <title>{`${t.label} (${t.naam}) · ${t.rijen.length} records · ${t.kolommen.length} kolommen`}</title>
      <rect x={vak.x} y={vak.y} width={vak.b} height={vak.h} rx={8} className="vakRand" />
      <rect x={vak.x} y={vak.y} width={vak.b} height={KOP} rx={8} className="vakKop" />
      <rect x={vak.x} y={vak.y + KOP - 8} width={vak.b} height={8} className="vakKop" />
      <text x={vak.x + 12} y={vak.y + 21} className="vakTitel">
        {kort(volledig ? t.label : titel(t), Math.floor((vak.b - 56) / 7.4))}
      </text>
      <text x={vak.x + vak.b - 12} y={vak.y + 21} textAnchor="end" className="vakAantal">
        {t.rijen.length}
      </text>
      {rijen.map((r, i) => {
        const y = vak.y + KOP + i * RIJ;
        return (
          <g key={r.kolom}>
            <text x={vak.x + 12} y={y + 14} className={r.doel ? (r.soort === "kind" ? "rijKind" : "rijSleutel") : "rijVeld"}>
              {r.doel ? (r.soort === "kind" ? "↑ " : "→ ") : ""}
              {kort(r.kolom, Math.floor((vak.b - 24) / 6.8) - (r.doel ? 2 : 0))}
            </text>
          </g>
        );
      })}
      {voet ? (
        <text x={vak.x + 12} y={vak.y + vak.h - 6} className="vakVoet">
          {voet}
        </text>
      ) : null}
    </a>
  );
}

/** Stijlregels per tabel: hover licht de eigen relaties op en dimt de rest. */
function HoverStijl({ tabellen }: { tabellen: Tabel[] }) {
  const regels = tabellen.map((t) => `.erd:has(.v-${slug(t.naam)}:hover) .r-${slug(t.naam)}{opacity:1;stroke-width:2.4}`).join("");
  return <style>{`.erd:has(.vak:hover) .rel{opacity:.12}${regels}`}</style>;
}

function Legenda() {
  return (
    <div className="erdLegenda">
      <span>
        <i className="lijnVerwijzing" /> verwijzing (id-veld → tabel)
      </span>
      <span>
        <i className="lijnKind" /> geneste gegevens (kind → ouder)
      </span>
      <span>
        <b>→ kolom</b> verwijst naar een andere tabel
      </span>
      <span className="muted">Getal rechtsboven = aantal records. Klik op een tabel voor de details; ga erover met de muis om de relaties te zien.</span>
    </div>
  );
}

export function RelatieOverzicht({ tabellen, relaties }: { tabellen: Tabel[]; relaties: Relatie[] }) {
  const groepen = GROEPVOLGORDE.filter((g) => tabellen.some((t) => t.groep === g));
  const vakken = new Map<string, Vak>();
  let hoogte = 0;
  groepen.forEach((g, kol) => {
    let y = RAND + 26;
    for (const t of tabellen.filter((x) => x.groep === g)) {
      const d = diepte(t.naam);
      const sleutels = relaties.filter((r) => r.van === t.naam);
      const metVoet = t.kolommen.length > sleutels.length;
      const h = KOP + sleutels.length * RIJ + (metVoet ? VOET : 0) + 6;
      const x = RAND + kol * (B + TUSSEN_X) + d * INSPRING;
      const rijY = new Map(sleutels.map((r, i) => [r.kolom, y + KOP + i * RIJ + 10]));
      vakken.set(t.naam, { naam: t.naam, x, y, b: B - d * INSPRING, h, rijY });
      y += h + (tabellen[tabellen.indexOf(t) + 1]?.ouder ? 8 : TUSSEN_Y);
    }
    hoogte = Math.max(hoogte, y);
  });
  const breedte = RAND * 2 + groepen.length * B + (groepen.length - 1) * TUSSEN_X;

  return (
    <>
      <Legenda />
      <div className="erdKader">
        <svg className="erd" viewBox={`0 0 ${breedte} ${hoogte + RAND}`} width={breedte} style={{ width: "100%", minWidth: Math.round(breedte * 0.62), maxWidth: breedte }} role="img" aria-label="Relatiemodel van de database">
          <HoverStijl tabellen={tabellen} />
          <defs>
            <marker id="pijl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="pijlKop" />
            </marker>
          </defs>
          {groepen.map((g, kol) => (
            <text key={g} x={RAND + kol * (B + TUSSEN_X)} y={RAND + 8} className="erdGroep">
              {g.toUpperCase()}
            </text>
          ))}
          {relaties.map((r) => {
            const a = vakken.get(r.van);
            const b = vakken.get(r.naar);
            if (!a || !b) return null;
            const sy = a.rijY.get(r.kolom) ?? a.y + KOP / 2;
            const ty = b.y + KOP / 2;
            let d: string;
            if (r.soort === "kind" && Math.abs(a.x - b.x) <= INSPRING * 4 && a.x >= b.x) d = pad(a.x, a.y + KOP / 2, b.x, ty, Math.min(a.x, b.x) - 16);
            else if (Math.abs(a.x - b.x) < B / 2) d = pad(a.x + a.b, sy, b.x + b.b, ty, Math.max(a.x + a.b, b.x + b.b) + 46);
            else if (b.x > a.x) d = pad(a.x + a.b, sy, b.x, ty);
            else d = pad(a.x, sy, b.x + b.b, ty);
            return (
              <path key={`${r.van}.${r.kolom}>${r.naar}`} d={d} className={`rel ${r.soort === "kind" ? "relKind" : "relVerwijzing"} r-${slug(r.van)} r-${slug(r.naar)}`} markerEnd="url(#pijl)">
                <title>{`${r.van}.${r.kolom} → ${r.naar} (${r.aantal} records)`}</title>
              </path>
            );
          })}
          {tabellen.map((t) => {
            const vak = vakken.get(t.naam);
            if (!vak) return null;
            const sleutels = relaties.filter((r) => r.van === t.naam);
            const overig = t.kolommen.length - sleutels.length;
            return <TabelVak key={t.naam} t={t} vak={vak} rijen={sleutels.map((r) => ({ kolom: r.kolom, doel: r.naar, soort: r.soort }))} voet={overig > 0 ? `+ ${overig} velden` : undefined} />;
          })}
        </svg>
      </div>
    </>
  );
}

export function RelatieFocus({ tabel, tabellen, relaties }: { tabel: Tabel; tabellen: Tabel[]; relaties: Relatie[] }) {
  const inkomend = relaties.filter((r) => r.naar === tabel.naam);
  const uitgaand = relaties.filter((r) => r.van === tabel.naam);
  const vind = (naam: string) => tabellen.find((t) => t.naam === naam);
  const MAX_KOLOMMEN = 40;
  const kolommen = ["id", ...tabel.kolommen.filter((k) => k !== "id")].slice(0, MAX_KOLOMMEN);
  // Zijvakken breder dan in het overzicht: daar staat de volledige naam (bijv. "Matchruns › resultaat › kandidaten").
  const BZ = 320;
  const xLinks = RAND;
  const xMidden = RAND + BZ + TUSSEN_X;
  const xRechts = xMidden + B + TUSSEN_X;
  const midH = KOP + kolommen.length * RIJ + (tabel.kolommen.length + 1 > MAX_KOLOMMEN ? VOET : 0) + 8;
  const midden: Vak = { naam: tabel.naam, x: xMidden, y: RAND + 26, b: B, h: midH, rijY: new Map(kolommen.map((k, i) => [k, RAND + 26 + KOP + i * RIJ + 10])) };

  const links: Array<{ r: Relatie; t: Tabel; vak: Vak }> = [];
  let y = RAND + 26;
  for (const r of inkomend) {
    const t = vind(r.van);
    if (!t) continue;
    const h = KOP + RIJ + 8;
    links.push({ r, t, vak: { naam: t.naam, x: xLinks, y, b: BZ, h, rijY: new Map([[r.kolom, y + KOP + 10]]) } });
    y += h + TUSSEN_Y;
  }
  const hoogteLinks = y;
  const rechts: Array<{ r: Relatie; t: Tabel; vak: Vak }> = [];
  y = RAND + 26;
  for (const r of uitgaand) {
    const t = vind(r.naar);
    if (!t) continue;
    const h = KOP + 8;
    rechts.push({ r, t, vak: { naam: t.naam, x: xRechts, y, b: BZ, h, rijY: new Map() } });
    y += h + TUSSEN_Y;
  }
  const hoogte = Math.max(hoogteLinks, y, midden.y + midH) + RAND;
  const breedte = xRechts + BZ + RAND;
  const sleutelVan = new Map(uitgaand.map((r) => [r.kolom, r]));

  return (
    <>
      <p className="erdKruimel">
        <Link href="/database?weergave=model">← Volledig model</Link> · <Link href={`/database?t=${encodeURIComponent(tabel.naam)}`}>Gegevens van {tabel.label} bekijken</Link>
      </p>
      <Legenda />
      <div className="erdKolomKoppen">
        <span>Verwijst naar {tabel.label} ({inkomend.length})</span>
        <span>{tabel.label}</span>
        <span>{tabel.label} verwijst naar ({uitgaand.length})</span>
      </div>
      <div className="erdKader">
        <svg className="erd" viewBox={`0 0 ${breedte} ${hoogte}`} width={breedte} style={{ width: "100%", minWidth: Math.round(breedte * 0.62), maxWidth: breedte }} role="img" aria-label={`Relaties van ${tabel.label}`}>
          <HoverStijl tabellen={tabellen} />
          <defs>
            <marker id="pijl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="pijlKop" />
            </marker>
          </defs>
          {links.map(({ r, vak }) => (
            <path key={`l-${r.van}.${r.kolom}`} d={pad(vak.x + vak.b, vak.rijY.get(r.kolom)!, midden.x, midden.y + KOP / 2)} className={`rel ${r.soort === "kind" ? "relKind" : "relVerwijzing"} r-${slug(r.van)}`} markerEnd="url(#pijl)">
              <title>{`${r.van}.${r.kolom} → ${r.naar} (${r.aantal} records)`}</title>
            </path>
          ))}
          {rechts.map(({ r, vak }) => (
            <path key={`r-${r.kolom}>${r.naar}`} d={pad(midden.x + midden.b, midden.rijY.get(r.kolom) ?? midden.y + KOP / 2, vak.x, vak.y + KOP / 2)} className={`rel ${r.soort === "kind" ? "relKind" : "relVerwijzing"} r-${slug(r.naar)}`} markerEnd="url(#pijl)">
              <title>{`${r.van}.${r.kolom} → ${r.naar} (${r.aantal} records)`}</title>
            </path>
          ))}
          {links.map(({ r, t, vak }) => (
            <TabelVak key={`lv-${r.van}.${r.kolom}`} t={t} vak={vak} rijen={[{ kolom: r.kolom, doel: r.naar, soort: r.soort }]} volledig />
          ))}
          <TabelVak
            t={tabel}
            vak={midden}
            actief
            volledig
            rijen={kolommen.map((k) => ({ kolom: k, doel: sleutelVan.get(k)?.naar, soort: sleutelVan.get(k)?.soort }))}
            voet={tabel.kolommen.length + 1 > MAX_KOLOMMEN ? `+ ${tabel.kolommen.length + 1 - MAX_KOLOMMEN} velden` : undefined}
          />
          {rechts.map(({ r, t, vak }) => (
            <TabelVak key={`rv-${r.kolom}>${r.naar}`} t={t} vak={vak} rijen={[]} volledig />
          ))}
        </svg>
      </div>
      {!inkomend.length && !uitgaand.length ? <p className="muted">Deze tabel heeft geen relaties met andere tabellen.</p> : null}
    </>
  );
}
