import Link from "next/link";
import type { ReactNode } from "react";
import type { Bron, FactorWaardeStatus, GeenBronMarkering, PartnerStatus } from "@/lib/domain/types";
import { BRON_LABEL } from "@/lib/domain/types";
import { betrouwbaarheidNiveau, bronRang, INDICATIEF_LABEL, RANG_LABEL } from "@/lib/domain/herkomst";
import { STATUS_LABEL } from "@/lib/format";

export function PaginaKop({ eyebrow, titel, intro, acties }: { eyebrow?: string; titel: string; intro?: ReactNode; acties?: ReactNode }) {
  return (
    <div className="paginaKop">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{titel}</h1>
        {intro ? <p className="intro">{intro}</p> : null}
      </div>
      {acties ? <div className="paginaActies">{acties}</div> : null}
    </div>
  );
}

export function Kaart({ titel, children, acties, className, id }: { titel?: ReactNode; children: ReactNode; acties?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`kaart ${className ?? ""}`} id={id}>
      {titel || acties ? (
        <header className="kaartKop">
          {titel ? <h2>{titel}</h2> : <span />}
          {acties}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ children, kleur = "grijs", titel }: { children: ReactNode; kleur?: "grijs" | "blauw" | "groen" | "geel" | "rood" | "mint"; titel?: string }) {
  return (
    <span className={`badge badge-${kleur}`} title={titel}>
      {children}
    </span>
  );
}

const statusKleur: Record<PartnerStatus, "grijs" | "blauw" | "groen" | "geel" | "rood" | "mint"> = {
  bekend: "blauw",
  preferred: "groen",
  prospect: "geel",
  afgewezen: "grijs",
  geblokkeerd: "rood",
  gearchiveerd: "grijs",
  concept: "mint"
};

export function StatusBadge({ status }: { status: PartnerStatus }) {
  return <Badge kleur={statusKleur[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ScoreBalk({ score, label, klein }: { score: number; label?: string; klein?: boolean }) {
  const kleur = score >= 75 ? "var(--green)" : score >= 50 ? "var(--blue)" : score >= 30 ? "var(--orange)" : "var(--red)";
  return (
    <div className={`scoreBalk ${klein ? "klein" : ""}`} aria-label={`${label ?? "Score"} ${score}`}>
      <div className="scoreBalkSpoor">
        <div className="scoreBalkVulling" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: kleur }} />
      </div>
      <b>{Math.round(score)}</b>
    </div>
  );
}

export function Metriek({ waarde, label, sub }: { waarde: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <article className="metriek">
      <span>{waarde}</span>
      <p>{label}</p>
      {sub ? <small>{sub}</small> : null}
    </article>
  );
}

export function Leeg({ titel, tekst, actie }: { titel: string; tekst?: string; actie?: ReactNode }) {
  return (
    <div className="leeg">
      <h3>{titel}</h3>
      {tekst ? <p>{tekst}</p> : null}
      {actie}
    </div>
  );
}

export function Melding({ soort = "info", children }: { soort?: "info" | "waarschuwing" | "fout" | "succes"; children: ReactNode }) {
  return <div className={`melding melding-${soort}`}>{children}</div>;
}

export function Knop({ href, children, variant = "primair", klein }: { href: string; children: ReactNode; variant?: "primair" | "secundair" | "tekst"; klein?: boolean }) {
  return (
    <Link href={href} className={`knop knop-${variant} ${klein ? "klein" : ""}`}>
      {children}
    </Link>
  );
}

export function Definities({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="definities">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ items, actief, basis }: { items: Array<{ id: string; label: string; aantal?: number }>; actief: string; basis: string }) {
  return (
    <nav className="tabs" aria-label="Tabbladen">
      {items.map((t) => (
        <Link key={t.id} href={`${basis}?tab=${t.id}`} className={t.id === actief ? "active" : ""} scroll={false}>
          {t.label}
          {t.aantal !== undefined ? <span>{t.aantal}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

// ---------- Herkomst (US-50/51/52/53): één weergave van bron, rang, datum, betrouwbaarheid en status ----------
const NIVEAU_KLEUR = { hoog: "groen", midden: "geel", laag: "rood" } as const;

export function BetrouwbaarheidBadge({ waarde }: { waarde: number | undefined | null }) {
  if (waarde === undefined || waarde === null) return null;
  const niveau = betrouwbaarheidNiveau(waarde);
  return (
    <Badge kleur={NIVEAU_KLEUR[niveau]} titel={`Betrouwbaarheid ${Math.round(waarde * 100)}%`}>
      {niveau}
    </Badge>
  );
}

/** Bronlabel; rang 3 krijgt zichtbaar "indicatief – niet gevalideerd". */
export function BronLabel({ bron, detail }: { bron: string | undefined; detail?: string }) {
  if (!bron) return <span className="muted">bron onbekend</span>;
  const rang = bronRang(bron);
  return (
    <span className={`bronLabel rang-${rang}`} title={`${RANG_LABEL[rang]}${detail ? ` · ${detail}` : ""}`}>
      {BRON_LABEL[bron as Bron] ?? bron}
      {rang === 1 ? <Badge kleur="blauw">leidend</Badge> : null}
      {rang === 3 ? <Badge kleur="geel">{INDICATIEF_LABEL}</Badge> : null}
    </span>
  );
}

const STATUS_KLEUR = { gevalideerd: "groen", voorgesteld: "grijs", verouderd: "rood" } as const;

export function WaardeStatusBadge({ status }: { status: FactorWaardeStatus | undefined }) {
  if (!status) return <Badge kleur="grijs">berekend</Badge>;
  return <Badge kleur={STATUS_KLEUR[status]}>{status}</Badge>;
}

/** Compacte herkomstregel: bron · vastgesteld op · betrouwbaarheid · status (· gevalideerd door). */
export function HerkomstRegel({ bron, detail, datum, betrouwbaarheid, status, gevalideerdDoor, gevalideerdOp }: { bron?: string; detail?: string; datum?: string; betrouwbaarheid?: number; status?: FactorWaardeStatus; gevalideerdDoor?: string; gevalideerdOp?: string }) {
  return (
    <span className="herkomstRegel">
      <BronLabel bron={bron} detail={detail} />
      {datum ? <span className="muted klein-tekst">vastgesteld {new Date(datum).toLocaleDateString("nl-NL")}</span> : null}
      <BetrouwbaarheidBadge waarde={betrouwbaarheid} />
      <WaardeStatusBadge status={status} />
      {status === "gevalideerd" && gevalideerdDoor ? <span className="muted klein-tekst">door {gevalideerdDoor}{gevalideerdOp ? ` op ${new Date(gevalideerdOp).toLocaleDateString("nl-NL")}` : ""}</span> : null}
    </span>
  );
}

/** US-53: expliciete markering dat voor dit veld geen betrouwbare bron is gevonden (het veld blijft bewust leeg). */
export function GeenBronBadge({ markering }: { markering: GeenBronMarkering | undefined }) {
  if (!markering) return null;
  return (
    <Badge kleur="mint" titel={`Gezocht op ${new Date(markering.op).toLocaleDateString("nl-NL")} in: ${markering.doorzocht.join(", ") || "–"}. Het veld blijft leeg tot er een betrouwbare bron is.`}>
      geen betrouwbare bron ({new Date(markering.op).toLocaleDateString("nl-NL")})
    </Badge>
  );
}

/** US-70: vaste toelichting bij AI-uitkomsten. */
export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="disclaimer" role="note">
      {children}
    </p>
  );
}
