import { useMemo, useState } from "react";
import { ArrowRightLeft, ExternalLink, Search } from "lucide-react";
import { METRICS, SCORE_LEVELS } from "../data";
import { CityData, MetricKey } from "../types";

interface CompareViewProps {
  cityAName: string;
  cityBName: string;
  setCityA: (name: string) => void;
  setCityB: (name: string) => void;
  openExplorerCity: (cityId: string) => void;
  citiesData: CityData[];
}

const formatDelta = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

function metricScore(city: CityData, metric: MetricKey): number {
  return city[metric];
}

function metricDelta(city: CityData, metric: MetricKey): number {
  if (metric === "totalScore") return city.totalScore - 100;
  return city.deltas[metric];
}

function actualValue(city: CityData, metric: MetricKey): string {
  if (metric === "totalScore") return `${city.totalScore.toFixed(2)} punti`;
  if (metric === "invalsi") return `${city.details.docentePct.toFixed(1)}%`;
  if (metric === "uniResults") return `FGA ${city.details.uniScore.toFixed(1)}`;
  if (metric === "workOutcomes") return city.details.lavoroScore === null ? "n.d." : `FGA ${city.details.lavoroScore.toFixed(1)}`;
  if (metric === "uniAccess") return `${city.details.immatricolazionePct.toFixed(1)}%`;
  return `${city.details.continuitaPct.toFixed(1)}%`;
}

