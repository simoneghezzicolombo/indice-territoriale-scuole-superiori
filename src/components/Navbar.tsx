import { ExternalLink, Github, Landmark, Menu, X } from "lucide-react";
import { useState } from "react";
import { ViewType } from "../types";

interface NavbarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export default function Navbar({ currentView, setView }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks: { id: ViewType; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "explorer", label: "Esplora" },
    { id: "rankings", label: "Classifica" },
    { id: "comparison", label: "Confronta" },
    { id: "methodology", label: "Metodo" },
  ];

  const openView = (view: ViewType) => {
    setView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#bdc9c7] transition-all duration-300">
      <nav className="max-w-[1280px] mx-auto px-4 md:px-16 h-20 flex justify-between items-center">
        <button onClick={() => openView("home")} className="flex items-center gap-3 cursor-pointer group text-left">
          <div className="w-10 h-10 bg-[#00605b] text-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-sans text-lg md:text-xl font-bold text-[#031f27] block tracking-tight leading-none group-hover:text-[#00605b] transition-colors">
              Indice Territoriale
            </span>
            <span className="text-[11px] font-sans font-medium text-[#3e4947] tracking-wide block uppercase opacity-80 mt-1">
              Scuole Superiori
            </span>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {navLinks.map((link) => {
            const isActive = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => openView(link.id)}
                aria-current={isActive ? "page" : undefined}
                className={`font-mono text-xs font-bold uppercase tracking-wider pb-1 transition-all border-b-2 hover:text-[#00605b] cursor-pointer ${
                  isActive ? "text-[#00605b] border-[#00605b]" : "text-[#3e4947] border-transparent"
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
            title="Repository GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://simoneghezzicolombo.github.io/"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
            title="Portfolio"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        <button
          onClick={() => setMobileMenuOpen((value) => !value)}
          className="md:hidden p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
          aria-label="Apri menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#bdc9c7] bg-white text-[#031f27] py-4 px-6 flex flex-col gap-4 shadow-lg animate-reveal-chip">
          {navLinks.map((link) => {
            const isActive = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => openView(link.id)}
                className={`font-sans text-sm font-semibold text-left py-2 border-b border-[#bdc9c7]/20 ${
                  isActive ? "text-[#00605b] font-bold pl-1 border-[#00605b]" : "text-[#3e4947]"
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <a
            href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori"
            target="_blank"
            rel="noreferrer"
            className="font-sans text-sm font-semibold text-left py-2 text-[#3e4947]"
          >
            GitHub
          </a>
          <a
            href="https://simoneghezzicolombo.github.io/"
            target="_blank"
            rel="noreferrer"
            className="font-sans text-sm font-semibold text-left py-2 text-[#3e4947]"
          >
            Portfolio
          </a>
        </div>
      )}
    </header>
  );
}
