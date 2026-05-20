import { Github, Landmark } from "lucide-react";

export default function Footer() {
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
                <span className="font-sans text-lg font-bold block tracking-tight">
                  Indice Territoriale Scuole Superiori
                </span>
                <span className="text-[10px] font-sans font-medium text-[#bdc9c7] tracking-wider block uppercase opacity-80 mt-0.5">
                  Progetto dati di Simone Ghezzi Colombo
                </span>
              </div>
            </div>
            <p className="font-sans text-xs text-[#bdc9c7] leading-relaxed max-w-sm">
              L'indice confronta i comuni coperti dai dati disponibili. Non è un sito ufficiale e non sostituisce le classifiche delle singole scuole.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-white">Esplora</h4>
            <div className="flex flex-col gap-2 font-sans text-xs text-[#bdc9c7]">
              <a href="https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/" className="hover:text-white transition-colors">Pagina progetto</a>
              <a href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Repository e dati</a>
              <a href="https://simoneghezzicolombo.github.io/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Portfolio</a>
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-white">Fonti usate</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans text-xs text-[#bdc9c7]">
              <a href="https://www.docente.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Docente.it / prove nazionali</a>
              <a href="https://eduscopio.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Eduscopio</a>
              <a href="https://www.invalsi.it/" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">INVALSI</a>
              <a href="https://github.com/openpolis/geojson-italy" className="hover:text-white transition-colors" target="_blank" rel="noreferrer">Openpolis GeoJSON</a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#bdc9c7]/20 pt-6 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-mono text-[#bdc9c7]">
          <span>Snapshot dati: 14 maggio 2026.</span>
          <a
            href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-white"
          >
            <Github className="w-3.5 h-3.5" />
            codice e dataset riproducibili
          </a>
        </div>
      </div>
    </footer>
  );
}
