import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRightLeft,
  ArrowUpAZ,
  Building2,
  GraduationCap,
  Layers,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { assetPath, SCORE_LEVELS } from "../data";
import {
  actualValue as localizedActualValue,
  formatNumber,
  metricsFor,
  statusLabel,
  strongestMetricLabel,
} from "../i18n";
import { CityData, Language, MetricKey, SchoolData, ViewType } from "../types";
import ItalyDotMap from "./ItalyDotMap";

interface ExplorerViewProps {
  language: Language;
  setView: (view: ViewType) => void;
  setSelectedCompareCity: (cityName: string, target: "A" | "B") => void;
  citiesData: CityData[];
  activeCityId: string | null;
  setActiveCityId: (cityId: string) => void;
}

type SortDirection = "asc" | "desc";
type SchoolSortField = "scuola" | "diplomati" | "uniScore" | "lavScore";

let indirizziCache: Record<string, SchoolData[]> | null = null;

const EXPLORER_COPY = {
  it: {
    title: "Esplora i comuni",
    intro:
      "Cerca un comune e scegli quale parte dell'indice leggere. Ogni dimensione mostra sia il punteggio usato per la classifica sia il valore reale da cui parte il confronto.",
    dimensionTitle: "Cosa vuoi guardare?",
    dimensionIntro:
      "L'indice complessivo e le cinque dimensioni spiegano da dove arriva il risultato del comune. Selezionane una per aggiornare mappa, legenda e lettura della scheda.",
    searchLabel: "Cerca comune",
    searchPlaceholder: "Cerca tra i comuni inclusi, es.",
    clearSearch: "Cancella ricerca",
    noMunicipality: "Nessun comune trovato con i filtri attivi.",
    region: "Regione",
    level: "Fascia",
    allRegions: "Tutte",
    allLevels: "Tutti",
    mapScale: "Scala della mappa",
    mapText: "La scala va dai risultati più bassi ai risultati più alti nella dimensione selezionata.",
    distribution: "Distribuzione geografica",
    highlighted: "Sono evidenziati",
    onTotal: "comuni su",
    background: "gli altri restano sullo sfondo.",
    schoolsTitle: "Scuole incluse a",
    schoolsText:
      "Indirizzi di scuola secondaria di II grado presenti in Eduscopio e usati per l'aggregazione comunale.",
    schoolPlaceholder: "Cerca scuola o indirizzo",
    loadingSchools: "Caricamento delle scuole...",
    noSchools: "Nessuna scuola corrisponde alla ricerca nel comune di",
    school: "Istituto",
    track: "Indirizzo",
    graduates: "Diplomati",
    uniFga: "FGA università",
    workFga: "FGA lavoro",
    index: "Indice",
    report: "Pagella del comune",
    quick: "Lettura rapida",
    strongest: "Punto più forte",
    workCoverageBefore: "I dati lavoro coprono il",
    workCoverageAfter: "% dei diplomati considerati.",
    compare: "Confronta questo comune",
    chosenMunicipality: "Nel comune scelto",
    points: "punti",
  },
  en: {
    title: "Explore municipalities",
    intro:
      "Search for a municipality and choose which part of the index to read. Each dimension shows both the ranking score and the real value behind the comparison.",
    dimensionTitle: "What do you want to inspect?",
    dimensionIntro:
      "The overall index and five dimensions explain where the municipal result comes from. Select one to update the map, legend and report card.",
    searchLabel: "Search municipality",
    searchPlaceholder: "Search covered municipalities, e.g.",
    clearSearch: "Clear search",
    noMunicipality: "No municipality matches the active filters.",
    region: "Region",
    level: "Level",
    allRegions: "All",
    allLevels: "All",
    mapScale: "Map scale",
    mapText: "The scale runs from the lowest to the highest results in the selected dimension.",
    distribution: "Geographic distribution",
    highlighted: "Highlighted:",
    onTotal: "municipalities out of",
    background: "the others remain in the background.",
    schoolsTitle: "Schools included in",
    schoolsText:
      "Upper-secondary school tracks found in Eduscopio and used for the municipal aggregation.",
    schoolPlaceholder: "Search school or track",
    loadingSchools: "Loading schools...",
    noSchools: "No school matches the search in",
    school: "School",
    track: "Track",
    graduates: "Graduates",
    uniFga: "University FGA",
    workFga: "Employment FGA",
    index: "Index",
    report: "Municipality report card",
    quick: "Quick reading",
    strongest: "Strongest point",
    workCoverageBefore: "Employment data cover",
    workCoverageAfter: "% of considered graduates.",
    compare: "Compare this municipality",
    chosenMunicipality: "Selected municipality",
    points: "points",
  },
} as const;

