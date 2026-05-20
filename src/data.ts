import { CityData, MetricKey } from "./types";

export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\/+/, "")}`;
}

const safeNumber = (value: unknown, fallback = 0): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

export async function loadCitiesData(): Promise<CityData[]> {
  try {
    const [indexResponse, pointsResponse] = await Promise.all([
      fetch(assetPath("data/indice-comuni.json")),
      fetch(assetPath("data/comuni-points.geojson")),
    ]);

    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch municipal data: ${indexResponse.statusText}`);
    }

    const data = await indexResponse.json();
    const points = pointsResponse.ok ? await pointsResponse.json() : { features: [] };
    const coordinatesById = new Map<string, [number, number]>();

    for (const feature of points.features || []) {
      const id = feature?.properties?.id;
      const coordinates = feature?.geometry?.coordinates;
      if (id && Array.isArray(coordinates) && coordinates.length >= 2) {
        coordinatesById.set(id, [coordinates[1], coordinates[0]]);
      }
    }

    const comuni = data.comuni || [];
    const mapped: CityData[] = comuni.map((c: any) => {
      const deltas = {
        invalsi: safeNumber(c.docente),
        uniResults: safeNumber(c.eduscopioUni),
        workOutcomes: safeNumber(c.lavoroCopertura),
        uniAccess: safeNumber(c.immatricolazione),
        continuity: safeNumber(c.continuita),
      };

      const strengths = [
        { value: deltas.invalsi, label: "apprendimenti rilevati dalle prove nazionali" },
        { value: deltas.uniResults, label: "rendimento universitario degli ex studenti" },
        { value: deltas.workOutcomes, label: "ingresso nel lavoro dei diplomati tecnici e professionali" },
        { value: deltas.uniAccess, label: "passaggio all'università dopo il diploma" },
        { value: deltas.continuity, label: "tenuta del percorso universitario" },
      ].sort((a, b) => b.value - a.value)[0].label;

      const score = safeNumber(c.indice, 100);
      let status: CityData["status"] = "STABILE";
      if (score >= 110) status = "MOLTO FORTE";
      else if (score >= 103) status = "FORTE";
      else if (score >= 97) status = "STABILE";
      else if (score >= 90) status = "FRAGILE";
      else status = "MOLTO FRAGILE";

      return {
        id: c.id,
        name: c.comune,
        province: c.provincia,
        provinceCode: c.provinciaSigla,
        region: c.regione,
        rank: safeNumber(c.rank),
        totalScore: score,
        status,
        invalsi: 100 + deltas.invalsi,
        uniResults: 100 + deltas.uniResults,
        workOutcomes: 100 + deltas.workOutcomes,
        uniAccess: 100 + deltas.uniAccess,
        continuity: 100 + deltas.continuity,
        deltas,
        strengths,
        details: {
          docentePct: safeNumber(c.absolute?.docentePct),
          uniScore: safeNumber(c.absolute?.uniScore),
          lavoroScore: c.absolute?.lavoroScore ?? null,
          immatricolazionePct: safeNumber(c.absolute?.immatricolazionePct),
          continuitaPct: safeNumber(c.absolute?.continuitaPct),
          abbandonoPct: safeNumber(c.absolute?.abbandonoPct),
          diplomati: safeNumber(c.diplomati),
          schoolsCount: safeNumber(c.indirizzi),
          workCoverage: safeNumber(c.coperturaLavoro),
          reliability: safeNumber(c.affidabilita),
        },
        coordinates: coordinatesById.get(c.id) ?? null,
      };
    });

    return mapped.sort((a, b) => a.rank - b.rank);
  } catch (error) {
    console.error("Error loading municipal index data:", error);
    return [];
  }
}

export const METRICS: {
  id: MetricKey;
  label: string;
  shortLabel: string;
  weight: string;
  color: string;
  bg: string;
  description: string;
}[] = [
  {
    id: "totalScore",
    label: "Indice complessivo",
    shortLabel: "Totale",
    weight: "100%",
    color: "#17313a",
    bg: "bg-[#17313a]",
    description: "Sintesi pesata delle cinque dimensioni: apprendimenti, università, lavoro, immatricolazioni e tenuta del percorso.",
  },
  {
    id: "invalsi",
    label: "Apprendimenti",
    shortLabel: "Prove nazionali",
    weight: "35%",
    color: "#177A74",
    bg: "bg-[#177A74]",
    description: "Percentuale di studenti delle superiori che raggiunge i traguardi attesi nelle prove nazionali di italiano e matematica.",
  },
  {
    id: "uniResults",
    label: "Rendimento all'università",
    shortLabel: "Università",
    weight: "35%",
    color: "#315E7D",
    bg: "bg-[#315E7D]",
    description: "Indice Eduscopio università: combina esami sostenuti e voti ottenuti dagli ex studenti che si sono iscritti all'università.",
  },
  {
    id: "workOutcomes",
    label: "Ingresso nel lavoro",
    shortLabel: "Lavoro",
    weight: "10%",
    color: "#7C5C9E",
    bg: "bg-[#7C5C9E]",
    description: "Dato Eduscopio lavoro per tecnici e professionali: misura i primi risultati occupazionali dei diplomati, pesati per quanti diplomati sono coperti.",
  },
  {
    id: "uniAccess",
    label: "Passaggio all'università",
    shortLabel: "Immatricolati",
    weight: "10%",
    color: "#0E5A5A",
    bg: "bg-[#0E5A5A]",
    description: "Quota di diplomati che dopo la maturità si immatricola all'università.",
  },
  {
    id: "continuity",
    label: "Tenuta universitaria",
    shortLabel: "Tenuta",
    weight: "10%",
    color: "#4A6E78",
    bg: "bg-[#4A6E78]",
    description: "Quota di immatricolati che prosegue il percorso universitario dopo l'avvio, senza abbandonare subito.",
  },
];

export const SCORE_LEVELS = [
  { range: "110+", label: "MOLTO FORTE", bg: "bg-teal-50 text-teal-800 border-teal-200", badgeColor: "bg-[#177A74] text-white" },
  { range: "103-110", label: "FORTE", bg: "bg-blue-50 text-blue-800 border-blue-200", badgeColor: "bg-[#315E7D] text-white" },
  { range: "97-103", label: "STABILE", bg: "bg-neutral-50 text-neutral-800 border-neutral-200", badgeColor: "bg-[#6e7978] text-white" },
  { range: "90-97", label: "FRAGILE", bg: "bg-amber-50 text-amber-900 border-amber-200", badgeColor: "bg-[#a86400] text-white" },
  { range: "< 90", label: "MOLTO FRAGILE", bg: "bg-red-50 text-red-800 border-red-200", badgeColor: "bg-[#ba1a1a] text-white" },
];
