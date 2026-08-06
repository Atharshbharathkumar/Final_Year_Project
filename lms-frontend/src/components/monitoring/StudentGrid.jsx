import React, { useEffect, useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area
} from 'recharts';
import { Brain, Activity, TrendingUp, Zap, Users } from 'lucide-react';
import { monitoringApi } from '../../services/api';
import websocketService from '../../services/websocket';

/**
 * Live engagement grid for a teacher.
 *
 * Every value shown here comes from an AttentionLog the server recorded, either
 * fetched on mount or pushed over STOMP. There is no simulated drift and no
 * placeholder roster: a student appears only once they have sent a real sample.
 */
export const StudentGrid = ({ sessionId = 1, contextType = 'CLASSROOM' }) => {
  const [studentStates, setStudentStates] = useState({});
  const [history, setHistory] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const riskFor = (score) => {
    if (typeof score !== 'number') return 'UNKNOWN';
    if (score < 50) return 'HIGH';
    if (score < 75) return 'MEDIUM';
    return 'LOW';
  };

  useEffect(() => {
    let cancelled = false;

    // Seed from the logs already recorded for this session.
    monitoringApi
      .getAttentionLogs(sessionId, contextType)
      .then((res) => {
        if (cancelled) return;
        const states = {};
        const series = {};

        (res.data || []).forEach((log) => {
          const id = log.student?.id;
          if (!id) return;

          states[id] = {
            studentId: id,
            name: log.student.fullName,
            avatar: log.student.avatarUrl,
            score: log.score,
            faceDetected: log.faceDetected,
            faceCount: log.faceCount,
            eyeStatus: log.eyeStatus,
            isTabActive: log.isTabActive,
            riskLevel: riskFor(log.score),
            lastUpdated: log.timestamp,
          };

          if (typeof log.score === 'number') {
            if (!series[id]) series[id] = [];
            series[id].push({ t: new Date(log.timestamp).toLocaleTimeString(), score: log.score });
          }
        });

        setStudentStates(states);
        setHistory(series);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Could not reach the monitoring service. No live data is being shown.');
        setLoading(false);
      });

    // Live updates. The server broadcasts here after persisting each sample.
    const topic = `/topic/monitoring/${contextType}/${sessionId}`;
    websocketService.subscribe(topic, (data) => {
      if (!data?.studentId) return;

      setStudentStates((prev) => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          studentId: data.studentId,
          name: data.studentName || prev[data.studentId]?.name || `Student ${data.studentId}`,
          avatar: prev[data.studentId]?.avatar,
          score: data.score,
          faceDetected: data.faceDetected,
          faceCount: data.faceCount,
          eyeStatus: data.eyeStatus,
          isTabActive: data.isTabActive,
          riskLevel: riskFor(data.score),
          lastUpdated: data.timestamp,
        },
      }));

      if (typeof data.score === 'number') {
        setHistory((prev) => {
          const next = [...(prev[data.studentId] || []), {
            t: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
            score: data.score,
          }];
          return { ...prev, [data.studentId]: next.slice(-30) };
        });
      }
    });

    return () => {
      cancelled = true;
      websocketService.unsubscribe(topic);
    };
  }, [sessionId, contextType]);

  const students = Object.values(studentStates);
  const selected = selectedStudentId ? studentStates[selectedStudentId] : null;

  const getRadarData = (s) => [
    { subject: 'Attention', value: typeof s.score === 'number' ? s.score : 0 },
    { subject: 'Eye focus', value: s.eyeStatus === 'CENTER' ? 95 : s.eyeStatus ? 40 : 0 },
    { subject: 'Tab focus', value: s.isTabActive === false ? 20 : s.isTabActive ? 90 : 0 },
    { subject: 'Integrity', value: s.faceCount > 1 ? 10 : s.faceCount === 1 ? 95 : 0 },
    { subject: 'Presence', value: s.faceDetected ? 100 : 0 },
  ];

  const getRiskColor = (risk) => {
    if (risk === 'HIGH') return { border: 'border-rose-500/60', bg: 'bg-rose-950/30', badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
    if (risk === 'MEDIUM') return { border: 'border-amber-500/50', bg: 'bg-amber-950/20', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
    if (risk === 'UNKNOWN') return { border: 'border-slate-700', bg: '', badge: 'bg-slate-700/30 text-slate-400 border border-slate-600/40' };
    return { border: 'border-dark-border', bg: '', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' };
  };

  const atRisk = students.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'MEDIUM').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <span>Live student engagement</span>
          </h3>
          <p className="text-xs text-slate-400">
            Recorded attention samples · face presence · tab focus · pushed over STOMP
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${students.length ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            {students.length} reporting
          </span>
          {atRisk > 0 && (
            <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400">
              {atRisk} at risk
            </span>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="p-10 text-center text-sm text-slate-400">Loading recorded samples…</div>
      )}

      {!loading && !loadError && students.length === 0 && (
        <div className="p-10 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No students are reporting yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A student appears here once their browser sends an attention sample. That requires
            them to join this session with camera access granted and the face model loaded.
          </p>
        </div>
      )}

      {/* Student Cards Grid */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((state) => {
            const colors = getRiskColor(state.riskLevel);
            const hasScore = typeof state.score === 'number';

            return (
              <div
                key={state.studentId}
                onClick={() => setSelectedStudentId(state.studentId)}
                className={`p-4 rounded-2xl glass-card border cursor-pointer transition-all duration-200 group ${colors.border} ${colors.bg} hover:scale-[1.02]`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {state.avatar ? (
                        <img src={state.avatar} alt={state.name} className="w-10 h-10 rounded-full border-2 border-slate-700 bg-slate-800" />
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                          {state.name?.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-bg ${
                        state.faceDetected === true ? 'bg-emerald-400' : state.faceDetected === false ? 'bg-rose-500' : 'bg-slate-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 leading-tight">{state.name}</h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                        {state.riskLevel === 'UNKNOWN' ? 'NOT MEASURED' : `${state.riskLevel} RISK`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {hasScore ? (
                      <span className={`text-xl font-extrabold font-mono ${state.score >= 75 ? 'text-emerald-400' : state.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {Math.round(state.score)}%
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">no data</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {state.faceDetected === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">NO FACE</span>}
                  {state.faceCount > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white">MULTI-FACE</span>}
                  {state.isTabActive === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">TAB OFF</span>}
                  {state.eyeStatus === 'LOOKING_AWAY' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-500/30">GAZE AWAY</span>
                  )}
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  {hasScore ? (
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${state.score >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : state.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-rose-600 to-red-500'}`}
                      style={{ width: `${state.score}%` }}
                    />
                  ) : (
                    <div className="h-full w-full border border-dashed border-slate-700 rounded-full" />
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between text-[10px] text-slate-400">
                  <span>
                    {state.lastUpdated ? `Last sample ${new Date(state.lastUpdated).toLocaleTimeString()}` : 'Awaiting sample'}
                  </span>
                  <Zap className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl glass-card p-6 rounded-3xl border border-indigo-500/40 space-y-5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selected.avatar ? (
                  <img src={selected.avatar} alt={selected.name} className="w-14 h-14 rounded-2xl border-2 border-indigo-500/40" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl border-2 border-indigo-500/40 bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                    {selected.name?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-slate-100">{selected.name}</h3>
                  <p className="text-xs text-indigo-400 font-mono flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" /> Recorded engagement detail
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedStudentId(null)} className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" /> Latest sample breakdown
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={getRadarData(selected)}>
                    <PolarGrid stroke="#1f293d" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} />
                    <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Recorded attention history
                </h4>
                {(history[selected.studentId]?.length ?? 0) > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={history[selected.studentId]}>
                      <defs>
                        <linearGradient id="attnGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                      <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#131b2e', borderColor: '#1f293d', borderRadius: '8px', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#attnGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-xs text-slate-500 text-center px-4">
                    Not enough samples recorded yet to plot a trend.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: 'Latest score', value: typeof selected.score === 'number' ? `${Math.round(selected.score)}%` : 'not measured' },
                { label: 'Risk level', value: selected.riskLevel },
                { label: 'Samples recorded', value: String(history[selected.studentId]?.length ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <p className="text-slate-400 mb-1">{label}</p>
                  <p className="font-extrabold font-mono text-lg text-indigo-300">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
