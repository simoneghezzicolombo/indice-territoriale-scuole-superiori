import { useEffect, useRef } from "react";
import L from "leaflet";
import { CityData, MetricKey, SizeMetricKey } from "../types";

interface ItalyDotMapProps {
  cities: CityData[];
  activeCityId: string;
  colorMetric: MetricKey;
  sizeMetric: SizeMetricKey;
  onSelectCity: (cityId: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function metricValue(city: CityData, metric: MetricKey): number {
  return city[metric];
}

function sizeValue(city: CityData, metric: SizeMetricKey): number {
  if (metric === "fixed") return 1;
  if (metric === "diplomati") return city.details.diplomati;
  if (metric === "schoolsCount") return city.details.schoolsCount;
  if (metric === "workCoverage") return city.details.workCoverage;
  return city.details.reliability;
}

function interpolateColor(value: number, min: number, max: number): string {
  const t = clamp((value - min) / (max - min || 1), 0, 1);
  if (t < 0.25) return "#ba1a1a";
  if (t < 0.5) return "#d8842f";
  if (t < 0.7) return "#d9a441";
  if (t < 0.88) return "#177a74";
  return "#315e7d";
}

function markerHtml(city: CityData, color: string, radius: number, active: boolean): string {
  const size = radius * 2;
  const topRank = city.rank <= 5;
  const label = topRank ? String(city.rank) : "";
  const fontSize = topRank ? Math.max(10, Math.min(13, radius * 0.9)) : 0;

  return `<button class="map-dot ${active ? "is-active" : ""}" style="
    width:${size}px;
    height:${size}px;
    background:${color};
    border-color:${active ? "#031f27" : "rgba(255,255,255,0.95)"};
    box-shadow:${active ? "0 0 0 4px rgba(0,96,91,0.18)" : "0 2px 8px rgba(3,31,39,0.25)"};
    font-size:${fontSize}px;
  " aria-label="${city.name}, posizione ${city.rank}">${label}</button>`;
}

export default function ItalyDotMap({
  cities,
  activeCityId,
  colorMetric,
  sizeMetric,
  onSelectCity,
}: ItalyDotMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectCity);
  onSelectRef.current = onSelectCity;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([42.7, 12.6], 5.4);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const visible = cities.filter((city) => city.coordinates);
    const colorValues = visible.map((city) => metricValue(city, colorMetric));
    const sizeValues = visible.map((city) => sizeValue(city, sizeMetric));
    const colorMin = Math.min(...colorValues);
    const colorMax = Math.max(...colorValues);
    const sizeMin = Math.min(...sizeValues);
    const sizeMax = Math.max(...sizeValues);

    for (const city of visible) {
      const coordinates = city.coordinates;
      if (!coordinates) continue;

      const color = interpolateColor(metricValue(city, colorMetric), colorMin, colorMax);
      const sizeRaw = sizeValue(city, sizeMetric);
      const radius = sizeMetric === "fixed" ? 7 : 5 + clamp((sizeRaw - sizeMin) / (sizeMax - sizeMin || 1), 0, 1) * 10;
      const active = city.id === activeCityId;

      const marker = L.marker(coordinates, {
        icon: L.divIcon({
          className: "map-dot-icon",
          html: markerHtml(city, color, active ? radius + 3 : radius, active),
          iconSize: [0, 0],
        }),
        keyboard: true,
        title: `${city.name} (${city.provinceCode})`,
      });

      marker.on("click", () => onSelectRef.current(city.id));
      marker.bindTooltip(
        `<strong>${city.name}</strong> (${city.provinceCode})<br/>#${city.rank} - indice ${city.totalScore.toFixed(1)}`,
        { direction: "top", offset: [0, -8], opacity: 0.92 },
      );
      marker.addTo(layer);
    }
  }, [activeCityId, cities, colorMetric, sizeMetric]);

  useEffect(() => {
    const activeCity = cities.find((city) => city.id === activeCityId);
    if (activeCity?.coordinates && mapRef.current) {
      mapRef.current.panTo(activeCity.coordinates, { animate: true, duration: 0.45 });
    }
  }, [activeCityId, cities]);

  return <div ref={containerRef} className="h-[420px] md:h-[560px] w-full rounded-2xl overflow-hidden border border-[#bdc9c7] bg-[#e4f7ff]" />;
}
