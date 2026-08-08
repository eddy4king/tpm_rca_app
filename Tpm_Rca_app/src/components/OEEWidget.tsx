import React, { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface OEEData {
  has_production_data?: boolean;
  availability: number;
  performance: number;
  quality: number;
  oee?: number;
}

export const OEEWidget: React.FC = () => {
  const [oee, setOEE] = useState<OEEData | null>(null);

  useEffect(() => {
    // Call backend to get OEE percentages (0‑100). OEE = Availability ×
    // Performance × Quality; performance/quality come from captured
    // production logs, falling back to availability-only until data exists.
    invoke<OEEData>('get_oee_metrics')
      .then(setOEE)
      .catch(() => setOEE({ availability: 0, performance: 0, quality: 0, oee: 0 }));
  }, []);

  if (!oee) return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse text-slate-400 text-sm">
      Loading OEE…
    </div>
  );

  const overall = (oee.oee ?? (oee.availability * oee.performance * oee.quality) / 10000).toFixed(1);

  const metrics = [
    { label: "Availability", value: oee.availability, color: "text-blue-600" },
    { label: "Performance", value: oee.performance, color: "text-emerald-600" },
    { label: "Quality", value: oee.quality, color: "text-amber-600" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-slate-500" />
        <h3 className="font-bold text-slate-800">Overall Equipment Effectiveness</h3>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-medium text-slate-500">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}%</p>
          </div>
        ))}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
          <p className="text-xs font-medium text-blue-600">Overall</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">{overall}%</p>
        </div>
      </div>
      {!oee.has_production_data && (
        <p className="text-xs text-slate-400 mt-3">
          Availability-only estimate — log production runs (OEE page) for real Performance &amp; Quality.
        </p>
      )}
    </div>
  );
};
