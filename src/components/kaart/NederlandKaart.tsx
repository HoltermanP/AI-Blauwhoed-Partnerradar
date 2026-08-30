"use client";
// US-41: laadt de Leaflet-kaart alleen in de browser (Leaflet heeft `window` nodig).
import dynamic from "next/dynamic";

export { STATUS_KLEUR, type KaartKoppeling } from "./kaartTypes";

export const NederlandKaart = dynamic(() => import("./LeafletKaart").then((m) => m.LeafletKaart), {
  ssr: false,
  loading: () => <div className="kaartLeaflet kaartLaden">Kaart laden…</div>
});
