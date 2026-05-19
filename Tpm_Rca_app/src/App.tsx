import { useState } from "react";
import EquipmentPage from "./pages/EquipmentPage";
import DowntimePage from "./pages/DowntimePage";
import RcaPage from "./pages/RcaPage";

function App() {
  const [activePage, setActivePage] = useState("equipment");

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-slate-800 text-white px-6 py-4 flex items-center gap-6">
        <h1 className="text-xl font-bold mr-6">TPM-RCA Pro</h1>
        <button
          onClick={() => setActivePage("equipment")}
          className={`px-3 py-1 rounded ${activePage === "equipment" ? "bg-slate-600" : "hover:bg-slate-700"}`}
        >
          Equipment
        </button>
        <button
          onClick={() => setActivePage("downtime")}
          className={`px-3 py-1 rounded ${activePage === "downtime" ? "bg-slate-600" : "hover:bg-slate-700"}`}
        >
          Downtime
        </button>
        <button
          onClick={() => setActivePage("rca")}
          className={`px-3 py-1 rounded ${activePage === "rca" ? "bg-slate-600" : "hover:bg-slate-700"}`}
        >
          RCA
        </button>
      </nav>
      <main className="p-6">
        {activePage === "equipment" && <EquipmentPage />}
        {activePage === "downtime" && <DowntimePage />}
        {activePage === "rca" && <RcaPage />}
      </main>
    </div>
  );
}

export default App;