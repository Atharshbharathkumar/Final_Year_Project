import React from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const AttentionMeter = ({ score = null, label = "Attention Level", compact = false }) => {
  // score === null means not measured. Render that state explicitly rather than
  // defaulting to a healthy-looking number.
  const hasScore = typeof score === 'number' && Number.isFinite(score);

  if (!hasScore) {
    return (
      <div className={compact ? "w-full space-y-1" : "p-4 rounded-xl glass-card space-y-3"}>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500 flex items-center gap-1 font-medium">
            <Activity className="w-3 h-3 text-slate-600" /> {label}
          </span>
          <span className="font-bold font-mono text-slate-500">not measured</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden border border-dashed border-slate-700" />
      </div>
    );
  }

  const roundedScore = Math.round(score);

  let colorClass = "from-emerald-500 to-teal-400";
  let bgGlow = "shadow-emerald-500/20";
  let statusText = "High Engagement";
  let statusColor = "text-emerald-400";

  if (roundedScore < 40) {
    colorClass = "from-rose-600 to-red-500";
    bgGlow = "shadow-rose-500/20";
    statusText = "Critical Low";
    statusColor = "text-rose-400";
  } else if (roundedScore < 70) {
    colorClass = "from-amber-500 to-yellow-400";
    bgGlow = "shadow-amber-500/20";
    statusText = "Distracted";
    statusColor = "text-amber-400";
  }

  if (compact) {
    return (
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400 flex items-center gap-1 font-medium">
            <Activity className="w-3 h-3 text-indigo-400" /> {label}
          </span>
          <span className={`font-bold font-mono ${statusColor}`}>{roundedScore}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500 ease-out`}
            style={{ width: `${roundedScore}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl glass-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</h4>
            <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-extrabold font-mono ${statusColor}`}>{roundedScore}%</span>
        </div>
      </div>

      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500 shadow-md ${bgGlow}`}
          style={{ width: `${roundedScore}%` }}
        />
      </div>
    </div>
  );
};