export default function CompareView({
  cityAName,
  cityBName,
  setCityA,
  setCityB,
  openExplorerCity,
  citiesData,
}: CompareViewProps) {
  const [dropdownAOpen, setDropdownAOpen] = useState(false);
  const [dropdownBOpen, setDropdownBOpen] = useState(false);
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

  const cityA = useMemo(() => citiesData.find((c) => c.name === cityAName) || citiesData[0], [cityAName, citiesData]);
  const cityB = useMemo(() => citiesData.find((c) => c.name === cityBName) || citiesData[1] || citiesData[0], [cityBName, citiesData]);

  const optionsA = useMemo(() => {
    const query = searchA.toLowerCase();
    return citiesData.filter((c) => c.name.toLowerCase().includes(query) && c.name !== cityBName);
  }, [searchA, cityBName, citiesData]);

  const optionsB = useMemo(() => {
    const query = searchB.toLowerCase();
    return citiesData.filter((c) => c.name.toLowerCase().includes(query) && c.name !== cityAName);
  }, [searchB, cityAName, citiesData]);

  const summary = useMemo(() => {
    const diff = cityA.totalScore - cityB.totalScore;
    const leader = diff >= 0 ? cityA : cityB;
    const follower = diff >= 0 ? cityB : cityA;
    const strongestGap = METRICS.filter((metric) => metric.id !== "totalScore")
      .map((metric) => ({
        metric,
        gap: metricScore(cityA, metric.id) - metricScore(cityB, metric.id),
      }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

    return {
      leader,
      follower,
      diff: Math.abs(diff),
      strongestGap,
    };
  }, [cityA, cityB]);

  const getStatusBadge = (status: string) => {
    const found = SCORE_LEVELS.find((s) => s.label === status);
    return found ? found.badgeColor : "bg-gray-500 text-white";
  };

  return (
    <div className="space-y-8 animate-entrance">
      <div className="space-y-1">
        <h1 className="font-sans text-3xl font-extrabold text-[#031f27] tracking-tight">
          Confronta due comuni
        </h1>
        <p className="font-sans text-sm text-[#3e4947] max-w-2xl leading-relaxed">
          Metti fianco a fianco punteggio finale, singole dimensioni e valori reali. Utile per capire se la differenza nasce dalle competenze, dal dopo-diploma o dalla copertura lavoro.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CityPicker
          label="Comune A"
          city={cityA}
          open={dropdownAOpen}
          setOpen={setDropdownAOpen}
          search={searchA}
          setSearch={setSearchA}
          options={optionsA}
          onPick={(name) => setCityA(name)}
        />
        <CityPicker
          label="Comune B"
          city={cityB}
          open={dropdownBOpen}
          setOpen={setDropdownBOpen}
          search={searchB}
          setSearch={setSearchB}
          options={optionsB}
          onPick={(name) => setCityB(name)}
        />
      </div>

      <div className="bg-white border border-[#bdc9c7] rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-[#bdc9c7]/30 pb-6">
          <CityHeader city={cityA} badge={getStatusBadge(cityA.status)} onOpen={() => openExplorerCity(cityA.id)} />
          <CityHeader city={cityB} badge={getStatusBadge(cityB.status)} onOpen={() => openExplorerCity(cityB.id)} />
        </div>

        <div className="space-y-4">
          {METRICS.map((metric) => (
            <CompareRow key={metric.id} metric={metric.id} cityA={cityA} cityB={cityB} />
          ))}
        </div>

        <div className="bg-[#f0f8ff] rounded-2xl p-6 border-l-4 border-[#00605b] space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#00605b]" />
            <h4 className="font-sans font-bold text-sm text-[#031f27]">Lettura del confronto</h4>
          </div>
          <p className="font-sans text-xs text-[#3e4947] leading-relaxed">
            {summary.leader.name} è davanti a {summary.follower.name} di {summary.diff.toFixed(2)} punti nell'indice finale.
            La differenza più ampia tra le dimensioni è in "{summary.strongestGap.metric.label}", con {Math.abs(summary.strongestGap.gap).toFixed(2)} punti di distanza.
          </p>
          <p className="font-sans text-[11px] text-[#3e4947] leading-relaxed">
            I punti indice servono per il confronto. I valori tra parentesi mostrano il dato reale: percentuali, FGA universitario o FGA lavoro.
          </p>
        </div>
      </div>
    </div>
  );
}

function CityPicker({
  label,
  city,
  open,
  setOpen,
  search,
  setSearch,
  options,
  onPick,
}: {
  label: string;
  city: CityData;
  open: boolean;
  setOpen: (value: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  options: CityData[];
  onPick: (name: string) => void;
}) {
  return (
    <div className="relative">
      <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-[#3e4947] block mb-1">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-white border border-[#bdc9c7] rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:border-[#00605b] transition-all text-left"
      >
        <span className="font-sans text-sm font-bold text-[#031f27]">{city.name} ({city.provinceCode})</span>
        <span className="text-xs text-[#00605b] font-mono">Cambia</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-[#bdc9c7] rounded-xl shadow-2xl z-30 p-2 max-h-72 overflow-y-auto">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[#3e4947]/70" />
            <input
              type="text"
              placeholder="Filtra comune"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full pl-8 pr-3 py-1.5 border border-[#bdc9c7]/50 rounded-lg text-xs font-sans focus:outline-none"
            />
          </div>
          <div className="space-y-0.5">
            {options.slice(0, 150).map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onPick(option.name);
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full text-left px-3 py-1.5 rounded hover:bg-[#f2fbff] text-xs font-sans text-[#031f27]"
              >
                {option.name} ({option.provinceCode}) - {option.region}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CityHeader({ city, badge, onOpen }: { city: CityData; badge: string; onOpen: () => void }) {
  return (
    <div className="rounded-2xl border border-[#bdc9c7]/40 p-5 bg-[#f2fbff]/45">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] text-[#6e7978] uppercase">#{city.rank} su indice finale</p>
          <h2 className="font-sans text-3xl font-extrabold text-[#031f27] tracking-tight mt-1">{city.name}</h2>
          <p className="font-mono text-xs text-[#3e4947] mt-1">{city.provinceCode} - {city.region}</p>
        </div>
        <button onClick={onOpen} className="self-start p-2 text-[#315E7D] hover:bg-white rounded-lg" title="Apri scheda">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
      <div className="pt-5 flex flex-wrap items-end justify-between gap-3">
        <span className="font-mono text-4xl font-black text-[#00605b] tracking-tight">{city.totalScore.toFixed(1)}</span>
        <span className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg uppercase ${badge}`}>{city.status}</span>
      </div>
    </div>
  );
}

function CompareRow({ metric, cityA, cityB }: { metric: MetricKey; cityA: CityData; cityB: CityData }) {
  const definition = METRICS.find((item) => item.id === metric)!;
  const aScore = metricScore(cityA, metric);
  const bScore = metricScore(cityB, metric);
  const max = Math.max(aScore, bScore, 110);
  const min = Math.min(aScore, bScore, 70);
  const width = (value: number) => `${Math.max(6, ((value - min) / (max - min || 1)) * 100)}%`;

  return (
    <div className="rounded-2xl border border-[#bdc9c7]/40 bg-white p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-sans text-sm font-bold text-[#031f27]">{definition.label} <span className="font-mono text-[10px] text-[#6e7978]">({definition.weight})</span></h3>
          <p className="font-sans text-[11px] text-[#3e4947] mt-1">{definition.description}</p>
        </div>
        <span className="font-mono text-[10px] text-[#3e4947] uppercase">punti indice + dato reale</span>
      </div>

      <div className="space-y-3">
        <BarLine city={cityA} metric={metric} score={aScore} color="#177A74" width={width(aScore)} />
        <BarLine city={cityB} metric={metric} score={bScore} color="#315E7D" width={width(bScore)} />
      </div>
    </div>
  );
}

function BarLine({ city, metric, score, color, width }: { city: CityData; metric: MetricKey; score: number; color: string; width: string }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span className="font-sans text-[#031f27] font-semibold">{city.name}</span>
        <span className="font-mono font-bold text-[#031f27]">
          {score.toFixed(2)} <span className="text-[#6e7978] font-medium">({formatDelta(metricDelta(city, metric))} punti; {actualValue(city, metric)})</span>
        </span>
      </div>
      <div className="h-4 bg-[#f2fbff] rounded-full overflow-hidden border border-[#bdc9c7]/30">
        <div className="h-full transition-all duration-500" style={{ width, backgroundColor: color }} />
      </div>
    </div>
  );
}
