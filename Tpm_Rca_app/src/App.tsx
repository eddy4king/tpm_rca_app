import { useState } from "react";
import EquipmentPage from "./pages/EquipmentPage";

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">TPM-RCA Pro</h1>
      </nav>
      <main className="p-6">
        <EquipmentPage />
      </main>
    </div>
  );
}

export default App;