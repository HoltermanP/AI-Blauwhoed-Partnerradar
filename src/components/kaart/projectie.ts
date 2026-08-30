// US-41: lineaire projectie van lat/lng naar SVG-coördinaten binnen de bbox van Nederland.
import type { Geo } from "@/lib/domain/types";

export const BBOX = { latMin: 50.7, latMax: 53.6, lngMin: 3.3, lngMax: 7.3 };
export const VIEW = { w: 600, h: 700 };
const COS52 = Math.cos((52 * Math.PI) / 180);
/** Pixels per graad breedte (gelijk voor x en y; x wordt met cos(52°) gecorrigeerd). */
export const SCHAAL = Math.min(VIEW.w / ((BBOX.lngMax - BBOX.lngMin) * COS52), VIEW.h / (BBOX.latMax - BBOX.latMin));
const X_OFFSET = (VIEW.w - (BBOX.lngMax - BBOX.lngMin) * COS52 * SCHAAL) / 2;

export function projecteer(g: Geo): { x: number; y: number } {
  return {
    x: X_OFFSET + (g.lng - BBOX.lngMin) * COS52 * SCHAAL,
    y: (BBOX.latMax - g.lat) * SCHAAL
  };
}

/** Straal in km naar px: 1° breedtegraad ≈ 111 km. */
export const kmNaarPx = (km: number) => (km / 111) * SCHAAL;

/** Grove omtrek van Nederland (lat, lng), met de klok mee vanaf Zeeuws-Vlaanderen. */
export const NL_OMTREK: Array<[number, number]> = [
  [51.37, 3.37], [51.44, 3.57], [51.98, 4.12], [52.10, 4.27], [52.46, 4.55], [52.96, 4.75], [53.18, 4.85],
  [53.30, 5.20], [53.40, 5.60], [53.45, 5.80], [53.48, 6.25], [53.45, 6.85], [53.32, 7.20], [53.18, 7.21],
  [52.90, 7.20], [52.78, 7.07], [52.66, 6.75], [52.38, 7.05], [52.20, 7.00], [51.97, 6.75], [51.86, 6.50],
  [51.83, 6.10], [51.37, 6.20], [51.19, 6.05], [51.00, 5.90], [50.77, 6.02], [50.75, 5.69], [51.10, 5.55],
  [51.25, 5.60], [51.35, 5.16], [51.44, 4.93], [51.36, 4.40], [51.28, 4.05], [51.23, 3.80], [51.31, 3.39]
];

/** IJsselmeer, voor herkenbaarheid. */
export const IJSSELMEER: Array<[number, number]> = [
  [52.95, 5.05], [53.07, 5.35], [52.85, 5.40], [52.65, 5.62], [52.55, 5.60], [52.52, 5.45], [52.65, 5.25], [52.70, 5.28], [52.85, 5.05]
];

export const puntenNaarPad = (punten: Array<[number, number]>) =>
  punten.map(([lat, lng]) => { const p = projecteer({ lat, lng }); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ");
