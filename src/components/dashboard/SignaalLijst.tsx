// Signalenlijst met ernst-badge (US-06, US-21, US-28, US-32, US-33).
import Link from "next/link";
import type { Signaal } from "@/lib/domain/types";
import { Badge, Leeg } from "@/components/ui";

const ERNST: Record<Signaal["ernst"], { kleur: "rood" | "geel" | "blauw"; label: string }> = {
  kritiek: { kleur: "rood", label: "Kritiek" },
  waarschuwing: { kleur: "geel", label: "Waarschuwing" },
  info: { kleur: "blauw", label: "Info" }
};

const SOORT_LABEL: Record<Signaal["soort"], string> = {
  certificaat: "Certificaat",
  risico: "Risico",
  afhankelijkheid: "Afhankelijkheid",
  prospect: "Prospect",
  evaluatie: "Evaluatie",
  dekking: "Dekking",
  budget: "AI-budget"
};

export function SignaalLijst({ signalen }: { signalen: Signaal[] }) {
  if (signalen.length === 0) return <Leeg titel="Geen signalen" tekst="Er zijn geen signalen in deze categorie." />;
  return (
    <div className="signaalLijst">
      {signalen.map((s) => {
        const e = ERNST[s.ernst];
        return (
          <div key={s.id} className="signaal">
            <div>
              <Badge kleur={e.kleur}>{e.label}</Badge>
              <small className="muted klein-tekst" style={{ display: "block", marginTop: 4 }}>
                {SOORT_LABEL[s.soort]}
              </small>
            </div>
            <div>
              <strong>{s.link ? <Link href={s.link}>{s.titel}</Link> : s.titel}</strong>
              <p>{s.omschrijving}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
