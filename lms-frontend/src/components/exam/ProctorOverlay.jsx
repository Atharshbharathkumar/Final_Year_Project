import React, { useState, useEffect } from 'react';
import { Lock, Maximize2, ShieldAlert, AlertOctagon, Eye } from 'lucide-react';

export const ProctorOverlay = ({
  tabSwitchCount = 0,
  maxTabSwitches = 3,
  onFullscreenRequest,
  isFullscreen = false,
}) => {
  const remainingSwitches = Math.max(0, maxTabSwitches - tabSwitchCount);
  const isDanger = remainingSwitches <= 1;

  return (
    <div className="bg-slate-900/90 border-b border-dark-border px-6 py-3 flex items-center justify-between sticky top-16 z-30 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">Lockdown Proctor Active</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Strict Exam Rules
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Tab switching monitored • Random camera snapshots active
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Tab switch counter indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDanger
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-amber-400" />
          <span>
            Tab Switches: <strong className="text-white font-mono">{tabSwitchCount}</strong> / {maxTabSwitches}
          </span>
        </div>

        {!isFullscreen && (
          <button
            onClick={onFullscreenRequest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Enable Fullscreen</span>
          </button>
        )}
      </div>
    </div>
  );
};
