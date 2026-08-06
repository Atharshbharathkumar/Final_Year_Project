import React, { useEffect, useState } from 'react';
import { parentApi } from '../services/api';
import { Users, CalendarCheck, Trophy, ClipboardList, ShieldCheck } from 'lucide-react';

/**
 * Guardian view. Shows aggregate progress per linked child.
 *
 * Deliberately excludes live camera feeds, per-frame attention samples and
 * proctoring snapshots. Reporting on progress is a different thing from handing
 * a third party the surveillance stream.
 */
export const ParentDashboard = () => {
  const [children, setChildren] = useState([]);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    parentApi.getChildren()
      .then((res) => {
        const kids = res.data || [];
        setChildren(kids);
        return Promise.all(
          kids.map((k) =>
            parentApi.getChildReport(k.id)
              .then((r) => [k.id, r.data])
              .catch(() => [k.id, null])
          )
        );
      })
      .then((pairs) => {
        setReports(Object.fromEntries(pairs || []));
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load your children’s records.');
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" /> Your children
        </h1>
        <p className="text-xs text-slate-400">
          Attendance, achievements and assignment marks
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {error}
        </div>
      )}

      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          You can see progress summaries only. Live camera feeds and individual
          monitoring samples are not shared with guardians.
        </span>
      </div>

      {children.length === 0 && !error && (
        <div className="p-12 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No children linked to your account</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A teacher or administrator must link your account to a student before
            any records appear here.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {children.map((child) => {
          const r = reports[child.id];
          return (
            <div key={child.id} className="p-5 rounded-2xl glass-card border border-dark-border space-y-4">
              <div className="flex items-center gap-3">
                {child.avatarUrl ? (
                  <img src={child.avatarUrl} alt={child.fullName} className="w-12 h-12 rounded-2xl border-2 border-indigo-500/40" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-center text-sm font-bold text-slate-300">
                    {child.fullName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-100">{child.fullName}</h2>
                  <p className="text-[11px] text-slate-500 font-mono">{child.email}</p>
                </div>
              </div>

              {!r ? (
                <p className="text-xs text-slate-500">Report unavailable.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat
                    icon={CalendarCheck}
                    label="Attendance"
                    value={r.attendance?.attendancePercentage != null
                      ? `${r.attendance.attendancePercentage}%`
                      : 'no records'}
                    sub={`${r.attendance?.present ?? 0} present · ${r.attendance?.absent ?? 0} absent`}
                  />
                  <Stat
                    icon={Trophy}
                    label="Achievements"
                    value={r.achievements?.total ?? 0}
                    sub={`${r.achievements?.totalPoints ?? 0} points`}
                  />
                  <Stat
                    icon={ClipboardList}
                    label="Graded work"
                    value={r.gradedAssignments ?? 0}
                    sub="assignments marked"
                  />
                  <Stat
                    icon={ClipboardList}
                    label="Average mark"
                    value={r.averageMarkPercent != null ? `${r.averageMarkPercent}%` : 'not graded yet'}
                    sub="across graded work"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, sub }) => (
  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>
      <Icon className="w-3.5 h-3.5 text-indigo-400" />
    </div>
    <p className="text-xl font-extrabold font-mono text-slate-100">{value}</p>
    <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
  </div>
);
