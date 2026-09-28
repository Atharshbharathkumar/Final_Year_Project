import React, { useState, useCallback } from 'react';
import { GlassCard, Badge, Button, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import {
  Brain, AlertTriangle, Eye, Activity, MonitorSmartphone, Target,
  Users, Maximize, ShieldAlert, CheckCircle2, BarChart3
} from 'lucide-react';
import { classroomApi } from '../services/api';
import { usePolledApi, useApi } from '../hooks/useApi';
import { useLiveAlerts } from '../hooks/useLiveAlerts';

const AIMonitoringPage = () => {
  const [activeTab, setActiveTab] = useState('live');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchLive = useCallback(() => classroomApi.live(), []);
  const fetchReport = useCallback(() => classroomApi.report(), []);

  // The participant grid refreshes on an interval while a session is running.
  const { data: live, loading, error, refetch } = usePolledApi(fetchLive, 10000, []);
  const { data: report } = useApi(fetchReport, []);
  const { alerts } = useLiveAlerts({ limit: 8 });

  if (loading && !live) return <LoadingState label="Connecting to the live session…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const info = live?.classInfo;
  const analysis = live?.analysis;
  const participants = (live?.participants || []).filter(p => p.status !== 'not-detected');

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">AI Classroom Intelligence</h1>
            {info?.active
              ? <Badge variant="brand" className="animate-pulse">🔴 Live</Badge>
              : <Badge variant="warning">Session ended</Badge>}
          </div>
          <p className="text-sm text-slate-400">{info?.subject} — {info?.topic}</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-dark-bg/50 rounded-xl border border-dark-border">
          <button onClick={() => setActiveTab('live')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'live' ? 'bg-dark-card text-white shadow' : 'text-slate-400 hover:text-white'}`}>Live Feed</button>
          <button onClick={() => setActiveTab('analytics')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'bg-dark-card text-white shadow' : 'text-slate-400 hover:text-white'}`}>Analytics</button>
        </div>
      </div>

      {activeTab === 'live' ? (
        <div className="grid xl:grid-cols-4 gap-6">
          {/* Participant grid */}
          <div className={`xl:col-span-3 space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-dark-bg p-4 flex flex-col' : ''}`}>
            <GlassCard hover={false} className={`flex-1 flex flex-col ${isFullscreen ? 'h-full' : ''}`} padding="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1"><Users size={14} className="text-brand-400" /> {info?.attendees ?? 0}/{info?.total ?? 0} Online</span>
                  <span className="flex items-center gap-1"><Eye size={14} className="text-violet-400" /> {analysis?.faceVerified ?? 0} Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">{info?.duration}</span>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg bg-dark-bg hover:bg-dark-border text-slate-400">
                    <Maximize size={14} />
                  </button>
                </div>
              </div>

              {participants.length === 0 ? (
                <EmptyState icon={Users} title="No participants detected" description="Nobody has produced attention telemetry for this session yet." />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-[400px]">
                  {participants.map((p) => (
                    <div key={p.id} className={`relative rounded-xl overflow-hidden border-2 transition-colors min-h-[150px] ${
                      p.status === 'away' ? 'border-rose-500/50 bg-rose-500/5' :
                      p.status === 'attention-shift' ? 'border-amber-500/50 bg-amber-500/5' :
                      'border-dark-border bg-dark-bg'
                    }`}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {p.status === 'away' ? (
                          <div className="text-center">
                            <AlertTriangle size={32} className="text-rose-500 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-rose-400">No Face Detected</p>
                          </div>
                        ) : (
                          <Users size={48} className="text-slate-700" />
                        )}
                      </div>

                      {p.status !== 'away' && (
                        <>
                          <div className="absolute inset-0 border border-emerald-500/30 rounded-lg m-8 pointer-events-none border-dashed" />
                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-dark-bg/80 text-white backdrop-blur flex items-center gap-1">
                              {p.verified ? <CheckCircle2 size={10} className="text-emerald-400" /> : <AlertTriangle size={10} className="text-rose-400" />}
                              {p.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-brand-500/20 text-brand-300 backdrop-blur w-fit">
                              {p.attentionScore}% attention
                            </span>
                          </div>
                          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end gap-1">
                            <div className="flex flex-col gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-dark-bg/80 text-slate-300 backdrop-blur">Pose: {p.headPose}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-dark-bg/80 text-slate-300 backdrop-blur">Gaze: {p.gazeDirection}</span>
                            </div>
                            {p.status === 'attention-shift' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500 text-amber-950 font-bold animate-pulse">ATTENTION SHIFT</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {isFullscreen && (
              <div className="flex justify-center mt-4">
                <Button variant="secondary" onClick={() => setIsFullscreen(false)}>Exit Fullscreen</Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {!isFullscreen && (
            <div className="space-y-4">
              <GlassCard hover={false} padding="p-4" className="sticky top-20">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-border">
                  <Brain size={18} className="text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Live AI Analysis</h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">Overall Focus</span>
                      <span className="text-xs font-bold text-emerald-400">{analysis?.overallFocus ?? 0}%</span>
                    </div>
                    <ProgressBar value={analysis?.overallFocus ?? 0} color="from-emerald-500 to-teal-500" showValue={false} height="h-1.5" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400">Class Participation</span>
                      <span className="text-xs font-bold text-brand-400">{analysis?.participationLabel}</span>
                    </div>
                    <ProgressBar value={analysis?.participation ?? 0} color="from-brand-500 to-indigo-500" showValue={false} height="h-1.5" />
                  </div>

                  <div className="pt-2">
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Real-time Observations</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-dark-bg border border-dark-border">
                        <div className="flex items-center gap-2">
                          <Eye size={14} className="text-emerald-400" />
                          <span className="text-xs text-slate-300">Face Verified</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{analysis?.faceVerified ?? 0}/{info?.total ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <Target size={14} className="text-amber-400" />
                          <span className="text-xs text-amber-300">Attention Shift</span>
                        </div>
                        <span className="text-xs font-semibold text-amber-400">{analysis?.attentionShifts ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                        <div className="flex items-center gap-2">
                          <ShieldAlert size={14} className="text-rose-400" />
                          <span className="text-xs text-rose-300">Away from Frame</span>
                        </div>
                        <span className="text-xs font-semibold text-rose-400">{analysis?.awayFromFrame ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Latest Alerts</h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {alerts.length === 0 ? (
                        <p className="text-[11px] text-slate-500 text-center py-3">No alerts raised.</p>
                      ) : alerts.slice(0, 5).map(a => (
                        <div key={a.id} className="p-2 rounded-lg bg-dark-bg border border-dark-border">
                          <p className="text-[11px] font-medium text-white truncate">{a.studentName}</p>
                          <p className="text-[10px] text-slate-400">{a.alertType?.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                    <p className="text-[10px] text-brand-300 leading-relaxed text-center">
                      AI observations are indicators. Use your professional judgment for student assessment.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-white mb-4">Overall Engagement Metrics</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-1 text-slate-300">Average Focus Time</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-emerald-400">{analysis?.avgFocusMinutes ?? 0}</span>
                  <span className="text-sm text-slate-400">mins / {analysis?.sessionMinutes ?? 0} mins</span>
                </div>
                <ProgressBar
                  value={analysis?.sessionMinutes ? Math.round((analysis.avgFocusMinutes / analysis.sessionMinutes) * 100) : 0}
                  color="from-emerald-500 to-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-dark-bg border border-dark-border text-center">
                  <Activity size={20} className="text-brand-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Participation</p>
                  <p className="text-lg font-bold text-white mt-1">{analysis?.participationLabel}</p>
                </div>
                <div className="p-3 rounded-xl bg-dark-bg border border-dark-border text-center">
                  <MonitorSmartphone size={20} className="text-violet-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Course-Related Screen</p>
                  <p className="text-lg font-bold text-white mt-1">{live?.screenActivity?.courseRelated ?? 0}%</p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-white mb-4">Session Report Summary</h3>
            {report?.insights?.length ? (
              <div className="space-y-2">
                {report.insights.map((insight, i) => (
                  <div key={i} className={`p-3 rounded-xl border flex gap-3 ${
                    insight.type === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20' :
                    insight.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-dark-bg border-dark-border'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {insight.type === 'positive' ? <Target size={16} className="text-emerald-400" /> :
                        insight.type === 'warning' ? <ShieldAlert size={16} className="text-amber-400" /> :
                        <Brain size={16} className="text-slate-400" />}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{insight.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-dark-bg border border-dark-border rounded-xl p-4 flex items-center justify-center min-h-[200px]">
                <div className="text-center space-y-3">
                  <BarChart3 size={32} className="text-brand-400 mx-auto opacity-50" />
                  <p className="text-sm text-slate-400">No telemetry recorded for this session yet.</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default AIMonitoringPage;