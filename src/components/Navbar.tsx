import { ExternalLink, Github, Landmark, Menu, X } from "lucide-react";
import { useState } from "react";
import { UI_COPY } from "../i18n";
import { Language, ViewType } from "../types";

interface NavbarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  language: Language;
  setLanguage: (language: Language) => void;
}

export default function Navbar({ currentView, setView, language, setLanguage }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const copy = UI_COPY[language];

  const navLinks: { id: ViewType; label: string }[] = [
    { id: "home", label: copy.nav.home },
    { id: "explorer", label: copy.nav.explorer },
    { id: "rankings", label: copy.nav.rankings },
    { id: "comparison", label: copy.nav.comparison },
    { id: "methodology", label: copy.nav.methodology },
  ];

  const openView = (view: ViewType) => {
    setView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#bdc9c7] transition-all duration-300">
      <nav className="max-w-[1280px] mx-auto px-4 md:px-16 h-20 flex justify-between items-center gap-3">
        <button onClick={() => openView("home")} className="flex items-center gap-2 sm:gap-3 cursor-pointer group text-left min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#00605b] text-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-all shrink-0">
            <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-sans text-sm sm:text-lg md:text-xl font-bold text-[#031f27] block tracking-tight leading-none group-hover:text-[#00605b] transition-colors truncate max-w-[7.8rem] sm:max-w-none">
              {copy.brandTitle}
            </span>
            <span className="hidden sm:block text-[11px] font-sans font-medium text-[#3e4947] tracking-wide uppercase opacity-80 mt-1">
              {copy.brandSubtitle}
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

        <div className="ml-auto md:ml-0">
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
            title={copy.githubTitle}
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://simoneghezzicolombo.github.io/"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
            title={copy.portfolioTitle}
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        <button
          onClick={() => setMobileMenuOpen((value) => !value)}
          className="md:hidden p-2 text-[#3e4947] hover:bg-[#e4f7ff] rounded-full transition-all"
          aria-label={copy.menuLabel}
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

function LanguageToggle({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[#bdc9c7] bg-[#f7fbfb] p-1 shadow-sm" aria-label="Language">
      {(["it", "en"] as const).map((option) => {
        const active = language === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => setLanguage(option)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-mono text-[10px] font-black uppercase tracking-wider transition-all ${
              active ? "bg-[#031f27] text-white shadow-sm" : "text-[#3e4947] hover:text-[#00605b]"
            }`}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
