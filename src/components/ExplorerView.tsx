import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Building2, GraduationCap, Layers, MapPin, Search } from "lucide-react";
import { assetPath, METRICS, SCORE_LEVELS, SIZE_METRICS } from "../data";
import { CityData, MetricKey, SchoolData, SizeMetricKey, ViewType } from "../types";
import ItalyDotMap from "./ItalyDotMap";

interface ExplorerViewProps {
  setView: (view: ViewType) => void;
  setSelectedCompareCity: (cityName: string, target: "A" | "B") => void;
  citiesData: CityData[];
  activeCityId: string | null;
  setActiveCityId: (cityId: string) => void;
}

let indirizziCache: Record<string, SchoolData[]> | null = null;

const formatDelta = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
const formatScore = (value: number) => value.toFixed(2);

function metricScore(city: CityData, metric: MetricKey): number {
  return city[metric];
}

function metricDelta(city: CityData, metric: MetricKey): number | null {
  if (metric === "totalScore") return city.totalScore - 100;
  return city.deltas[metric];
}

function actualValue(city: CityData, metric: MetricKey): string {
  if (metric === "totalScore") return `${city.totalScore.toFixed(2)} punti finali`;
  if (metric === "invalsi") return `${city.details.docentePct.toFixed(1)}% studenti ai traguardi`;
  if (metric === "uniResults") return `FGA ${city.details.uniScore.toFixed(2)}`;
  if (metric === "workOutcomes") return city.details.lavoroScore === null ? "dato lavoro non disponibile" : `FGA lavoro ${city.details.lavoroScore.toFixed(2)}`;
  if (metric === "uniAccess") return `${city.details.immatricolazionePct.toFixed(1)}% immatricolati`;
  return `${city.details.continuitaPct.toFixed(1)}% continuità`;
}