const formatDelta = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
const formatScore = (value: number) => value.toFixed(2);

function metricScore(city: CityData, metric: MetricKey): number {
  return city[metric];
}

function metricDelta(city: CityData, metric: MetricKey): number | null {
  if (metric === "totalScore") return city.totalScore - 100;
  return city.deltas[metric];
}

function metricLegendValue(value: number, metric: MetricKey, language: Language): string {
  if (metric === "totalScore") return language === "it" ? `${value.toFixed(1)} punti` : `${value.toFixed(1)} points`;
  return language === "it" ? `${formatDelta(value - 100)} punti indice` : `${formatDelta(value - 100)} index points`;
}

function progressWidth(score: number): string {
  return `${Math.min(100, Math.max(5, ((score - 80) / 42) * 100))}%`;
}

function schoolSortValue(school: SchoolData, field: SchoolSortField): string | number | null {
  if (field === "scuola") return school.scuola;
  return school[field];
}

export default function ExplorerView({
  language,
  setView,
  setSelectedCompareCity,
  citiesData,
  activeCityId,
  setActiveCityId,
}: ExplorerViewProps) {
  const copy = EXPLORER_COPY[language];
  const metrics = metricsFor(language);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  const [selectedRegion, setSelectedRegion] = useState("Tutte");
  const [selectedStatus, setSelectedStatus] = useState("Tutti");
  const [colorMetric, setColorMetric] = useState<MetricKey>("totalScore");
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");
  const [schoolSort, setSchoolSort] = useState<{ field: SchoolSortField; direction: SortDirection }>({
    field: "diplomati",
    direction: "desc",
  });

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedRegion(copy.allRegions);
    setSelectedStatus(copy.allLevels);
  }, [copy.allLevels, copy.allRegions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setHighlightedSuggestion(0);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const regions = useMemo(() => [copy.allRegions, ...Array.from(new Set(citiesData.map((c) => c.region))).sort()], [citiesData, copy.allRegions]);
  const statuses = useMemo(() => [copy.allLevels, ...Array.from(new Set(citiesData.map((c) => c.status)))], [citiesData, copy.allLevels]);

  const focusCities = useMemo(() => {
    return citiesData.filter((city) => {
      const matchesRegion = selectedRegion === copy.allRegions || city.region === selectedRegion;
      const matchesStatus = selectedStatus === copy.allLevels || city.status === selectedStatus;
      return matchesRegion && matchesStatus;
    });
  }, [citiesData, selectedRegion, selectedStatus]);

  const focusCityIds = useMemo(() => new Set(focusCities.map((city) => city.id)), [focusCities]);
  const activeMetric = metrics.find((metric) => metric.id === colorMetric) || metrics[0];

  const activeCity = useMemo(() => {
    return citiesData.find((city) => city.id === activeCityId) || focusCities[0] || citiesData[0];
  }, [activeCityId, citiesData, focusCities]);

  useEffect(() => {
    if (!focusCities.length) return;
    if (!activeCity || !focusCityIds.has(activeCity.id)) {
      setActiveCityId(focusCities[0].id);
    }
  }, [activeCity, focusCities, focusCityIds, setActiveCityId]);

  useEffect(() => {
    if (activeCity && activeCity.id !== activeCityId) {
      setActiveCityId(activeCity.id);
    }
  }, [activeCity, activeCityId, setActiveCityId]);

  const searchMatches = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const pool = focusCities.length ? focusCities : citiesData;
    const matches = query
      ? pool.filter((city) => (
          city.name.toLowerCase().includes(query) ||
          city.province.toLowerCase().includes(query) ||
          city.provinceCode.toLowerCase().includes(query) ||
          city.region.toLowerCase().includes(query)
        ))
      : pool;

    return matches.slice(0, 8);
  }, [citiesData, focusCities, searchQuery]);

  useEffect(() => {
    setHighlightedSuggestion(0);
  }, [searchQuery, selectedRegion, selectedStatus]);

  useEffect(() => {
    async function fetchSchools() {
      if (!activeCity) return;
      setSchoolsLoading(true);
      try {
        if (!indirizziCache) {
          const res = await fetch(assetPath("data/indirizzi-comuni.json"));
          if (!res.ok) throw new Error("Errore nel caricamento degli indirizzi scolastici");
          indirizziCache = await res.json();
        }
        setSchools(indirizziCache?.[activeCity.id] || []);
      } catch (err) {
        console.error("Errore caricamento scuole:", err);
        setSchools([]);
      } finally {
        setSchoolsLoading(false);
      }
    }

    fetchSchools();
    setSchoolSearchQuery("");
  }, [activeCity]);

  const metricExtent = useMemo(() => {
    const values = (focusCities.length ? focusCities : citiesData).map((city) => metricScore(city, colorMetric));
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [citiesData, colorMetric, focusCities]);

  const filteredSchools = useMemo(() => {
    const query = schoolSearchQuery.toLowerCase();
    const filtered = schools.filter((school) => (
      school.scuola.toLowerCase().includes(query) ||
      school.indirizzo.toLowerCase().includes(query) ||
      school.codice.toLowerCase().includes(query)
    ));

    return [...filtered].sort((a, b) => {
      const aValue = schoolSortValue(a, schoolSort.field);
      const bValue = schoolSortValue(b, schoolSort.field);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const base = typeof aValue === "string"
        ? aValue.localeCompare(String(bValue), "it")
        : Number(aValue) - Number(bValue);

      return schoolSort.direction === "asc" ? base : -base;
    });
  }, [schoolSearchQuery, schoolSort, schools]);

  const pickCity = (city: CityData) => {
    setActiveCityId(city.id);
    setSearchQuery("");
    setSearchOpen(false);
    setHighlightedSuggestion(0);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchMatches.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedSuggestion((current) => Math.min(searchMatches.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedSuggestion((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pickCity(searchMatches[highlightedSuggestion] || searchMatches[0]);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
      setHighlightedSuggestion(0);
    }
  };

  const handleSchoolSort = (field: SchoolSortField) => {
    setSchoolSort((current) => ({
      field,
      direction: current.field === field && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleQuickCompare = () => {
    setSelectedCompareCity(activeCity.name, "A");
    const secondCity = citiesData.find((city) => city.id !== activeCity.id) || citiesData[1];
    setSelectedCompareCity(secondCity.name, "B");
    setView("comparison");
  };

  const getStatusBadge = (status: string) => {
    const found = SCORE_LEVELS.find((s) => s.label === status);
    return found ? found.badgeColor : "bg-gray-500 text-white";
  };

  const highlightedLegend = Number.isFinite(metricExtent.min) && Number.isFinite(metricExtent.max);

  return (
    <div className="space-y-8 animate-entrance">
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-extrabold text-[#031f27]">
          {copy.title}
        </h1>
        <p className="font-sans text-sm text-[#3e4947] max-w-3xl leading-relaxed">
          {copy.intro}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <section className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-5 md:p-6 space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-sans text-xl font-extrabold text-[#031f27]">
                  {copy.dimensionTitle}
                </h2>
                <p className="font-sans text-xs text-[#3e4947] leading-relaxed max-w-2xl">
                  {copy.dimensionIntro}
                </p>
              </div>
            </div>

            <DimensionCards
              activeCity={activeCity}
              activeMetric={colorMetric}
              language={language}
              metrics={metrics}
              copy={copy}
              onSelectMetric={setColorMetric}
            />

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
              <div ref={searchContainerRef} className="relative">
                <label htmlFor="city-search" className="text-[10px] uppercase font-mono font-bold text-[#3e4947] block mb-1">
                  {copy.searchLabel}
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#3e4947] opacity-70" />
                  <input
                    id="city-search"
                    type="text"
                    placeholder={`${copy.searchPlaceholder} ${activeCity?.name || "Merate"}`}
                    value={searchQuery}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#f7fbfb] rounded-xl border border-[#bdc9c7]/70 text-sm font-sans placeholder-[#6e7978] focus:outline-none focus:ring-2 focus:ring-[#00605b]/20 focus:border-[#00605b]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label={copy.clearSearch}
                      onClick={() => {
                        setSearchQuery("");
                        setSearchOpen(true);
                      }}
                      className="absolute right-3 top-2.5 p-1 rounded-full hover:bg-white text-[#3e4947] opacity-70 hover:opacity-100 transition-all border-none bg-transparent cursor-pointer flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {searchOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-[#bdc9c7]/70 rounded-xl shadow-2xl z-[1000] max-h-72 overflow-y-auto p-1">
                      {!searchMatches.length ? (
                        <div className="p-3 text-xs text-[#3e4947] opacity-70 text-center">
                          {copy.noMunicipality}
                        </div>
                      ) : (
                        searchMatches.map((city, index) => {
                          const highlighted = index === highlightedSuggestion;
                          return (
                            <button
                              key={city.id}
                              type="button"
                              onMouseEnter={() => setHighlightedSuggestion(index)}
                              onClick={() => pickCity(city)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex justify-between items-center gap-3 text-xs font-sans cursor-pointer border-none ${
                                highlighted ? "bg-[#f2fbff]" : "bg-transparent hover:bg-[#f2fbff]/70"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="font-mono text-[10px] text-[#6e7978] mr-2">#{city.rank}</span>
                                <strong className="text-[#031f27]">{city.name}</strong>
                                <span className="text-[#3e4947]/75"> ({city.provinceCode}) - {city.region}</span>
                              </span>
                              <span className="font-mono font-bold text-[#00605b] shrink-0">{city.totalScore.toFixed(1)}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:min-w-[310px]">
                <Select label={copy.region} value={selectedRegion} onChange={setSelectedRegion} options={regions} language={language} />
                <Select label={copy.level} value={selectedStatus} onChange={setSelectedStatus} options={statuses} language={language} />
              </div>
            </div>

            <ItalyDotMap
              cities={citiesData}
              activeCityId={activeCity.id}
              colorMetric={colorMetric}
              focusCityIds={focusCityIds}
              language={language}
              onSelectCity={setActiveCityId}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 pt-3 border-t border-[#bdc9c7]/25 items-start">
              <div className="xl:col-span-8 space-y-1">
                <h3 className="font-sans text-base font-extrabold text-[#031f27]">
                  {copy.distribution}: {activeMetric.label}
                </h3>
                <p className="font-sans text-xs text-[#3e4947] leading-relaxed max-w-2xl">
                  {activeMetric.description} {copy.highlighted} {formatNumber(focusCities.length, language)} {copy.onTotal} {formatNumber(citiesData.length, language)}; {copy.background}
                </p>
              </div>

              <div className="xl:col-span-4 rounded-xl border border-[#bdc9c7]/50 bg-[#f7fbfb] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase font-mono font-bold text-[#3e4947]">{copy.mapScale}</p>
                  <p className="text-[10px] font-mono text-[#6e7978]">{activeMetric.shortLabel}</p>
                </div>
                <div
                  className="h-3 rounded-full border border-white shadow-inner"
                  style={{
                    background: `linear-gradient(90deg, #b3261e 0%, #d9822b 28%, #d9a441 50%, ${activeMetric.color} 100%)`,
                  }}
                />
                <div className="flex justify-between gap-3 text-[10px] font-mono text-[#3e4947]">
                  <span>{highlightedLegend ? metricLegendValue(metricExtent.min, colorMetric, language) : "n.d."}</span>
                  <span className="text-right">{highlightedLegend ? metricLegendValue(metricExtent.max, colorMetric, language) : "n.d."}</span>
                </div>
                <p className="font-sans text-[11px] text-[#3e4947] leading-relaxed">
                  {copy.mapText}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-sans font-extrabold text-lg text-[#031f27] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#00605b]" />
                  {copy.schoolsTitle} {activeCity.name}
                </h3>
                <p className="text-xs text-[#3e4947] opacity-80 mt-0.5">
                  {copy.schoolsText}
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#3e4947] opacity-70" />
                <input
                  type="text"
                  placeholder={copy.schoolPlaceholder}
                  value={schoolSearchQuery}
                  onChange={(event) => setSchoolSearchQuery(event.target.value)}
                  className="w-full pl-8 pr-4 py-1.5 bg-[#f7fbfb] rounded-lg border border-[#bdc9c7]/60 text-xs font-sans placeholder-[#6e7978] focus:outline-none focus:ring-2 focus:ring-[#00605b]/20 focus:border-[#00605b]"
                />
              </div>
            </div>

            {schoolsLoading ? (
              <div className="py-16 text-center text-xs font-sans text-[#3e4947]/70 animate-pulse">{copy.loadingSchools}</div>
            ) : filteredSchools.length === 0 ? (
              <div className="py-8 text-center text-xs font-sans text-[#3e4947] opacity-70 border border-dashed border-[#bdc9c7] rounded-xl">
                {copy.noSchools} {activeCity.name}.
              </div>
            ) : (
              <div className="bg-[#f7fbfb]/70 rounded-xl border border-[#bdc9c7]/50 overflow-hidden">
                <div className="max-h-[430px] overflow-y-auto overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs font-sans responsive-table">
                    <thead className="sticky top-0 bg-[#f2fbff] border-b border-[#bdc9c7]/60 text-[9px] font-mono uppercase text-[#3e4947] z-10">
                      <tr>
                        <th className="py-3 px-4 w-[34%]">
                          <SortHeader label={copy.school} field="scuola" activeSort={schoolSort} onSort={handleSchoolSort} />
                        </th>
                        <th className="py-3 px-4 w-[28%]">{copy.track}</th>
                        <th className="py-3 px-4 text-center">
                          <SortHeader label={copy.graduates} field="diplomati" activeSort={schoolSort} onSort={handleSchoolSort} align="center" />
                        </th>
                        <th className="py-3 px-4 text-center">
                          <SortHeader label={copy.uniFga} field="uniScore" activeSort={schoolSort} onSort={handleSchoolSort} align="center" />
                        </th>
                        <th className="py-3 px-4 text-center">
                          <SortHeader label={copy.workFga} field="lavScore" activeSort={schoolSort} onSort={handleSchoolSort} align="center" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#bdc9c7]/20">
                      {filteredSchools.map((school, index) => (
                        <tr key={`${school.codice}-${school.indirizzo}-${index}`} className="hover:bg-white transition-colors align-middle">
                          <td className="py-3 px-4" data-label={copy.school}>
                            <p className="font-bold text-[#031f27]">{school.scuola}</p>
                            <span className="font-mono text-[9px] text-[#6e7978]">{school.codice}</span>
                          </td>
                          <td className="py-3 px-4 text-[#3e4947]" data-label={copy.track}>{school.indirizzo}</td>
                          <td className="py-3 px-4 text-center font-mono text-[#031f27]" data-label={copy.graduates}>
                            {school.diplomati > 0 ? school.diplomati : "-"}
                          </td>
                          <td className="py-3 px-4 text-center font-mono" data-label={copy.uniFga}>
                            {school.uniScore !== null ? <span className="font-bold text-[#2563eb]">{school.uniScore.toFixed(1)}</span> : <span className="text-[#6e7978] opacity-60">-</span>}
                          </td>
                          <td className="py-3 px-4 text-center font-mono" data-label={copy.workFga}>
                            {school.lavScore !== null ? <span className="font-bold text-[#7c3aed]">{school.lavScore.toFixed(1)}</span> : <span className="text-[#6e7978] opacity-60">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-24">
          <section className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-[#bdc9c7]/40 bg-[#f2fbff]/60">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 bg-[#00605b]/10 rounded-xl flex items-center justify-center text-[#00605b] shadow-sm shrink-0 border border-[#00605b]/20">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-sans text-2xl font-bold text-[#031f27] truncate">{activeCity.name}</h2>
                    <p className="text-xs font-sans text-[#3e4947] truncate">
                      {activeCity.province} ({activeCity.provinceCode}) - {activeCity.region}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase shrink-0 ${getStatusBadge(activeCity.status)}`}>
                  {statusLabel(activeCity.status, language)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                <SummaryStat label="Rank" value={`#${activeCity.rank}`} />
                <SummaryStat label={copy.index} value={activeCity.totalScore.toFixed(2)} />
                <SummaryStat label={copy.graduates} value={formatNumber(activeCity.details.diplomati, language)} />
              </div>
            </div>

            <div className="p-5 md:p-6 space-y-5">
              <div>
                <h3 className="font-sans font-bold text-xs uppercase text-[#031f27] flex items-center gap-1.5 mb-3">
                  <Layers className="w-4 h-4 text-[#3e4947]" />
                  {copy.report}
                </h3>
                <div className="space-y-3.5">
                  {metrics.filter((metric) => metric.id !== "totalScore").map((metric) => {
                    const score = metricScore(activeCity, metric.id);
                    const delta = metricDelta(activeCity, metric.id) ?? 0;
                    return (
                      <div
                        key={metric.id}
                        className="rounded-xl border p-3.5"
                        style={{ backgroundColor: metric.surface, borderColor: metric.border }}
                      >
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-sans text-xs font-extrabold text-[#031f27] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: metric.color }} />
                              {metric.shortLabel}
                              <span
                                className="text-[9px] font-mono font-normal border px-1.5 py-0.5 rounded ml-1 shrink-0"
                                style={{ backgroundColor: "#fff", borderColor: metric.border, color: metric.color }}
                              >
                                {metric.weight}
                              </span>
                            </p>
                            <p className="font-sans text-[11px] text-[#3e4947] mt-1.5 leading-tight">{metric.description}</p>
                            <p className="font-sans text-[11px] text-[#031f27] mt-1 font-bold">{localizedActualValue(activeCity, metric.id, language)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm font-black" style={{ color: metric.color }}>{formatScore(score)}</p>
                            <p className="font-mono text-[10px] font-bold text-[#3e4947]/90 mt-0.5">{formatDelta(delta)} {copy.points}</p>
                          </div>
                        </div>
                        <div className="mt-3.5 h-1.5 bg-white rounded-full overflow-hidden border border-white/80 relative">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: progressWidth(score),
                              backgroundColor: metric.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-[#fff7e6] border border-[#f0d79b]/70 rounded-xl space-y-1">
                <h4 className="font-sans font-bold text-xs text-[#031f27]">{copy.quick}</h4>
                <p className="font-sans text-[11px] text-[#3e4947] leading-relaxed">
                  {copy.strongest}: <strong className="text-[#00605b] font-bold">{strongestMetricLabel(activeCity, language)}</strong>.
                  {copy.workCoverageBefore} {activeCity.details.workCoverage.toFixed(1)}{copy.workCoverageAfter}
                </p>
              </div>

              <button
                type="button"
                onClick={handleQuickCompare}
                className="w-full py-3 px-4 bg-[#2563eb] hover:bg-[#0e7490] text-white font-mono text-[10px] uppercase font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 hover:shadow-md"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {copy.compare}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  language,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  language: Language;
}) {
  return (
    <div className="min-w-0">
      <label className="text-[10px] uppercase font-mono font-bold text-[#3e4947] block mb-1">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-[#f7fbfb] border border-[#bdc9c7]/70 rounded-xl px-3 py-2.5 text-xs font-sans text-[#3e4947] focus:outline-none focus:ring-2 focus:ring-[#00605b]/20 focus:border-[#00605b] hover:border-[#00605b] transition-all cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option}>{statusLabel(option, language)}</option>
        ))}
      </select>
    </div>
  );
}

function DimensionCards({
  activeCity,
  activeMetric,
  language,
  metrics,
  copy,
  onSelectMetric,
}: {
  activeCity: CityData;
  activeMetric: MetricKey;
  language: Language;
  metrics: ReturnType<typeof metricsFor>;
  copy: (typeof EXPLORER_COPY)[Language];
  onSelectMetric: (value: MetricKey) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
      {metrics.map((metric) => {
        const active = metric.id === activeMetric;
        const score = metricScore(activeCity, metric.id);
        const delta = metricDelta(activeCity, metric.id);

        return (
          <button
            key={metric.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectMetric(metric.id)}
            className="group relative overflow-hidden text-left rounded-xl border p-4 transition-all cursor-pointer hover:-translate-y-0.5"
            style={{
              background: active ? `linear-gradient(135deg, ${metric.surface} 0%, #ffffff 64%)` : "#ffffff",
              borderColor: active ? metric.color : metric.border,
              boxShadow: active ? `0 0 0 2px ${metric.color}, 0 16px 34px rgba(3,31,39,0.08)` : "0 8px 18px rgba(3,31,39,0.035)",
            }}
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: metric.color }} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-sm font-extrabold text-[#031f27] flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm"
                    style={{ backgroundColor: metric.color }}
                  />
                  {metric.label}
                </p>
                <p className="font-sans text-[11px] text-[#3e4947] leading-relaxed mt-1.5">
                  {metric.description}
                </p>
              </div>
              <span
                className="font-mono text-[10px] font-bold px-2 py-1 rounded shrink-0 border"
                style={{ backgroundColor: metric.surface, borderColor: metric.border, color: metric.color }}
              >
                {metric.weight}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#bdc9c7]/25 pt-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase text-[#6e7978]">{copy.chosenMunicipality}</p>
                <p className="font-sans text-[11px] font-bold text-[#031f27] mt-0.5">{localizedActualValue(activeCity, metric.id, language)}</p>
              </div>
              <div
                className="text-right shrink-0 rounded-lg px-2.5 py-1.5 border"
                style={{ backgroundColor: metric.surface, borderColor: metric.border }}
              >
                <p className="font-mono text-base font-black" style={{ color: metric.color }}>
                  {score.toFixed(1)}
                </p>
                {delta !== null && (
                  <p className="font-mono text-[10px] font-bold text-[#3e4947]">{formatDelta(delta)}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SortHeader({
  label,
  field,
  activeSort,
  onSort,
  align = "left",
}: {
  label: string;
  field: SchoolSortField;
  activeSort: { field: SchoolSortField; direction: SortDirection };
  onSort: (field: SchoolSortField) => void;
  align?: "left" | "center";
}) {
  const active = activeSort.field === field;
  const Icon = activeSort.direction === "asc" ? ArrowUpAZ : ArrowDownAZ;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 border-none bg-transparent p-0 font-mono text-[9px] uppercase font-bold text-[#3e4947] hover:text-[#00605b] cursor-pointer ${
        align === "center" ? "justify-center w-full" : ""
      }`}
    >
      {label}
      {active && <Icon className="w-3 h-3" />}
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#bdc9c7]/50 rounded-xl p-3 flex-1 min-w-0">
      <p className="font-mono text-[9px] text-[#6e7978] uppercase font-bold">{label}</p>
      <p className="font-mono text-base font-black text-[#031f27] mt-1 flex items-center gap-1 truncate">
        {(label === "Diplomati" || label === "Graduates") && <GraduationCap className="w-4 h-4 text-[#00605b] shrink-0" />}
        {value}
      </p>
    </div>
  );
}
