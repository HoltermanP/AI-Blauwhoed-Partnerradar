// Gedeelde certificaathelpers (server én client): typenlijst en geldigheidsstatus (US-06).
import type { CertificaatType } from "@/lib/domain/types";

export const CERTIFICAAT_TYPEN: CertificaatType[] = ["ISO 9001", "ISO 14001", "VCA", "CO2-prestatieladder", "FSC", "PEFC", "BREEAM-expertise", "Woonkeur", "KOMO"];

export function certificaatStatus(geldigTot: string, nu = new Date()): { kleur: "groen" | "geel" | "rood"; label: string; dagen: number } {
  const dagen = Math.round((new Date(geldigTot).getTime() - nu.getTime()) / 86_400_000);
  if (dagen < 0) return { kleur: "rood", label: "verlopen", dagen };
  if (dagen <= 90) return { kleur: "geel", label: `verloopt over ${dagen} d`, dagen };
  return { kleur: "groen", label: "geldig", dagen };
}
