import { Github, Landmark } from "lucide-react";
import { Language } from "../types";

interface FooterProps {
  language: Language;
}

const FOOTER_COPY = {
  it: {
    title: "Indice Territoriale Scuole Superiori",
    subtitle: "Progetto dati di Simone Ghezzi Colombo",
    text:
      "L'indice confronta i comuni coperti dai dati disponibili. Non è un sito ufficiale e non sostituisce le classifiche delle singole scuole.",
    explore: "Esplora",
    project: "Pagina progetto",
    repo: "Repository e dati",
    portfolio: "Portfolio",
    sources: "Fonti usate",
    docente: "Docente.it / prove nazionali",
    snapshot: "Snapshot dati: 14 maggio 2026.",
    reproducible: "codice e dataset riproducibili",
  },
  en: {
    title: "Territorial Upper Secondary School Index",
    subtitle: "Data project by Simone Ghezzi Colombo",
    text:
      "The index compares municipalities covered by the available data. It is not an official website and does not replace rankings of individual schools.",
    explore: "Explore",
    project: "Project page",
    repo: "Repository and data",
    portfolio: "Portfolio",
    sources: "Sources used",
    docente: "Docente.it / national tests",
    snapshot: "Data snapshot: May 14, 2026.",
    reproducible: "reproducible code and datasets",
  },
} as const;

export default function Footer({ language }: FooterProps) {
  const copy = FOOTER_COPY[language];

  return (
    <footer className="bg-[#031f27] text-white mt-16 border-t-4 border-[#00605b]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-16 py-12 md:py-16 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#00605b] text-white rounded-lg flex items-center justify-center">
                <Landmark className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-sans text-lg font-bold block tracking-tight">{copy.title}</span>
                <span className="text-[10px] font-sans font-medium text-[#bdc9c7] tracking-wider block uppercase opacity-80 mt-0.5">
                  {copy.subtitle}
                </span>
              </div>
            </div>
            <p className="font-sans text-xs text-[#bdc9c7] leading-relaxed max-w-sm">{copy.text}</p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-white">{copy.explore}</h4>
            <div className="flex flex-col gap-2 font-sans text-xs text-[#bdc9c7]">
              <a href="https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/" className="hover:text-white transition-colors">{copy.project}</a>
              <a href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">{copy.repo}</a>
              <a href="https://simoneghezzicolombo.github.io/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">{copy.portfolio}</a>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-white">{copy.sources}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans text-xs text-[#bdc9c7]">
              <a href="https://www.docente.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">{copy.docente}</a>
              <a href="https://eduscopio.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Eduscopio</a>
              <a href="https://www.invalsi.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">INVALSI</a>
              <a href="https://github.com/openpolis/geojson-italy" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Openpolis GeoJSON</a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#bdc9c7]/20 pt-6 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-mono text-[#bdc9c7]">
          <span>{copy.snapshot}</span>
          <a
            href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-white"
          >
            <Github className="w-3.5 h-3.5" />
            {copy.reproducible}
          </a>
        </div>
      </div>
    </footer>
  );
}
