import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { assetPath, METRICS } from "../data";
import { CityData, MetricKey } from "../types";

interface ItalyDotMapProps {
  cities: CityData[];
  activeCityId: string;
  colorMetric: MetricKey;
  focusCityIds: Set<string>;
  onSelectCity: (cityId: string) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function metricValue(city: CityData, metric: MetricKey): number {
  return city[metric];
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

function mix(hexA: string, hexB: string, amount: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

function metricColor(metric: MetricKey): string {
  return METRICS.find((item) => item.id === metric)?.color || "#315e7d";
}

function interpolateMetricColor(value: number, metric: MetricKey): string {
  const high = metricColor(metric);
  const stops = [
    { value: 80, color: "#b3261e" },
    { value: 92, color: "#d9822b" },
    { value: 100, color: "#d9a441" },
    { value: 108, color: mix("#d9a441", high, 0.72) },
    { value: 122, color: high },
  ];

  const clamped = clamp(value, stops[0].value, stops[stops.length - 1].value);
  const upperIndex = stops.findIndex((stop) => clamped <= stop.value);
  if (upperIndex <= 0) return stops[0].color;

  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const t = (clamped - lower.value) / (upper.value - lower.value || 1);
  return mix(lower.color, upper.color, t);
}

function markerHtml(city: CityData, color: string, radius: number, active: boolean, focused: boolean): string {
  const size = radius * 2;
  const topRank = city.rank <= 5 && focused;
  const label = topRank ? String(city.rank) : "";
  const fontSize = topRank ? Math.max(10, Math.min(13, radius * 0.9)) : 0;
  const opacity = focused ? (active ? 1 : 0.86) : 0.18;

  return `<button class="map-dot ${active ? "is-active" : ""}" style="
    width:${size}px;
    height:${size}px;
    background:${color};
    border-color:${active ? "#031f27" : "rgba(255,255,255,0.96)"};
    box-shadow:${active ? "0 0 0 5px rgba(0,96,91,0.18)" : focused ? "0 2px 7px rgba(3,31,39,0.2)" : "none"};
    font-size:${fontSize}px;
    opacity:${opacity};
  " aria-label="${city.name}, posizione ${city.rank}">${label}</button>`;
}

export default function ItalyDotMap({
  cities,
  activeCityId,
  colorMetric,
  focusCityIds,
  onSelectCity,
}: ItalyDotMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const initialFitDoneRef = useRef(false);
  const lastActiveCityIdRef = useRef(activeCityId);
  const onSelectRef = useRef(onSelectCity);
  onSelectRef.current = onSelectCity;

  const allCityBounds = useMemo(() => {
    const coordinates = cities.flatMap((city) => (city.coordinates ? [city.coordinates] : []));
    return coordinates.length ? L.latLngBounds(coordinates) : null;
  }, [cities]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: true,
      boxZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      touchZoom: true,
      zoomControl: false,
      zoomSnap: 0.25,
    }).setView([42.6, 12.6], 5.4);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    fetch(assetPath("data/limits_IT_regions.geojson"))
      .then((response) => (response.ok ? response.json() : null))
      .then((geojson) => {
        if (!geojson || !mapRef.current) return;
        boundaryLayerRef.current = L.geoJSON(geojson, {
          interactive: false,
          style: {
            color: "#17313a",
            fillOpacity: 0,
            opacity: 0.28,
            weight: 1.1,
          },
        }).addTo(mapRef.current);
        boundaryLayerRef.current.bringToBack();
      })
      .catch(() => {
        // Boundaries are contextual only; the point map remains usable without them.
      });

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !allCityBounds || initialFitDoneRef.current) return;
    initialFitDoneRef.current = true;
    map.fitBounds(allCityBounds, { padding: [26, 26], maxZoom: 6.2, animate: false });
  }, [allCityBounds]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const validCities = cities.filter((city) => city.coordinates);

    for (const city of validCities) {
      const coordinates = city.coordinates;
      if (!coordinates) continue;

      const focused = focusCityIds.has(city.id);
      const active = city.id === activeCityId;
      const color = focused ? interpolateMetricColor(metricValue(city, colorMetric), colorMetric) : "#7d8987";
      const radius = city.rank <= 5 && focused ? 10 : 5.2;

      const marker = L.marker(coordinates, {
        icon: L.divIcon({
          className: "map-dot-icon",
          html: markerHtml(city, color, active ? radius + 3 : radius, active, focused),
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
  }, [activeCityId, cities, colorMetric, focusCityIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastActiveCityIdRef.current === activeCityId) return;
    lastActiveCityIdRef.current = activeCityId;

    const activeCity = cities.find((city) => city.id === activeCityId);
    if (activeCity?.coordinates) {
      map.flyTo(activeCity.coordinates, Math.max(map.getZoom(), 7.2), { duration: 0.45 });
    }
  }, [activeCityId, cities]);

  return <div ref={containerRef} className="h-[460px] md:h-[640px] w-full rounded-2xl overflow-hidden border border-[#bdc9c7] bg-[#eef3f1]" />;
}
