import { useMemo, useState } from "react";
import { ArrowUpDown, Download, ExternalLink, Search } from "lucide-react";
import { METRICS, SCORE_LEVELS } from "../data";
import { CityData, MetricKey, ViewType } from "../types";

interface RankingsViewProps {
  setView: (view: ViewType) => void;
  setSelectedCompareCity: (cityName: string, target: "A" | "B") => void;
  openExplorerCity: (cityId: string) => void;
  citiesData: CityData[];
}

type SortField = MetricKey | "name" | "region";

function metricValue(city: CityData, metric: MetricKey): number {
  return city[metric];
}

function metricDelta(city: CityData, metric: MetricKey): string {
  const value = metric === "totalScore" ? city.totalScore - 100 : city.deltas[metric];
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export default function RankingsView({ setView, setSelectedCompareCity, openExplorerCity, citiesData }: RankingsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedZone, setSelectedZone] = useState<"ALL" | "NORD" | "CENTRO" | "SUD">("ALL");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("totalScore");
  const [sortField, setSortField] = useState<SortField>("totalScore");
  const [sortAscending, setSortAscending] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const getZone = (region: string): "NORD" | "CENTRO" | "SUD" => {
    const r = region.toLowerCase();
    const north = ["lombardia", "trentino", "veneto", "friuli", "piemonte", "liguria", "valle", "emilia"];
    const center = ["toscana", "lazio", "umbria", "marche", "abruzzo"];
    if (north.some((n) => r.includes(n))) return "NORD";
    if (center.some((c) => r.includes(c))) return "CENTRO";
    return "SUD";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAscending(!sortAscending);
    else {
      setSortField(field);
      setSortAscending(false);
    }
  };

  const chooseMetric = (metric: MetricKey) => {
    setActiveMetric(metric);
    setSortField(metric);
    setSortAscending(false);
  };

  const processedData = useMemo(() => {
    return citiesData
      .filter((city) => {
        const query = searchTerm.toLowerCase().trim();
        const matchSearch =
          !query ||
          city.name.toLowerCase().includes(query) ||
          city.provinceCode.toLowerCase().includes(query) ||
          city.province.toLowerCase().includes(query) ||
          city.region.toLowerCase().includes(query);
        const matchZone = selectedZone === "ALL" || getZone(city.region) === selectedZone;
        return matchSearch && matchZone;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === "name") comparison = a.name.localeCompare(b.name);
        else if (sortField === "region") comparison = a.region.localeCompare(b.region);
        else comparison = metricValue(a, sortField) - metricValue(b, sortField);
        return sortAscending ? comparison : -comparison;
      });
  }, [citiesData, searchTerm, selectedZone, sortAscending, sortField]);

  const triggerCsvDownload = () => {
    const metricLabel = METRICS.find((metric) => metric.id === activeMetric)?.label || "Indice";
    const headers = `Rank finale,Comune,Provincia,Regione,${metricLabel},Scostamento,Livello,Punto di forza\n`;
    const rows = processedData.map((city) => {
      return `${city.rank},"${city.name}","${city.provinceCode}","${city.region}",${metricValue(city, activeMetric).toFixed(2)},${metricDelta(city, activeMetric)},"${city.status}","${city.strengths}"`;
    }).join("\n");

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `classifica_itss_${activeMetric}_${selectedZone.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    const found = SCORE_LEVELS.find((s) => s.label === status);
    return found ? found.bg : "bg-neutral-100 text-neutral-800";
  };

  return (
    <div className="space-y-8 animate-entrance">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-sans text-3xl font-extrabold text-[#031f27] tracking-tight">
            Classifica nazionale
          </h1>
          <p className="font-sans text-sm text-[#3e4947] max-w-2xl leading-relaxed">
            Graduatoria dei comuni coperti dall'indice. Puoi ordinare la tabella per punteggio finale o per singola dimensione.
          </p>
        </div>

        <button
          onClick={triggerCsvDownload}
          className="px-4 py-2.5 bg-[#00605b] hover:bg-[#177a74] text-white font-mono text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          Esporta CSV
        </button>
      </div>

      <div className="bg-white border border-[#bdc9c7] rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-wrap gap-1">
            {(["ALL", "NORD", "CENTRO", "SUD"] as const).map((zone) => {
              const labels = { ALL: "Tutti", NORD: "Nord", CENTRO: "Centro", SUD: "Sud e isole" };
              const isActive = selectedZone === zone;
              return (
                <button
                  key={zone}
                  onClick={() => setSelectedZone(zone)}
                  aria-pressed={isActive}
                  className={`px-4 py-2 rounded-lg font-sans text-xs font-bold transition-all cursor-pointer ${
                    isActive ? "bg-[#3e4947] text-white" : "text-[#3e4947] hover:bg-[#f2fbff]"
                  }`}
                >
                  {labels[zone]}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-[#3e4947]/70" />
            <input
              type="text"
              placeholder="Filtra per comune, provincia o regione"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f2fbff] border border-[#bdc9c7]/70 rounded-lg text-xs font-sans placeholder-[#80918e] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {METRICS.map((metric) => {
            const isActive = activeMetric === metric.id;
            return (
              <button
                key={metric.id}
                onClick={() => chooseMetric(metric.id)}
                aria-pressed={isActive}
                className={`px-3 py-2 rounded-lg border font-mono text-[10px] font-bold uppercase transition-colors ${
                  isActive ? "text-white border-transparent" : "bg-white text-[#3e4947] border-[#bdc9c7] hover:border-[#00605b]"
                }`}
                style={isActive ? { backgroundColor: metric.color } : undefined}
              >
                {metric.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse ranking-table">
            <thead>
              <tr className="bg-[#f2fbff] border-b border-[#bdc9c7] font-mono text-[10px] text-[#3e4947] uppercase tracking-wider">
                <th className="py-4 px-5 text-center font-bold w-20">Rank</th>
                <th className="py-4 px-4 font-bold cursor-pointer hover:text-[#00605b]" onClick={() => handleSort("name")}>
                  Comune <ArrowUpDown className="w-3 h-3 inline-block ml-1" />
                </th>
                <th className="py-4 px-4 text-center font-bold w-24">Prov.</th>
                <th className="py-4 px-4 font-bold cursor-pointer hover:text-[#00605b] hidden md:table-cell" onClick={() => handleSort("region")}>
                  Regione <ArrowUpDown className="w-3 h-3 inline-block ml-1" />
                </th>
                <th className="py-4 px-4 font-bold cursor-pointer hover:text-[#00605b] text-right pr-6" onClick={() => handleSort(activeMetric)}>
                  {METRICS.find((metric) => metric.id === activeMetric)?.shortLabel} <ArrowUpDown className="w-3 h-3 inline-block ml-1" />
                </th>
                <th className="py-4 px-4 font-bold text-right hidden lg:table-cell">Scostamento</th>
                <th className="py-4 px-4 font-bold text-center hidden lg:table-cell w-36">Livello</th>
                <th className="py-4 px-4 text-center w-28">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bdc9c7]/30">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs font-sans text-[#3e4947] opacity-60">
                    Nessun comune corrispondente ai filtri.
                  </td>
                </tr>
              ) : (
                processedData.map((city, index) => {
                  const metricRank = index + 1;
                  const isFinalMetric = activeMetric === "totalScore";
                  const displayedRank = isFinalMetric ? city.rank : metricRank;
                  let rankStyle = "bg-[#bdc9c7]/20 text-[#031f27]";
                  if (displayedRank === 1) rankStyle = "bg-[#fff2d1] text-[#906a14] border-yellow-300 font-extrabold shadow-sm";
                  if (displayedRank === 2) rankStyle = "bg-slate-100 text-slate-800 border-slate-300 font-bold";
                  if (displayedRank === 3) rankStyle = "bg-amber-100/40 text-amber-900 border-amber-200";

                  return (
                    <tr key={city.id} className="hover:bg-[#f2fbff]/50 transition-colors group align-middle font-sans text-xs text-[#031f27]">
                      <td className="py-3 px-5 text-center">
                        <span className={`inline-block w-8 py-1 rounded text-[11px] border font-mono ${rankStyle}`}>#{displayedRank}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-sm text-[#00605b]">
                        <button onClick={() => openExplorerCity(city.id)} className="group-hover:underline text-left">
                          {city.name}
                          <span className="block md:hidden text-[10px] font-mono text-[#3e4947] font-normal mt-0.5">{city.region}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center font-mono opacity-80 text-[#3e4947]">{city.provinceCode}</td>
                      <td className="py-3 px-4 text-[#3e4947] hidden md:table-cell">{city.region}</td>
                      <td className="py-3 px-4 text-right pr-6 font-mono font-bold text-[#031f27]">{metricValue(city, activeMetric).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono hidden lg:table-cell">{metricDelta(city, activeMetric)}</td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase border ${getStatusBadge(city.status)}`}>
                          {city.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedCompareCity(city.name, "A");
                              setView("comparison");
                            }}
                            className="p-1.5 text-[#00605b] hover:bg-[#00605b]/10 rounded transition-all cursor-pointer"
                            title="Confronta comune"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openExplorerCity(city.id)}
                            className="p-1.5 text-[#315E7D] hover:bg-[#315E7D]/10 rounded transition-all cursor-pointer"
                            title="Apri scheda comune"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-6 right-6 bg-[#031f27] text-white p-4 rounded-xl shadow-2xl border border-[#bdc9c7]/30 z-[60] animate-toast-slide">
          <p className="font-sans text-xs font-bold text-white">CSV scaricato</p>
          <p className="font-sans text-[11px] text-[#bdc9c7] mt-0.5">Contiene i comuni filtrati e la dimensione selezionata.</p>
        </div>
      )}
    </div>
  );
}
