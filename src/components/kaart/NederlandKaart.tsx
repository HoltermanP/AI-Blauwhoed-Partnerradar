// US-41: inline SVG-kaart zonder tiles. Partners = cirkels (kleur per status, grootte per medewerkers), projecten = vierkanten.
import Link from "next/link";
import type { Partner, PartnerStatus, Project } from "@/lib/domain/types";
import { STATUS_LABEL } from "@/lib/format";
import { IJSSELMEER, kmNaarPx, NL_OMTREK, projecteer, puntenNaarPad, VIEW } from "./projectie";

export const STATUS_KLEUR: Record<PartnerStatus, string> = {
  bekend: "#003e7e",
  preferred: "#147a4b",
  prospect: "#c99a00",
  afgewezen: "#9a9a9a",
  geblokkeerd: "#d11f1f"
};

export type KaartKoppeling = { partner: Partner; afstandKm: number; binnenWerkgebied: boolean };

export function NederlandKaart({ partners, projecten, geselecteerd, koppelingen }: { partners: Partner[]; projecten: Project[]; geselecteerd?: Project; koppelingen: KaartKoppeling[] }) {
  const straal = (p: Partner) => 3 + Math.min(9, Math.sqrt(p.medewerkers ?? 10) / 2);
  const sel = geselecteerd ? projecteer(geselecteerd.locatie) : null;
  return (
    <svg className="kaartSvg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" aria-label="Kaart van Nederland met partners en projecten">
      <polygon points={puntenNaarPad(NL_OMTREK)} fill="#ffffff" stroke="#9fb3c8" strokeWidth={1.2} />
      <polygon points={puntenNaarPad(IJSSELMEER)} fill="#f0f4f8" stroke="#9fb3c8" strokeWidth={0.8} />

      {/* Werkgebiedcirkels van partners die het geselecteerde project dekken */}
      {sel
        ? koppelingen
            .filter((k) => k.binnenWerkgebied)
            .map((k) => {
              const p = projecteer(k.partner.locatie);
              return <circle key={`wg-${k.partner.id}`} cx={p.x} cy={p.y} r={kmNaarPx(k.partner.werkgebiedKm)} fill={STATUS_KLEUR[k.partner.status]} fillOpacity={0.06} stroke={STATUS_KLEUR[k.partner.status]} strokeOpacity={0.4} strokeDasharray="3 3" />;
            })
        : null}

      {/* Lijnen partner → project met afstand */}
      {sel
        ? koppelingen
            .filter((k) => k.binnenWerkgebied)
            .map((k) => {
              const p = projecteer(k.partner.locatie);
              const mx = (p.x + sel.x) / 2;
              const my = (p.y + sel.y) / 2;
              return (
                <g key={`lijn-${k.partner.id}`}>
                  <line x1={p.x} y1={p.y} x2={sel.x} y2={sel.y} stroke="#003e7e" strokeWidth={0.8} strokeOpacity={0.6} />
                  <text x={mx + 3} y={my - 2} fill="#003e7e">
                    {k.afstandKm} km
                  </text>
                </g>
              );
            })
        : null}

      {partners.map((p) => {
        const c = projecteer(p.locatie);
        return (
          <Link key={p.id} href={`/partners/${p.id}`}>
            <circle cx={c.x} cy={c.y} r={straal(p)} fill={STATUS_KLEUR[p.status]} fillOpacity={0.85} stroke="white" strokeWidth={1}>
              <title>{`${p.naam} · ${STATUS_LABEL[p.status]} · ${p.vestigingsplaats} · werkgebied ${p.werkgebiedKm} km`}</title>
            </circle>
          </Link>
        );
      })}

      {projecten.map((pr) => {
        const c = projecteer(pr.locatie);
        const actief = geselecteerd?.id === pr.id;
        const s = actief ? 12 : 9;
        return (
          <Link key={pr.id} href={`/kaart?project=${pr.id}`}>
            <g>
              <rect x={c.x - s / 2} y={c.y - s / 2} width={s} height={s} fill="#009ade" stroke={actief ? "#003e7e" : "white"} strokeWidth={actief ? 2 : 1}>
                <title>{`${pr.naam} · ${pr.locatie.plaats} · ${pr.woningen} woningen`}</title>
              </rect>
              <text x={c.x + s / 2 + 3} y={c.y + 3} fontWeight={actief ? 700 : 400}>
                {pr.naam}
              </text>
            </g>
          </Link>
        );
      })}
    </svg>
  );
}
