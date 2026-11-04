"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CloudDownload, Database, FolderKanban, LayoutDashboard, Menu, Settings, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";

/**
 * Hoofdnavigatie als zijbalk: zeven onderdelen met icoon; het actieve onderdeel klapt open met zijn subpagina's.
 * Alle bestaande adressen blijven bestaan. Een subpagina is actief voor zijn eigen adres en alles daaronder
 * (bijv. /partners/123), plus de paden in `ook`. Op een smal scherm schuift de zijbalk in via de menuknop.
 */
type Sub = { href: string; label: string; ook?: string[]; beheerder?: boolean; teller?: string };
type Groep = { label: string; icoon: LucideIcon; subs: Sub[]; beheerder?: boolean };

const GROEPEN: Groep[] = [
  { label: "Dashboard", icoon: LayoutDashboard, subs: [{ href: "/dashboard", label: "Dashboard", ook: ["/zoeken", "/chat"] }] },
  {
    label: "Partners",
    icoon: Users,
    subs: [
      { href: "/partners", label: "Overzicht" },
      { href: "/kaart", label: "Kaart" }
    ]
  },
  {
    label: "Projecten",
    icoon: FolderKanban,
    subs: [
      { href: "/projecten", label: "Projecten" },
      { href: "/historie", label: "Historie" },
      { href: "/evaluaties", label: "Evaluaties" },
      { href: "/verbanden", label: "Verbanden" }
    ]
  },
  {
    label: "Ophalen",
    icoon: CloudDownload,
    subs: [
      { href: "/verrijking", label: "Verrijken", teller: "voorstellen" },
      { href: "/discovery", label: "Nieuwe partners", teller: "kandidaten" }
    ]
  },
  {
    label: "Kwaliteit",
    icoon: ShieldCheck,
    subs: [
      { href: "/datakwaliteit", label: "Datakwaliteit" },
      // Vrijgave van AI-voorstellen is voorbehouden aan de beheerder (US-54/65).
      { href: "/vrijgave", label: "Vrijgave", beheerder: true, teller: "vrijgave" }
    ]
  },
  { label: "Database", icoon: Database, beheerder: true, subs: [{ href: "/database", label: "Database" }] },
  {
    label: "Beheer",
    icoon: Settings,
    subs: [
      { href: "/beheer", label: "Instellingen" },
      { href: "/factoren", label: "Factoren", ook: ["/beheer/factoren"] },
      { href: "/beheer/blauwdruk-data", label: "Blauwdruk-Data", ook: ["/beheer/goudstandaard"] },
      { href: "/beheer/gewichten", label: "Gewichten" },
      { href: "/beheer/gebruikers", label: "Gebruikers" },
      { href: "/beheer/verbruik", label: "AI-verbruik" },
      { href: "/beheer/audit", label: "Auditlog" },
      { href: "/privacy", label: "Privacy" }
    ]
  }
];

const past = (pad: string, href: string) => pad === href || pad.startsWith(`${href}/`);

/** De best passende subpagina (langste overeenkomst) voor het huidige pad. */
function actief(pad: string, groepen: Groep[]) {
  let beste: { groep: Groep; sub: Sub; lengte: number } | null = null;
  for (const groep of groepen)
    for (const sub of groep.subs)
      for (const href of [sub.href, ...(sub.ook ?? [])])
        if (past(pad, href) && (!beste || href.length > beste.lengte)) beste = { groep, sub, lengte: href.length };
  return beste;
}

export type Tellers = Partial<Record<"voorstellen" | "kandidaten" | "vrijgave", number>>;

export default function Zijbalk({ beheerder = false, tellers = {}, gebruiker, omgeving }: { beheerder?: boolean; tellers?: Tellers; gebruiker: ReactNode; omgeving?: ReactNode }) {
  const pad = usePathname();
  // Het uitschuifmenu (telefoon) is open voor het pad waarop het geopend is: na navigeren is het vanzelf weer dicht.
  const [openOp, setOpenOp] = useState<string | null>(null);
  const open = openOp === pad;
  const setOpen = (aan: boolean) => setOpenOp(aan ? pad : null);
  const groepen = GROEPEN.filter((g) => beheerder || !g.beheerder)
    .map((g) => ({ ...g, subs: g.subs.filter((s) => beheerder || !s.beheerder) }))
    .filter((g) => g.subs.length);
  const huidig = actief(pad, groepen);
  const teller = (s: Sub) => (s.teller ? tellers[s.teller as keyof Tellers] ?? 0 : 0);

  return (
    <>
      <div className="mobielBalk">
        <button type="button" className="menuKnop" aria-label="Menu openen" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={22} />
        </button>
        <Link href="/dashboard" className="mobielMerk" aria-label="Blauwhoed partnerdatabase">
          <img src="/brand/logo.png" alt="Blauwhoed" width={150} height={16} />
        </Link>
      </div>
      {open ? <div className="zijbalkScherm" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      <aside className={`zijbalk${open ? " open" : ""}`} aria-label="Hoofdmenu">
        <div className="zijbalkKop">
          <Link href="/dashboard" className="zijbalkMerk" aria-label="Blauwhoed partnerdatabase">
            <img src="/brand/logo.png" alt="Blauwhoed" width={160} height={17} />
            <span>Partnerdatabase</span>
          </Link>
          <button type="button" className="menuKnop sluit" aria-label="Menu sluiten" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="zijbalkNav">
          {groepen.map((g) => {
            const isActief = huidig?.groep.label === g.label;
            const Icoon = g.icoon;
            const totaal = g.subs.reduce((n, s) => n + teller(s), 0);
            return (
              <div key={g.label} className={`navGroep${isActief ? " actief" : ""}`}>
                <Link href={g.subs[0].href} className="navHoofd" aria-current={isActief && g.subs.length === 1 ? "page" : undefined}>
                  <Icoon size={18} strokeWidth={2} />
                  <span>{g.label}</span>
                  {!isActief && totaal ? <em className="navTeller">{totaal}</em> : null}
                </Link>
                {isActief && g.subs.length > 1 ? (
                  <div className="navSubs">
                    {g.subs.map((s) => (
                      <Link key={s.href} href={s.href} className={s === huidig?.sub ? "active" : ""} aria-current={s === huidig?.sub ? "page" : undefined}>
                        <span>{s.label}</span>
                        {teller(s) ? <em className="navTeller">{teller(s)}</em> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="zijbalkVoet">
          {omgeving}
          {gebruiker}
        </div>
      </aside>
    </>
  );
}
