import { METRICS } from "./data";
import { CityData, Language, MetricKey } from "./types";

export const localeFor = (language: Language) => (language === "it" ? "it-IT" : "en-US");

export const UI_COPY = {
  en: {
    brandTitle: "Territorial Index",
    brandSubtitle: "Upper Secondary Schools",
    loadingTitle: "Loading the index",
    loadingText: "Reading municipal data, coordinates and school tracks covered by the sources.",
    nav: {
      home: "Home",
      explorer: "Explore",
      rankings: "Rankings",
      comparison: "Compare",
      methodology: "Method",
    },
    menuLabel: "Open menu",
    githubTitle: "GitHub repository",
    portfolioTitle: "Portfolio",
  },
  it: {
    brandTitle: "Indice Territoriale",
    brandSubtitle: "Scuole Superiori",
    loadingTitle: "Caricamento dell'indice",
    loadingText: "Lettura dei dati comunali, delle coordinate e degli indirizzi scolastici coperti.",
    nav: {
      home: "Home",
      explorer: "Esplora",
      rankings: "Classifica",
      comparison: "Confronta",
      methodology: "Metodo",
    },
    menuLabel: "Apri menu",
    githubTitle: "Repository GitHub",
    portfolioTitle: "Portfolio",
  },
} as const;

export const METRIC_COPY: Record<
  MetricKey,
  Record<Language, { label: string; shortLabel: string; description: string }>
> = {
  totalScore: {
    en: {
      label: "Overall index",
      shortLabel: "Overall",
      description:
        "Weighted summary of the five dimensions: learning outcomes, university performance, employment entry, university enrolment and university persistence.",
    },
    it: {
      label: "Indice complessivo",
      shortLabel: "Totale",
      description:
        "Sintesi pesata delle cinque dimensioni: apprendimenti, rendimento universitario, ingresso nel lavoro, immatricolazioni e tenuta del percorso.",
    },
  },
  invalsi: {
    en: {
      label: "Learning outcomes",
      shortLabel: "National tests",
      description:
        "Share of upper-secondary students reaching the expected targets in the national Italian and mathematics tests.",
    },
    it: {
      label: "Apprendimenti",
      shortLabel: "Prove nazionali",
      description:
        "Percentuale di studenti delle superiori che raggiunge i traguardi attesi nelle prove nazionali di italiano e matematica.",
    },
  },
  uniResults: {
    en: {
      label: "University performance",
      shortLabel: "University",
      description:
        "Eduscopio university score: combines exams completed and grades obtained by former students who enrolled at university.",
    },
    it: {
      label: "Rendimento all'università",
      shortLabel: "Università",
      description:
        "Indice Eduscopio università: combina esami sostenuti e voti ottenuti dagli ex studenti che si sono iscritti all'università.",
    },
  },
  workOutcomes: {
    en: {
      label: "Employment entry",
      shortLabel: "Work",
      description:
        "Eduscopio employment data for technical and vocational tracks: first labour-market outcomes, weighted by the share of graduates covered.",
    },
    it: {
      label: "Ingresso nel lavoro",
      shortLabel: "Lavoro",
      description:
        "Dato Eduscopio lavoro per tecnici e professionali: misura i primi risultati occupazionali dei diplomati, pesati per quanti diplomati sono coperti.",
    },
  },
  uniAccess: {
    en: {
      label: "University enrolment",
      shortLabel: "Enrolment",
      description: "Share of graduates who enrol at university after the final exam.",
    },
    it: {
      label: "Passaggio all'università",
      shortLabel: "Immatricolati",
      description: "Quota di diplomati che dopo la maturità si immatricola all'università.",
    },
  },
  continuity: {
    en: {
      label: "University persistence",
      shortLabel: "Persistence",
      description:
        "Share of enrolled students who continue their university path after starting, without dropping out immediately.",
    },
    it: {
      label: "Tenuta universitaria",
      shortLabel: "Tenuta",
      description:
        "Quota di immatricolati che prosegue il percorso universitario dopo l'avvio, senza abbandonare subito.",
    },
  },
};

export const STATUS_COPY: Record<Language, Record<CityData["status"], string>> = {
  en: {
    "MOLTO FORTE": "Very strong",
    FORTE: "Strong",
    STABILE: "Stable",
    FRAGILE: "Fragile",
    "MOLTO FRAGILE": "Very fragile",
  },
  it: {
    "MOLTO FORTE": "Molto forte",
    FORTE: "Forte",
    STABILE: "Stabile",
    FRAGILE: "Fragile",
    "MOLTO FRAGILE": "Molto fragile",
  },
};

export const ZONE_COPY = {
  en: { ALL: "All", NORD: "North", CENTRO: "Centre", SUD: "South and islands" },
  it: { ALL: "Tutti", NORD: "Nord", CENTRO: "Centro", SUD: "Sud e isole" },
} as const;

export function metricCopy(metric: MetricKey, language: Language) {
  return METRIC_COPY[metric][language];
}

export function metricsFor(language: Language) {
  return METRICS.map((metric) => ({
    ...metric,
    ...metricCopy(metric.id, language),
  }));
}

export function metricDefinition(metric: MetricKey, language: Language) {
  return metricsFor(language).find((item) => item.id === metric) || metricsFor(language)[0];
}

export function statusLabel(status: CityData["status"] | string, language: Language) {
  return STATUS_COPY[language][status as CityData["status"]] || status;
}

export function formatNumber(value: number, language: Language) {
  return value.toLocaleString(localeFor(language));
}

export function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function metricScore(city: CityData, metric: MetricKey): number {
  return city[metric];
}

export function metricDelta(city: CityData, metric: MetricKey): number {
  if (metric === "totalScore") return city.totalScore - 100;
  return city.deltas[metric];
}

export function actualValue(city: CityData, metric: MetricKey, language: Language): string {
  if (language === "it") {
    if (metric === "totalScore") return `${city.totalScore.toFixed(2)} punti finali`;
    if (metric === "invalsi") return `${city.details.docentePct.toFixed(1)}% studenti ai traguardi`;
    if (metric === "uniResults") return `FGA università ${city.details.uniScore.toFixed(2)}`;
    if (metric === "workOutcomes") {
      return city.details.lavoroScore === null ? "dato lavoro non disponibile" : `FGA lavoro ${city.details.lavoroScore.toFixed(2)}`;
    }
    if (metric === "uniAccess") return `${city.details.immatricolazionePct.toFixed(1)}% immatricolati`;
    return `${city.details.continuitaPct.toFixed(1)}% continuità`;
  }

  if (metric === "totalScore") return `${city.totalScore.toFixed(2)} final points`;
  if (metric === "invalsi") return `${city.details.docentePct.toFixed(1)}% at expected level`;
  if (metric === "uniResults") return `University FGA ${city.details.uniScore.toFixed(2)}`;
  if (metric === "workOutcomes") {
    return city.details.lavoroScore === null ? "employment data unavailable" : `Employment FGA ${city.details.lavoroScore.toFixed(2)}`;
  }
  if (metric === "uniAccess") return `${city.details.immatricolazionePct.toFixed(1)}% enrolled`;
  return `${city.details.continuitaPct.toFixed(1)}% persistence`;
}

export function strongestMetricLabel(city: CityData, language: Language) {
  const strongest = (["invalsi", "uniResults", "workOutcomes", "uniAccess", "continuity"] as MetricKey[])
    .map((metric) => ({ metric, value: metricDelta(city, metric) }))
    .sort((a, b) => b.value - a.value)[0];

  return metricCopy(strongest.metric, language).label.toLowerCase();
}
