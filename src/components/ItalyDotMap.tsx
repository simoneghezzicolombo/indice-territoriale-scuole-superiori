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
const COLOR_STOPS = [
  { value: 80, color: "#b3261e" },
  { value: 92, color: "#d9822b" },
  { value: 100, color: "#d9a441" },
  { value: 108, color: "#177a74" },
  { value: 122, color: "#315e7d" },
];

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

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function interpolateColor(value: number): string {
  const clamped = clamp(value, COLOR_STOPS[0].value, COLOR_STOPS[COLOR_STOPS.length - 1].value);
  const upperIndex = COLOR_STOPS.findIndex((stop) => clamped <= stop.value);
  if (upperIndex <= 0) return COLOR_STOPS[0].color;

  const lower = COLOR_STOPS[upperIndex - 1];
  const upper = COLOR_STOPS[upperIndex];
  const t = (clamped - lower.value) / (upper.value - lower.value || 1);
  const lowerRgb = hexToRgb(lower.color);
  const upperRgb = hexToRgb(upper.color);

  return rgbToHex([
    lowerRgb[0] + (upperRgb[0] - lowerRgb[0]) * t,
    lowerRgb[1] + (upperRgb[1] - lowerRgb[1]) * t,
    lowerRgb[2] + (upperRgb[2] - lowerRgb[2]) * t,
  ]);
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
    opacity:${active ? 1 : 0.9};
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
  const fittedCitiesRef = useRef("");
  const onSelectRef = useRef(onSelectCity);
  onSelectRef.current = onSelectCity;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([42.6, 12.6], 5.7);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
    const sizeValues = visible.map((city) => sizeValue(city, sizeMetric));
    const sizeMin = Math.min(...sizeValues);
    const sizeMax = Math.max(...sizeValues);

    for (const city of visible) {
      const coordinates = city.coordinates;
      if (!coordinates) continue;

      const color = interpolateColor(metricValue(city, colorMetric));
      const sizeRaw = sizeValue(city, sizeMetric);
      const scaledRadius = sizeMetric === "fixed" ? 6 : 5 + clamp((sizeRaw - sizeMin) / (sizeMax - sizeMin || 1), 0, 1) * 6;
      const radius = city.rank <= 5 ? Math.max(10, scaledRadius) : scaledRadius;
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

    const fitKey = visible.map((city) => city.id).join("|");
    if (visible.length && fitKey !== fittedCitiesRef.current) {
      fittedCitiesRef.current = fitKey;
      if (visible.length === 1 && visible[0].coordinates) {
        map.setView(visible[0].coordinates, 9, { animate: true });
      } else {
        const bounds = L.latLngBounds(visible.map((city) => city.coordinates as [number, number]));
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7, animate: true });
      }
    }
  }, [activeCityId, cities, colorMetric, sizeMetric]);

  return <div ref={containerRef} className="h-[420px] md:h-[560px] w-full rounded-2xl overflow-hidden border border-[#bdc9c7] bg-[#e4f7ff]" />;
}
