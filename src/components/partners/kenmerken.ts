// Gedeeld (server én client): codering van meerdere kenmerkfilters in de querystring: k=factor:optie:min;factor:optie:min
export type KenmerkEis = { factorId: string; optieId: string; min: string };

export function parseKenmerken(k: string | undefined): KenmerkEis[] {
  if (!k) return [];
  return k
    .split(";")
    .map((deel) => deel.split(":"))
    .filter((d) => d[0])
    .map(([factorId, optieId = "", min = ""]) => ({ factorId, optieId, min }));
}

export function serialiseerKenmerken(eisen: KenmerkEis[]) {
  return eisen
    .filter((e) => e.factorId)
    .map((e) => `${e.factorId}:${e.optieId}:${e.min}`)
    .join(";");
}
