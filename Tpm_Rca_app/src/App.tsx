import { useState, useEffect } from "react";
import EquipmentPage from "./pages/EquipmentPage";
import DowntimePage from "./pages/DowntimePage";
import RcaPage from "./pages/RcaPage";
import CAPAPage from "./pages/CAPAPage";
import TPMDashboard from "./pages/TPMDashboard";

type Page = "equipment" | "downtime" | "rca" | "capa"| "tpm";

function App() {
  const [activePage, setActivePage] = useState<Page>("equipment");

  // Optional: Persist last visited page
  useEffect(() => {
    const savedPage = localStorage.getItem("activePage") as Page | null;
    if (savedPage && ["equipment", "downtime", "rca", "capa", "tpm"].includes(savedPage)) {
      setActivePage(savedPage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("activePage", activePage);
  }, [activePage]);

  const navItems = [
    { key: "equipment", label: "Equipment" },
    { key: "downtime", label: "Downtime" },
    { key: "rca", label: "RCA" },
    { key: "capa", label: "CAPA" },
    { key: "tpm", label: "TPM"}
  ] as const;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-slate-800 text-white px-6 py-4 flex items-center gap-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold tracking-tight">TPM-RCA Pro</h1>

        <div className="flex gap-1">
          {navItems.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActivePage(key)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                activePage === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "hover:bg-slate-700 text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        {activePage === "equipment" && <EquipmentPage />}
        {activePage === "downtime" && <DowntimePage />}
        {activePage === "rca" && <RcaPage />}
        {activePage === "capa" && <CAPAPage />}
        {activePage === "tpm" && <TPMDashboard/>}
      </main>
    </div>
  );
}

export default App;