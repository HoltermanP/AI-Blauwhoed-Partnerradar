import type { Geo } from "./types";

/** Afstand in km over de aardbol (haversine). Het genormaliseerde schema gebruikt PostGIS ST_Distance. */
export function afstandKm(a: Geo, b: Geo) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Bekende Nederlandse plaatsen voor geocoding zonder externe dienst. */
export const PLAATSEN: Record<string, Geo> = {
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  "den haag": { lat: 52.0705, lng: 4.3007 },
  utrecht: { lat: 52.0907, lng: 5.1214 },
  eindhoven: { lat: 51.4416, lng: 5.4697 },
  groningen: { lat: 53.2194, lng: 6.5665 },
  tilburg: { lat: 51.5555, lng: 5.0913 },
  almere: { lat: 52.3508, lng: 5.2647 },
  breda: { lat: 51.5719, lng: 4.7683 },
  nijmegen: { lat: 51.8126, lng: 5.8372 },
  arnhem: { lat: 51.9851, lng: 5.8987 },
  haarlem: { lat: 52.3874, lng: 4.6462 },
  amersfoort: { lat: 52.1561, lng: 5.3878 },
  zaandam: { lat: 52.4389, lng: 4.8265 },
  zwolle: { lat: 52.5168, lng: 6.083 },
  leiden: { lat: 52.1601, lng: 4.497 },
  delft: { lat: 52.0116, lng: 4.3571 },
  apeldoorn: { lat: 52.2112, lng: 5.9699 },
  deventer: { lat: 52.2661, lng: 6.1552 },
  "den bosch": { lat: 51.6978, lng: 5.3037 },
  maastricht: { lat: 50.8514, lng: 5.691 },
  leeuwarden: { lat: 53.2012, lng: 5.7999 },
  enschede: { lat: 52.2215, lng: 6.8937 },
  dordrecht: { lat: 51.8133, lng: 4.6901 },
  hoorn: { lat: 52.6425, lng: 5.0597 },
  alkmaar: { lat: 52.6324, lng: 4.7534 },
  hilversum: { lat: 52.2292, lng: 5.1669 },
  gouda: { lat: 52.0115, lng: 4.7104 },
  purmerend: { lat: 52.505, lng: 4.9597 },
  ede: { lat: 52.0402, lng: 5.6649 },
  woerden: { lat: 52.0852, lng: 4.8836 },
  lelystad: { lat: 52.5185, lng: 5.4714 }
};

export function geocode(plaats: string): Geo | null {
  const key = plaats.trim().toLowerCase().replace(/^'s-hertogenbosch$/, "den bosch").replace(/^s-gravenhage$/, "den haag");
  return PLAATSEN[key] ?? null;
}