export default function ExplorerView({
  setView,
  setSelectedCompareCity,
  citiesData,
  activeCityId,
  setActiveCityId,
}: ExplorerViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Tutte");
  const [selectedStatus, setSelectedStatus] = useState("Tutti");
  const [colorMetric, setColorMetric] = useState<MetricKey>("totalScore");
  const [sizeMetric, setSizeMetric] = useState<SizeMetricKey>("fixed");
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");

  const regions = useMemo(() => ["Tutte", ...Array.from(new Set(citiesData.map((c) => c.region))).sort()], [citiesData]);
  const statuses = useMemo(() => ["Tutti", ...Array.from(new Set(citiesData.map((c) => c.status)))], [citiesData]);

  const filteredCities = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return citiesData.filter((city) => {
      const matchesSearch =
        !query ||
        city.name.toLowerCase().includes(query) ||
        city.province.toLowerCase().includes(query) ||
        city.provinceCode.toLowerCase().includes(query);
      const matchesRegion = selectedRegion === "Tutte" || city.region === selectedRegion;
      const matchesStatus = selectedStatus === "Tutti" || city.status === selectedStatus;
      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [citiesData, searchQuery, selectedRegion, selectedStatus]);

  const activeCity = useMemo(() => {
    return citiesData.find((city) => city.id === activeCityId) || filteredCities[0] || citiesData[0];
  }, [activeCityId, citiesData, filteredCities]);

  useEffect(() => {
    if (activeCity && activeCity.id !== activeCityId) {
      setActiveCityId(activeCity.id);
    }
  }, [activeCity, activeCityId, setActiveCityId]);

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

  const filteredSchools = schools.filter((school) => {
    const query = schoolSearchQuery.toLowerCase();
    return (
      school.scuola.toLowerCase().includes(query) ||
      school.indirizzo.toLowerCase().includes(query) ||
      school.codice.toLowerCase().includes(query)
    );
  });

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

  return (
    <div className="space-y-8 animate-entrance">
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-extrabold text-[#031f27] tracking-tight">
          Esplora i comuni
        </h1>
        <p className="font-sans text-sm text-[#3e4947] max-w-3xl leading-relaxed">
          La mappa mostra i comuni inclusi nell'indice. Il colore segue sempre una scala basso-alto; la grandezza dei punti è opzionale e serve solo a leggere il peso del dato.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-3 bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-4 space-y-4 xl:sticky xl:top-24">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#3e4947] opacity-65" />
            <input
              type="text"
              placeholder="Cerca comune, provincia o sigla"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#f2fbff] rounded-xl border border-[#bdc9c7]/60 text-xs font-sans placeholder-[#80918e] focus:outline-none focus:ring-1 focus:ring-[#00605b] focus:border-[#00605b]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select label="Regione" value={selectedRegion} onChange={setSelectedRegion} options={regions} />
            <Select label="Livello" value={selectedStatus} onChange={setSelectedStatus} options={statuses} />
          </div>

          <div className="space-y-1 max-h-[560px] overflow-y-auto pr-1">
            <div className="flex justify-between items-center px-1 pb-2 border-b border-[#bdc9c7]/10">
              <span className="font-mono text-[9px] text-[#6e7978] uppercase font-bold">Comuni ({filteredCities.length})</span>
            </div>

            {filteredCities.length === 0 ? (
              <p className="text-xs text-[#3e4947] opacity-60 text-center py-12">Nessun comune corrisponde ai filtri.</p>
            ) : (
              filteredCities.map((city) => {
                const isActive = activeCity.id === city.id;
                return (
                  <button
                    key={city.id}
                    onClick={() => setActiveCityId(city.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between border transition-all cursor-pointer ${
                      isActive ? "bg-[#00605b]/10 border-[#00605b]" : "bg-transparent border-transparent hover:bg-[#f2fbff] hover:border-[#bdc9c7]/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-[#6e7978] w-8">#{city.rank}</span>
                      <div className="min-w-0">
                        <span className="font-sans text-xs font-bold text-[#031f27] truncate block">{city.name}</span>
                        <span className="font-mono text-[10px] text-[#3e4947] opacity-80">{city.provinceCode} - {city.region}</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#031f27]">{city.totalScore.toFixed(1)}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="xl:col-span-5 space-y-4">
          <div className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ButtonGroup
                label="Indicatore"
                value={colorMetric}
                options={METRICS}
                onChange={(value) => setColorMetric(value as MetricKey)}
              />
              <ButtonGroup
                label="Grandezza punti"
                value={sizeMetric}
                options={SIZE_METRICS}
                onChange={(value) => setSizeMetric(value as SizeMetricKey)}
              />
            </div>
            <ItalyDotMap
              cities={filteredCities}
              activeCityId={activeCity.id}
              colorMetric={colorMetric}
              sizeMetric={sizeMetric}
              onSelectCity={setActiveCityId}
            />
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase text-[#3e4947]">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#b3261e]" /> basso</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#d9822b]" /> sotto 100</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#d9a441]" /> circa 100</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#177a74]" /> alto</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#315e7d]" /> molto alto</span>
            </div>
          </div>
        </section>

        <section className="xl:col-span-4 bg-white border border-[#bdc9c7] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#bdc9c7]/40 bg-[#f2fbff]/60">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 bg-[#00605b]/10 rounded-xl flex items-center justify-center text-[#00605b] shadow-sm shrink-0 border border-[#00605b]/20">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-sans text-2xl font-bold text-[#031f27]">{activeCity.name}</h2>
                  <p className="text-xs font-sans text-[#3e4947]">{activeCity.province} ({activeCity.provinceCode}) - {activeCity.region}</p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wide ${getStatusBadge(activeCity.status)}`}>
                {activeCity.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <SummaryStat label="Rank" value={`#${activeCity.rank}`} />
              <SummaryStat label="Indice" value={activeCity.totalScore.toFixed(2)} />
              <SummaryStat label="Diplomati" value={activeCity.details.diplomati.toLocaleString("it-IT")} />
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#031f27] flex items-center gap-1.5 mb-3">
                <Layers className="w-4 h-4 text-[#3e4947]" />
                Pagella del comune
              </h3>
              <div className="space-y-3">
                {METRICS.filter((metric) => metric.id !== "totalScore").map((metric) => (
                  <div key={metric.id} className="rounded-xl border border-[#bdc9c7]/40 p-3 bg-white">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-sans text-xs font-bold text-[#031f27]">{metric.label}</p>
                        <p className="font-sans text-[11px] text-[#3e4947] mt-1">{actualValue(activeCity, metric.id)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold" style={{ color: metric.color }}>{formatScore(metricScore(activeCity, metric.id))}</p>
                        <p className="font-mono text-[10px] text-[#3e4947]">{formatDelta(metricDelta(activeCity, metric.id) ?? 0)} punti</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-[#f2fbff] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(4, (metricScore(activeCity, metric.id) - 70) * 2.2))}%`, backgroundColor: metric.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-yellow-50/70 border border-yellow-200 rounded-xl">
              <h4 className="font-sans font-bold text-xs text-[#031f27]">Lettura rapida</h4>
              <p className="font-sans text-[11px] text-[#3e4947] mt-1 leading-relaxed">
                Il punto relativamente più forte del comune è: <strong>{activeCity.strengths}</strong>. I dati lavoro sono coperti al {activeCity.details.workCoverage.toFixed(1)}% dei diplomati.
              </p>
            </div>

            <button
              onClick={handleQuickCompare}
              className="w-full py-2.5 px-4 bg-[#315E7D] hover:bg-[#0E5A5A] text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Confronta questo comune
            </button>
          </div>
        </section>
      </div>

      <section className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-sans font-extrabold text-lg text-[#031f27] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#00605b]" />
              Scuole incluse a {activeCity.name}
            </h3>
            <p className="text-xs text-[#3e4947] opacity-80 mt-0.5">
              Indirizzi di scuola secondaria di II grado presenti nel dataset Eduscopio usato per l'aggregazione comunale.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#3e4947] opacity-65" />
            <input
              type="text"
              placeholder="Cerca scuola o indirizzo"
              value={schoolSearchQuery}
              onChange={(e) => setSchoolSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-[#f2fbff] rounded-lg border border-[#bdc9c7]/50 text-[11px] font-sans placeholder-[#80918e] focus:outline-none"
            />
          </div>
        </div>

        {schoolsLoading ? (
          <div className="py-12 text-center text-xs font-sans text-[#3e4947]/70 animate-pulse">Caricamento delle scuole...</div>
        ) : filteredSchools.length === 0 ? (
          <div className="py-8 text-center text-xs font-sans text-[#3e4947] opacity-60 border border-dashed border-[#bdc9c7] rounded-xl">
            Nessuna scuola corrisponde alla ricerca nel comune di {activeCity.name}.
          </div>
        ) : (
          <div className="bg-[#f2fbff]/40 rounded-xl border border-[#bdc9c7]/40 overflow-hidden shadow-inner">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs font-sans responsive-table">
                <thead className="sticky top-0 bg-[#f2fbff] border-b border-[#bdc9c7]/60 text-[9px] font-mono uppercase tracking-wider text-[#3e4947]">
                  <tr>
                    <th className="py-3 px-4 w-[38%]">Istituto</th>
                    <th className="py-3 px-4 w-[28%]">Indirizzo</th>
                    <th className="py-3 px-4 text-center">Diplomati</th>
                    <th className="py-3 px-4 text-center">FGA università</th>
                    <th className="py-3 px-4 text-center">FGA lavoro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bdc9c7]/20">
                  {filteredSchools.map((school, idx) => (
                    <tr key={`${school.codice}-${school.indirizzo}-${idx}`} className="hover:bg-white transition-colors align-middle">
                      <td className="py-3 px-4" data-label="Istituto">
                        <p className="font-bold text-[#031f27]">{school.scuola}</p>
                        <span className="font-mono text-[9px] text-[#6e7978] tracking-widest">{school.codice}</span>
                      </td>
                      <td className="py-3 px-4 text-[#3e4947]" data-label="Indirizzo">{school.indirizzo}</td>
                      <td className="py-3 px-4 text-center font-mono text-[#031f27]" data-label="Diplomati">
                        {school.diplomati > 0 ? school.diplomati : "-"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono" data-label="FGA università">
                        {school.uniScore !== null ? <span className="font-bold text-[#315E7D]">{school.uniScore.toFixed(1)}</span> : <span className="text-[#6e7978] opacity-60">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-mono" data-label="FGA lavoro">
                        {school.lavScore !== null ? <span className="font-bold text-[#7C5C9E]">{school.lavScore.toFixed(1)}</span> : <span className="text-[#6e7978] opacity-60">-</span>}
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
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[10px] uppercase font-mono tracking-wider text-[#3e4947] block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#f2fbff] border border-[#bdc9c7]/60 rounded-lg p-2 text-[11px] font-sans text-[#3e4947] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ButtonGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; shortLabel?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase font-mono tracking-wider text-[#3e4947] block mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase border transition-colors ${
                active ? "bg-[#031f27] text-white border-[#031f27]" : "bg-white text-[#3e4947] border-[#bdc9c7] hover:border-[#00605b]"
              }`}
            >
              {option.shortLabel || option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#bdc9c7]/50 rounded-xl p-3">
      <p className="font-mono text-[9px] text-[#6e7978] uppercase tracking-widest">{label}</p>
      <p className="font-mono text-lg font-black text-[#031f27] mt-1 flex items-center gap-1">
        {label === "Diplomati" && <GraduationCap className="w-4 h-4 text-[#00605b]" />}
        {value}
      </p>
    </div>
  );
}
