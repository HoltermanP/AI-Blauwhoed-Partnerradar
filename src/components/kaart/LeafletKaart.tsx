"use client";
// US-41: echte kaart (Leaflet + PDOK BRT Achtergrondkaart) met partners, projecten, werkgebieden en afstanden.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Partner, Project } from "@/lib/domain/types";
import { STATUS_LABEL } from "@/lib/format";
import { STATUS_KLEUR, type KaartKoppeling } from "./kaartTypes";

const PROJECT_KLEUR = "#009ade";
const NL_CENTRUM: L.LatLngExpression = [52.2, 5.3];
const TILES = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png";
const ATTRIBUTIE = '&copy; <a href="https://www.kadaster.nl" target="_blank" rel="noreferrer">Kadaster</a> · <a href="https://www.pdok.nl" target="_blank" rel="noreferrer">PDOK</a> (CC BY 4.0)';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function LeafletKaart({ partners, projecten, geselecteerd, koppelingen }: { partners: Partner[]; projecten: Project[]; geselecteerd?: Project; koppelingen: KaartKoppeling[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const kaartRef = useRef<L.Map | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current || kaartRef.current) return;
    const kaart = L.map(ref.current, { center: NL_CENTRUM, zoom: 7, scrollWheelZoom: false });
    L.tileLayer(TILES, { attribution: ATTRIBUTIE, minZoom: 6, maxZoom: 18 }).addTo(kaart);
    kaartRef.current = kaart;
    return () => {
      kaart.remove();
      kaartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const kaart = kaartRef.current;
    if (!kaart) return;
    const laag = L.layerGroup().addTo(kaart);
    const straal = (p: Partner) => 5 + Math.min(10, Math.sqrt(p.medewerkers ?? 10) / 2);

    if (geselecteerd) {
      const sel: L.LatLngExpression = [geselecteerd.locatie.lat, geselecteerd.locatie.lng];
      koppelingen
        .filter((k) => k.binnenWerkgebied)
        .forEach((k) => {
          const kleur = STATUS_KLEUR[k.partner.status];
          const van: L.LatLngExpression = [k.partner.locatie.lat, k.partner.locatie.lng];
          L.circle(van, { radius: k.partner.werkgebiedKm * 1000, color: kleur, weight: 1, opacity: 0.5, dashArray: "4 4", fillColor: kleur, fillOpacity: 0.05, interactive: false }).addTo(laag);
          L.polyline([van, sel], { color: "#003e7e", weight: 1.5, opacity: 0.6, interactive: false })
            .bindTooltip(`${k.afstandKm} km`, { permanent: true, direction: "center", className: "kaartAfstand" })
            .addTo(laag);
        });
    }

    partners.forEach((p) => {
      const kleur = STATUS_KLEUR[p.status];
      L.circleMarker([p.locatie.lat, p.locatie.lng], { radius: straal(p), color: "white", weight: 1.5, fillColor: kleur, fillOpacity: 0.9 })
        .bindTooltip(`${esc(p.naam)} · ${STATUS_LABEL[p.status]}`, { direction: "top", offset: [0, -6] })
        .bindPopup(
          `<b>${esc(p.naam)}</b><br>${STATUS_LABEL[p.status]} · ${esc(p.vestigingsplaats)}<br>Werkgebied ${p.werkgebiedKm} km${p.medewerkers ? ` · ${p.medewerkers} medewerkers` : ""}<br><a href="/partners/${encodeURIComponent(p.id)}">Naar partnerdossier →</a>`
        )
        .addTo(laag);
    });

    projecten.forEach((pr) => {
      const actief = geselecteerd?.id === pr.id;
      const s = actief ? 16 : 12;
      const icoon = L.divIcon({
        className: "kaartProject",
        iconSize: [s, s],
        iconAnchor: [s / 2, s / 2],
        html: `<span style="display:block;width:${s}px;height:${s}px;background:${PROJECT_KLEUR};border:${actief ? 2.5 : 1.5}px solid ${actief ? "#003e7e" : "white"};box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`
      });
      L.marker([pr.locatie.lat, pr.locatie.lng], { icon: icoon, zIndexOffset: actief ? 1000 : 500 })
        .bindTooltip(`<b>${esc(pr.naam)}</b> · ${esc(pr.locatie.plaats)} · ${pr.woningen} woningen`, { direction: "top", offset: [0, -s / 2], permanent: actief })
        .on("click", () => router.push(`/kaart?project=${encodeURIComponent(pr.id)}`))
        .addTo(laag);
    });

    const punten: L.LatLngExpression[] = geselecteerd
      ? [[geselecteerd.locatie.lat, geselecteerd.locatie.lng], ...koppelingen.filter((k) => k.binnenWerkgebied).map((k): L.LatLngExpression => [k.partner.locatie.lat, k.partner.locatie.lng])]
      : [...partners.map((p): L.LatLngExpression => [p.locatie.lat, p.locatie.lng]), ...projecten.map((pr): L.LatLngExpression => [pr.locatie.lat, pr.locatie.lng])];
    if (punten.length > 1) kaart.fitBounds(L.latLngBounds(punten).pad(0.15), { maxZoom: 11 });
    else if (punten.length === 1) kaart.setView(punten[0], 10);
    else kaart.setView(NL_CENTRUM, 7);

    return () => {
      laag.remove();
    };
  }, [partners, projecten, geselecteerd, koppelingen, router]);

  return <div ref={ref} className="kaartLeaflet" role="region" aria-label="Kaart van Nederland met partners en projecten" />;
}
