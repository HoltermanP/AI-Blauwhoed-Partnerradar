"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/partners", label: "Partners" },
  { href: "/projecten", label: "Projecten" },
  { href: "/zoeken", label: "Zoeken" },
  { href: "/chat", label: "Chat" },
  { href: "/factoren", label: "Factoren" },
  { href: "/kaart", label: "Kaart" },
  { href: "/historie", label: "Historie" },
  { href: "/verbanden", label: "Verbanden" },
  { href: "/discovery", label: "Discovery" },
  { href: "/verrijking", label: "Verrijking" },
  { href: "/beheer", label: "Beheer" }
];

export default function NavLinks() {
  const pad = usePathname();
  return (
    <nav aria-label="Hoofdnavigatie" className="hoofdNav">
      {LINKS.map((l) => {
        const actief = l.exact ? pad === l.href : pad.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={actief ? "active" : ""}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
