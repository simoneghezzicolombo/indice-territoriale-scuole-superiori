import type { ReactNode } from "react";
import { AlertCircle, Award, CheckCircle2, Database, Layers } from "lucide-react";
import { metricsFor } from "../i18n";
import { Language } from "../types";

interface MethodologyViewProps {
  language: Language;
}

const METHOD_COPY = {
  it: {
    title: "Metodo e limiti",
    intro:
      "L'indice è una ricostruzione sperimentale e riproducibile a livello comunale. Non è una graduatoria ufficiale delle scuole e non misura il valore aggiunto dei singoli istituti.",
    formulaTitle: "Formula dell'indice",
    formulaText:
      "Il valore finale parte da 100. Ogni indicatore aggiunge o sottrae punti in base allo scostamento del comune rispetto alla lettura nazionale usata nel modello, con pesi diversi per dimensione e con aggregazione per indirizzo e diplomati.",
    formula: `Indice finale =
100
+ 35% apprendimenti nelle prove nazionali
+ 35% rendimento all'università
+ 10% ingresso nel lavoro, corretto per copertura
+ 10% passaggio all'università
+ 10% tenuta universitaria`,
    dimensions: "Le cinque dimensioni",
    includedTitle: "Quali scuole sono incluse",
    includedText:
      "Sono incluse le scuole secondarie di II grado presenti nei dati usati per lo snapshot: licei, tecnici e professionali. Ogni scuola entra per indirizzo e per numero di diplomati, poi viene aggregata nel comune in cui si trova.",
    includedText2:
      "I comuni senza copertura sufficiente per calcolare l'indice finale non sono mostrati nella classifica. Questo evita di confrontare territori dove mancano pezzi essenziali del dato.",
    sources: "Fonti",
    sourcesItems: [
      ["Docente.it / INVALSI", "percentuali aggregate sulle prove nazionali per comune."],
      ["Eduscopio", "FGA universitario, immatricolazioni, tenuta del percorso e ingresso nel lavoro."],
      ["Openpolis", "coordinate e confini comunali usati per geolocalizzare i punti."],
    ],
    read100: "Come leggere 100",
    readItems: [
      ["Sopra 100", "profilo complessivo più forte del punto neutro dell'indice."],
      ["Sotto 100", "profilo più fragile su una o più dimensioni."],
      ["Valori reali", "percentuali e FGA restano visibili nelle schede per evitare letture astratte."],
    ],
    limits: "Limiti principali",
    limitsText:
      "L'indice dipende dalla copertura delle fonti pubbliche e dai criteri di aggregazione per indirizzo. Non incorpora informazioni su contesto socio-economico, dotazioni scolastiche, soddisfazione degli studenti o qualità percepita dalle famiglie.",
  },
  en: {
    title: "Method and limits",
    intro:
      "The index is an experimental and reproducible municipal reconstruction. It is not an official school ranking and does not measure the added value of individual schools.",
    formulaTitle: "Index formula",
    formulaText:
      "The final value starts from 100. Each indicator adds or subtracts points according to the municipality's distance from the national reading used in the model, with different weights by dimension and aggregation by track and graduates.",
    formula: `Final index =
100
+ 35% learning outcomes in national tests
+ 35% university performance
+ 10% employment entry, adjusted by coverage
+ 10% university enrolment
+ 10% university persistence`,
    dimensions: "The five dimensions",
    includedTitle: "Which schools are included",
    includedText:
      "The index includes upper-secondary schools found in the source data: licei, technical schools and vocational schools. Each school enters by track and number of graduates, then is aggregated into its municipality.",
    includedText2:
      "Municipalities without enough coverage to calculate the final index are not shown in the ranking. This avoids comparing territories where essential data is missing.",
    sources: "Sources",
    sourcesItems: [
      ["Docente.it / INVALSI", "municipal aggregate percentages for the national tests."],
      ["Eduscopio", "university FGA, enrolments, persistence and employment entry."],
      ["Openpolis", "municipal coordinates and boundaries used to geolocate points."],
    ],
    read100: "How to read 100",
    readItems: [
      ["Above 100", "overall profile stronger than the index neutral point."],
      ["Below 100", "weaker profile on one or more dimensions."],
      ["Real values", "percentages and FGA remain visible in the cards to avoid abstract readings."],
    ],
    limits: "Main limits",
    limitsText:
      "The index depends on the coverage of public sources and the aggregation criteria by track. It does not include socio-economic context, school resources, student satisfaction or families' perceived quality.",
  },
} as const;

