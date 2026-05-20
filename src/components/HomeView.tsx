import type { ReactNode } from "react";
import { ArrowRight, Award, Building, CheckCircle, Globe, Layers, MapPin } from "lucide-react";
import { SCORE_LEVELS } from "../data";
import { formatNumber, metricsFor, statusLabel } from "../i18n";
import { CityData, Language, ViewType } from "../types";

interface HomeViewProps {
  setView: (view: ViewType) => void;
  citiesData: CityData[];
  language: Language;
}

const HOME_COPY = {
  it: {
    badge: "Classifica comunale sperimentale",
    title: "Indice Territoriale",
    highlight: "Scuole Superiori",
    intro:
      "Una lettura comunale degli esiti delle scuole superiori: apprendimenti nelle prove nazionali, rendimento universitario degli ex studenti e ingresso nel lavoro dove il dato è disponibile.",
    explore: "Esplora la mappa",
    method: "Leggi il metodo",
    topCity: "Primo comune",
    index: "Indice",
    stats: [
      ["Comuni inclusi", "Comuni per cui l'indice finale ha dati sufficienti."],
      ["Regioni coperte", "La copertura segue i comuni presenti nel dataset."],
      ["Punto neutro", "Sopra o sotto 100 indica lo scostamento dell'indice."],
      ["Diplomati pesati", "Usati per aggregare scuole e indirizzi a livello comunale."],
    ],
    compositionTitle: "Com'è composto l'indice",
    compositionText:
      "I cinque indicatori vengono pesati per indirizzo e per numero di diplomati. I valori visibili nella pagina mostrano sia i punti indice sia i dati reali da cui partono.",
    methodDetail: "Dettaglio metodo",
    scoreTitle: "Come leggere il punteggio",
    includeTitle: "Cosa include e cosa no",
    info: [
      ["Comune, non scuola", "L'unità della classifica è il comune. Le scuole sono mostrate nella scheda di dettaglio per capire da dove arriva il dato."],
      ["Solo comuni coperti", "Entrano i comuni per cui è possibile calcolare l'indice finale con i dati disponibili nello snapshot."],
      ["Lavoro dove ha senso", "L'ingresso nel lavoro riguarda soprattutto tecnici e professionali ed è corretto per copertura, per non trasformare la presenza di questi indirizzi in una penalità automatica."],
    ],
  },
  en: {
    badge: "Experimental municipal ranking",
    title: "Territorial Index",
    highlight: "Upper Secondary Schools",
    intro:
      "A municipal view of upper-secondary outcomes: national test results, university performance of former students and employment entry where data is available.",
    explore: "Explore the map",
    method: "Read the method",
    topCity: "Top municipality",
    index: "Index",
    stats: [
      ["Municipalities", "Municipalities with enough data to calculate the final index."],
      ["Regions covered", "Coverage follows the municipalities available in the dataset."],
      ["Neutral point", "Values above or below 100 show how far the index moves from neutral."],
      ["Weighted graduates", "Used to aggregate schools and tracks at municipal level."],
    ],
    compositionTitle: "How the index is built",
    compositionText:
      "The five indicators are weighted by school track and number of graduates. The page shows both index points and the real values behind them.",
    methodDetail: "Method details",
    scoreTitle: "How to read the score",
    includeTitle: "What is included",
    info: [
      ["Municipality, not school", "The ranking unit is the municipality. Schools are shown in the detail card to explain where the score comes from."],
      ["Covered municipalities only", "The ranking includes municipalities where the final index can be calculated with the available data."],
      ["Employment where relevant", "Employment entry mainly applies to technical and vocational tracks and is adjusted by coverage, so their presence is not an automatic penalty."],
    ],
  },
} as const;

