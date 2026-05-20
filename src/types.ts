export type MetricKey =
  | "totalScore"
  | "invalsi"
  | "uniResults"
  | "workOutcomes"
  | "uniAccess"
  | "continuity";

export interface CityDetails {
  docentePct: number;
  uniScore: number;
  lavoroScore: number | null;
  immatricolazionePct: number;
  continuitaPct: number;
  abbandonoPct: number;
  diplomati: number;
  schoolsCount: number;
  workCoverage: number;
  reliability: number;
}

export interface CityDeltas {
  invalsi: number;
  uniResults: number;
  workOutcomes: number;
  uniAccess: number;
  continuity: number;
}

export interface CityData {
  id: string;
  name: string;
  province: string;
  provinceCode: string;
  region: string;
  rank: number;
  totalScore: number;
  status: "MOLTO FORTE" | "FORTE" | "STABILE" | "FRAGILE" | "MOLTO FRAGILE";
  invalsi: number;
  uniResults: number;
  workOutcomes: number;
  uniAccess: number;
  continuity: number;
  deltas: CityDeltas;
  strengths: string;
  details: CityDetails;
  coordinates: [number, number] | null;
}

export interface SchoolData {
  scuola: string;
  codice: string;
  indirizzo: string;
  diplomati: number;
  uniScore: number | null;
  lavScore: number | null;
}

export type ViewType = "home" | "explorer" | "rankings" | "comparison" | "methodology";
