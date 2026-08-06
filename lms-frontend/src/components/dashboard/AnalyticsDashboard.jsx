import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Cell
} from 'recharts';
import { TrendingUp, Users, AlertTriangle, Activity, Brain } from 'lucide-react';
import { monitoringApi } from '../../services/api';

/**
 * Session analytics derived entirely from recorded AttentionLog rows.
 *
 * Every chart here is computed from `logs`. Nothing is generated, mocked or
 * randomised — an empty session renders an empty state rather than a plausible
 * looking one.
 */
export const AnalyticsDashboard = ({ sessionId = 1, contextType = 'CLASSROOM' }) => {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      monitoringApi.getAttentionLogs(sessionId, contextType),
      monitoringApi.getAlerts(sessionId, contextType),
    ])
      .then(([logRes, alertRes]) => {
        if (cancelled) return;
        setLogs(logRes.data || []);
        setAlerts(alertRes.data || []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load session analytics from the server.');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, contextType]);

  const scored = useMemo(
    () => logs.filter((l) => typeof l.score === 'number'),
    [logs]
  );

  // Mean attention per minute bucket, from real timestamps.
  const trend = useMemo(() => {
    const buckets = new Map();
    scored.forEach((log) => {
      const key = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(log.score);
    });
    return Array.from(buckets.entries()).map(([time, scores]) => ({
      time,
      attention: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      samples: scores.length,
    }));
  }, [scored]);

  // Mean attention per student, from real logs.
  const perStudent = useMemo(() => {
    const byStudent = new Map();
    scored.forEach((log) => {
      const name = log.student?.fullName;
      if (!name) return;
      if (!byStudent.has(name)) byStudent.set(name, []);
      byStudent.get(name).push(log.score);
    });
    return Array.from(byStudent.entries())
      .map(([name, scores]) => {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          name,
          mean: Math.round(mean),
          samples: scores.length,
          risk: mean < 50 ? 'HIGH' : mean < 75 ? 'MEDIUM' : 'LOW',
        };
      })
      .sort((a, b) => a.mean - b.mean);
  }, [scored]);

  const overallMean = scored.length
    ? Math.round((scored.reduce((a, l) => a + l.score, 0) / scored.length) * 10) / 10
    : null;

  const distinctStudents = new Set(logs.map((l) => l.student?.id).filter(Boolean)).size;

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-400">Loading session analytics…</div>;
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-sm font-semibold text-rose-200">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-12 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
        <Brain className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm font-semibold text-slate-300">No samples recorded for this session</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Analytics appear once students join with camera access granted and the face
          model loaded. Nothing is shown until there is something measured.
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Mean attention',
      value: overallMean !== null ? `${overallMean}%` : 'not measured',
      icon: Activity,
      sub: `${scored.length} measured samples`,
    },
    {
      label: 'Students reporting',
      value: String(distinctStudents),
      icon: Users,
      sub: `${logs.length} total samples`,
    },
    {
      label: 'Alerts raised',
      value: String(alerts.length),
      icon: AlertTriangle,
      sub: alerts.length ? `latest ${new Date(alerts[0].timestamp).toLocaleTimeString()}` : 'none',
    },
    {
      label: 'Students at risk',
      value: String(perStudent.filter((s) => s.risk !== 'LOW').length),
      icon: TrendingUp,
      sub: 'mean attention below 75%',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="p-4 rounded-2xl glass-card border border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">{label}</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold font-mono text-slate-100">{value}</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 block">{sub}</span>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            Mean attention over time
          </h3>
          <p className="text-xs text-slate-400">
            Each point is the average of the samples recorded in that minute.
          </p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="attnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#131b2e', borderColor: '#1f293d', borderRadius: '10px', color: '#f8fafc', fontSize: '11px' }} />
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Attention threshold', fill: '#f59e0b', fontSize: 10 }} />
              <Area type="monotone" dataKey="attention" stroke="#6366f1" strokeWidth={3} fill="url(#attnGrad)" dot={{ fill: '#6366f1', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Mean attention per student
        </h3>
        {perStudent.length > 0 ? (
          <div style={{ height: Math.max(160, perStudent.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perStudent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: '#131b2e', borderColor: '#1f293d', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="mean" name="Mean attention" radius={[0, 4, 4, 0]}>
                  {perStudent.map((s, i) => (
                    <Cell key={i} fill={s.risk === 'HIGH' ? '#ef4444' : s.risk === 'MEDIUM' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-6 text-center">
            Samples were recorded but none carried a measured score.
          </p>
        )}
      </div>
    </div>
  );
};