export default function HomeView({ setView, citiesData, language }: HomeViewProps) {
  const copy = HOME_COPY[language];
  const metrics = metricsFor(language);
  const topCity = citiesData[0];
  const regions = new Set(citiesData.map((city) => city.region)).size;
  const diplomati = citiesData.reduce((sum, city) => sum + city.details.diplomati, 0);
  const statValues = [citiesData.length, regions, 100, diplomati];

  return (
    <div className="animate-entrance">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 py-10 md:py-14 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-block px-4 py-1.5 bg-[#177a74]/10 text-[#177a74] font-mono text-xs font-bold tracking-wider uppercase rounded-full">
            {copy.badge}
          </div>
          <h1 className="font-sans text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#031f27] tracking-tight leading-tight">
            {copy.title} <br />
            <span className="text-[#00605b]">{copy.highlight}</span>
          </h1>
          <p className="font-sans text-base md:text-lg text-[#3e4947] max-w-xl leading-relaxed">{copy.intro}</p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => setView("explorer")}
              className="px-8 py-4 bg-[#00605b] hover:bg-[#177a74] text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
            >
              {copy.explore} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("methodology")}
              className="px-8 py-4 border border-[#366382] text-[#366382] hover:bg-[#aedafe]/10 font-mono text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
            >
              {copy.method}
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#bdc9c7]/60 bg-white">
            <div className="bg-[#031f27] text-white p-5 flex justify-between items-start">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#bdc9c7]">{copy.topCity}</p>
                <h2 className="font-sans text-3xl font-extrabold mt-1">{topCity?.name}</h2>
                <p className="text-xs text-[#bdc9c7] mt-1">{topCity?.provinceCode} - {topCity?.region}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#bdc9c7]">{copy.index}</p>
                <p className="font-mono text-4xl font-black text-[#d9a441]">{topCity?.totalScore.toFixed(1)}</p>
              </div>
            </div>
            <div className="relative min-h-[280px] bg-[#e4f7ff] p-6 overflow-hidden">
              <div className="absolute inset-0 opacity-35 data-grid" />
              <div className="relative grid grid-cols-5 gap-3 h-[230px] items-end">
                {citiesData.slice(0, 5).map((city) => (
                  <button
                    key={city.id}
                    onClick={() => setView("rankings")}
                    className="group flex flex-col justify-end items-center gap-3 h-full"
                    title={`${city.name}: ${city.totalScore.toFixed(1)}`}
                  >
                    <div
                      className="w-full max-w-16 rounded-t-xl bg-[#00605b] group-hover:bg-[#d9a441] transition-all shadow-lg"
                      style={{ height: `${Math.max(38, (city.totalScore - 90) * 5.2)}px` }}
                    />
                    <div className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#bdc9c7] font-mono text-xs font-bold text-[#031f27]">
                        {city.rank}
                      </span>
                      <p className="font-sans text-[11px] font-bold text-[#031f27] mt-1 truncate max-w-20">{city.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 border-t border-[#bdc9c7]/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <MetricCard icon={<Building className="w-6 h-6" />} label={copy.stats[0][0]} value={formatNumber(statValues[0], language)} text={copy.stats[0][1]} />
          <MetricCard icon={<Globe className="w-6 h-6" />} label={copy.stats[1][0]} value={formatNumber(statValues[1], language)} text={copy.stats[1][1]} />
          <MetricCard icon={<Award className="w-6 h-6" />} label={copy.stats[2][0]} value="100" text={copy.stats[2][1]} />
          <MetricCard icon={<MapPin className="w-6 h-6" />} label={copy.stats[3][0]} value={formatNumber(statValues[3], language)} text={copy.stats[3][1]} />
        </div>
      </section>

      <section className="my-10 py-12 bg-[#d7f2fe]/45 rounded-[2rem] px-6 md:px-10 border border-[#d7f2fe]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-9">
          <div>
            <h2 className="font-sans text-3xl font-bold text-[#031f27]">{copy.compositionTitle}</h2>
            <p className="font-sans text-sm text-[#3e4947] max-w-2xl mt-3 leading-relaxed">{copy.compositionText}</p>
          </div>
          <button
            onClick={() => setView("methodology")}
            className="self-start lg:self-auto px-5 py-3 bg-white border border-[#bdc9c7] rounded-lg text-xs font-mono font-bold uppercase text-[#00605b] hover:border-[#00605b]"
          >
            {copy.methodDetail}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {metrics.filter((metric) => metric.id !== "totalScore").map((metric) => (
            <div
              key={metric.id}
              className="p-5 rounded-xl border shadow-sm border-t-4"
              style={{ backgroundColor: metric.surface, borderColor: metric.border, borderTopColor: metric.color }}
            >
              <div className="text-2xl font-bold font-mono" style={{ color: metric.color }}>{metric.weight}</div>
              <p className="font-mono text-xs font-bold text-[#031f27] uppercase tracking-wider mt-1 mb-3">{metric.label}</p>
              <p className="font-sans text-xs text-[#3e4947] leading-relaxed">{metric.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#bdc9c7] p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#00605b]/10 text-[#00605b] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-sans font-bold text-lg text-[#031f27]">{copy.scoreTitle}</h3>
          </div>
          <div className="space-y-3">
            {SCORE_LEVELS.map((level) => (
              <div key={level.range} className="flex justify-between items-center p-3 rounded-lg border border-[#bdc9c7]/40 bg-[#f2fbff]/40">
                <span className="font-mono text-sm font-bold text-[#031f27]">{level.range}</span>
                <span className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold ${level.badgeColor}`}>
                  {statusLabel(level.label, language)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <h2 className="font-sans text-2xl md:text-3xl font-extrabold text-[#031f27]">{copy.includeTitle}</h2>
          {copy.info.map(([title, text]) => (
            <InfoLine key={title} title={title} text={text} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, text }: { icon: ReactNode; label: string; value: string; text: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-[#bdc9c7] hover:border-[#00605b] transition-all duration-300 group shadow-sm">
      <div className="flex justify-between items-start mb-5">
        <div className="w-12 h-12 bg-[#00605b]/10 text-[#00605b] rounded-lg flex items-center justify-center group-hover:scale-105 transition-all">
          {icon}
        </div>
        <span className="font-mono text-[10px] text-[#3e4947] bg-[#e4f7ff] px-2 py-1 rounded uppercase">{label}</span>
      </div>
      <h3 className="font-mono text-3xl font-bold text-[#031f27] mb-2">{value}</h3>
      <p className="font-sans text-sm text-[#3e4947] leading-relaxed">{text}</p>
    </div>
  );
}

function InfoLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-4 items-start">
      <CheckCircle className="w-5 h-5 text-[#177a74] shrink-0 mt-0.5" />
      <div>
        <p className="font-sans text-sm font-semibold text-[#031f27]">{title}</p>
        <p className="font-sans text-xs text-[#3e4947] mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