export default function MethodologyView({ language }: MethodologyViewProps) {
  const copy = METHOD_COPY[language];
  const metrics = metricsFor(language);

  return (
    <div className="space-y-8 animate-entrance">
      <div className="space-y-1">
        <h1 className="font-sans text-3xl font-extrabold text-[#031f27] tracking-tight">{copy.title}</h1>
        <p className="font-sans text-sm text-[#3e4947] max-w-3xl leading-relaxed">{copy.intro}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white border border-[#bdc9c7] rounded-2xl p-6 md:p-8 space-y-7 shadow-sm">
          <section className="space-y-3">
            <h2 className="font-sans text-xl font-bold text-[#031f27] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#00605b]" />
              {copy.formulaTitle}
            </h2>
            <p className="font-sans text-xs text-[#3e4947] leading-relaxed">{copy.formulaText}</p>
            <pre className="bg-[#031f27] text-[#e4f7ff] rounded-2xl p-5 text-xs overflow-x-auto font-mono leading-relaxed">
              {copy.formula}
            </pre>
          </section>

          <section className="space-y-3">
            <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#031f27]">{copy.dimensions}</h3>
            <div className="space-y-3">
              {metrics.filter((metric) => metric.id !== "totalScore").map((metric, index) => (
                <div
                  key={metric.id}
                  className="p-4 rounded-xl border flex gap-4 items-start"
                  style={{ backgroundColor: metric.surface, borderColor: metric.border }}
                >
                  <span className="font-mono text-xs font-bold text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: metric.color }}>
                    {metric.weight}
                  </span>
                  <div>
                    <p className="font-sans font-bold text-xs text-[#031f27]">
                      {String(index + 1).padStart(2, "0")}. {metric.label}
                    </p>
                    <p className="font-sans text-[11px] text-[#3e4947] mt-0.5">{metric.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 pt-4 border-t border-[#bdc9c7]/20">
            <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#031f27]">{copy.includedTitle}</h3>
            <p className="font-sans text-xs text-[#3e4947] leading-relaxed">{copy.includedText}</p>
            <p className="font-sans text-xs text-[#3e4947] leading-relaxed">{copy.includedText2}</p>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <InfoBox icon={<Database className="w-4.5 h-4.5 text-[#2563eb]" />} title={copy.sources} items={copy.sourcesItems} />
          <InfoBox icon={<Layers className="w-4.5 h-4.5 text-[#2563eb]" />} title={copy.read100} items={copy.readItems} />

          <div className="bg-yellow-50/55 rounded-2xl border border-yellow-200 p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <h4 className="font-sans font-bold text-xs">{copy.limits}</h4>
            </div>
            <p className="font-sans text-[11px] text-[#3e4947] leading-relaxed">{copy.limitsText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div className="bg-sky-50 rounded-2xl border border-sky-100 p-6 space-y-4">
      <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[#2563eb] flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="space-y-4 font-sans text-xs text-[#3e4947]">
        {items.map(([label, text]) => (
          <div key={label} className="border-t first:border-t-0 border-[#bdc9c7]/20 first:pt-0 pt-3">
            <p className="font-bold text-[#031f27] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#177a74]" />
              {label}
            </p>
            <p className="opacity-90 mt-0.5">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
