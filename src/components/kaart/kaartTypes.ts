// Gedeelde kaartkleuren en -types zonder Leaflet-afhankelijkheid (veilig op de server).
import type { Partner, PartnerStatus } from "@/lib/domain/types";

export const STATUS_KLEUR: Record<PartnerStatus, string> = {
  bekend: "#003e7e",
  preferred: "#147a4b",
  prospect: "#c99a00",
  afgewezen: "#9a9a9a",
  geblokkeerd: "#d11f1f"
};

export type KaartKoppeling = { partner: Partner; afstandKm: number; binnenWerkgebied: boolean };
