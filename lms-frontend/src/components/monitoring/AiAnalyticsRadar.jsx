import React, { useEffect, useState } from 'react';
import { Cpu, ShieldCheck, BrainCircuit, Activity } from 'lucide-react';
import { aiApi } from '../../services/api';

/**
 * Engagement and integrity summary for one student.
 *
 * Both figures are computed server-side from recorded telemetry. Where the
 * server returns null it means nothing was measured, and that is displayed as
 * such — this panel previously showed fixed numbers (2.4° yaw, 88% focused,
 * 98.5% integrity) that were never read from anywhere.
 */
export const AiAnalyticsRadar = ({ studentId, attemptId }) => {
  const [analysis, setAnalysis] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    aiApi
      .predictRisk(studentId)
      .then((res) => setAnalysis(res.data))
      .catch(() => setError('Could not load engagement summary.'));
  }, [studentId]);

  useEffect(() => {
    if (!attemptId) return;
    aiApi
      .evaluateIntegrity(attemptId)
      .then((res) => setIntegrity(res.data))
      .catch(() => setError('Could not load integrity summary.'));
  }, [attemptId]);

  const num = (v, suffix = '') =>
    typeof v === 'number' ? `${v}${suffix}` : 'not measured';

  const riskColor =
    analysis?.riskLevel === 'HIGH' ? 'text-rose-400'
      : analysis?.riskLevel === 'MEDIUM' ? 'text-amber-400'
      : analysis?.riskLevel === 'LOW' ? 'text-emerald-400'
      : 'text-slate-500';

  return (
    <div className="p-5 rounded-2xl glass-card border border-indigo-500/30 space-y-5 bg-gradient-to-br from-slate-900/90 via-indigo-950/20 to-slate-950">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Engagement &amp; integrity summary</h3>
            <span className="text-[11px] text-slate-400">
              Computed from recorded attention samples and tab-switch events
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" /> Engagement trend
            </span>
            <span className={`font-mono font-bold ${riskColor}`}>
              {analysis?.riskLevel ?? '—'}
            </span>
          </div>
          <div className="pt-1 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Smoothed average</span>
              <span className="font-mono font-bold text-slate-200">
                {num(analysis?.overallEngagementScore, '%')}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              {typeof analysis?.overallEngagementScore === 'number' ? (
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${analysis.overallEngagementScore}%` }}
                />
              ) : (
                <div className="h-full w-full border border-dashed border-slate-700 rounded-full" />
              )}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Alerts raised
            </span>
            <span className="font-mono text-purple-300 font-bold">
              {analysis?.alertCount ?? '—'}
            </span>
          </div>
          <div className="flex justify-between text-[11px] pt-1">
            <span className="text-slate-400">Low-attention samples</span>
            <span className="text-slate-200 font-mono font-bold">
              {analysis?.lowAttentionFrequency ?? '—'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Exam integrity
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {num(integrity?.integrityConfidenceScore, '%')}
            </span>
          </div>
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Tab switches</span>
              <span className="text-slate-200 font-mono font-bold">
                {integrity?.tabSwitches ?? '—'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              {typeof integrity?.integrityConfidenceScore === 'number' ? (
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                  style={{ width: `${integrity.integrityConfidenceScore}%` }}
                />
              ) : (
                <div className="h-full w-full border border-dashed border-slate-700 rounded-full" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Flags come from the server's evaluation, including the case where
          attention was never measured at all. */}
      {integrity?.flaggedAnomalies?.length > 0 && (
        <ul className="space-y-1">
          {integrity.flaggedAnomalies.map((flag, i) => (
            <li key={i} className="text-[11px] text-amber-300 flex gap-2">
              <span>•</span><span>{flag}</span>
            </li>
          ))}
        </ul>
      )}

      {analysis?.recommendation && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs flex items-center gap-3">
          <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <span className="font-bold text-indigo-300 block">Suggested action (rule-based):</span>
            <span className="text-slate-300 leading-tight">{analysis.recommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
};
