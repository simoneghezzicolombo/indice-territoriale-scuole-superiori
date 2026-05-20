import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { loadCitiesData } from "./data";
import { CityData, ViewType } from "./types";
import CompareView from "./components/CompareView";
import ExplorerView from "./components/ExplorerView";
import Footer from "./components/Footer";
import HomeView from "./components/HomeView";
import MethodologyView from "./components/MethodologyView";
import Navbar from "./components/Navbar";
import RankingsView from "./components/RankingsView";

export default function App() {
  const [currentView, setView] = useState<ViewType>("home");
  const [citiesData, setCitiesData] = useState<CityData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cityAName, setCityAName] = useState("Fossano");
  const [cityBName, setCityBName] = useState("Merate");
  const [selectedExplorerCityId, setSelectedExplorerCityId] = useState<string | null>(null);

  useEffect(() => {
    async function initData() {
      const data = await loadCitiesData();
      setCitiesData(data);
      setIsLoading(false);

      if (data.length >= 2) {
        setCityAName(data[0].name);
        setCityBName(data[1].name);
        setSelectedExplorerCityId(data[0].id);
      }
    }
    initData();
  }, []);

  const setSelectedCompareCity = (cityName: string, target: "A" | "B") => {
    if (target === "A") setCityAName(cityName);
    else setCityBName(cityName);
  };

  const openExplorerCity = (cityId: string) => {
    setSelectedExplorerCityId(cityId);
    setView("explorer");
  };

  const renderActiveView = () => {
    if (!citiesData) return null;

    switch (currentView) {
      case "home":
        return <HomeView setView={setView} citiesData={citiesData} />;
      case "explorer":
        return (
          <ExplorerView
            setView={setView}
            setSelectedCompareCity={setSelectedCompareCity}
            citiesData={citiesData}
            activeCityId={selectedExplorerCityId}
            setActiveCityId={setSelectedExplorerCityId}
          />
        );
      case "rankings":
        return (
          <RankingsView
            setView={setView}
            setSelectedCompareCity={setSelectedCompareCity}
            openExplorerCity={openExplorerCity}
            citiesData={citiesData}
          />
        );
      case "comparison":
        return (
          <CompareView
            cityAName={cityAName}
            cityBName={cityBName}
            setCityA={setCityAName}
            setCityB={setCityBName}
            openExplorerCity={openExplorerCity}
            citiesData={citiesData}
          />
        );
      case "methodology":
        return <MethodologyView />;
      default:
        return <HomeView setView={setView} citiesData={citiesData} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex flex-col justify-center items-center font-sans text-[#031f27]">
        <div className="text-center space-y-6 max-w-sm px-6">
          <div className="w-16 h-16 bg-[#00605b]/10 rounded-2xl flex items-center justify-center text-[#00605b] mx-auto animate-bounce shadow-sm border border-[#00605b]/20">
            <GraduationCap className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-tight">Caricamento dell'indice</h2>
            <p className="text-xs text-[#3e4947] opacity-80 leading-relaxed">
              Lettura dei dati comunali, delle coordinate e degli indirizzi scolastici coperti.
            </p>
          </div>
          <div className="w-full h-1.5 bg-[#f2fbff] rounded-full overflow-hidden border border-[#bdc9c7]/20 relative">
            <div className="absolute top-0 bottom-0 left-0 bg-[#00605b] rounded-full animate-[shimmer_1.5s_infinite] w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans selection:bg-[#00605b]/20 selection:text-[#00605b] text-[#031f27]">
      <Navbar currentView={currentView} setView={setView} />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-16 py-8 md:py-12">
        {renderActiveView()}
      </main>
      <Footer />
    </div>
  );
}
