// Welke partners tellen mee in zoeken, filteren, matchen, verbanden, chat en export (US-54, B8).
// Concepten (door AI voorgesteld, nog niet vrijgegeven door een beheerder) en gearchiveerde partners tellen nergens mee.
import type { Partner, PartnerStatus } from "./types";

export const NIET_ZICHTBAAR: PartnerStatus[] = ["ter_controle", "gearchiveerd"];

export function zichtbaar(p: Pick<Partner, "status">) {
  return !NIET_ZICHTBAAR.includes(p.status);
}

export function isConcept(p: Pick<Partner, "status">) {
  return p.status === "ter_controle";
}
