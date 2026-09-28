import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatCard, GlassCard, ChartCard, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users, MonitorPlay, Activity, ClipboardCheck, FileText, Brain, AlertTriangle,
  ChevronRight, Search, SlidersHorizontal, Radio
} from 'lucide-react';
import { Button } from '../components/ui/Components';
import { StartSessionModal } from '../components/teacher/AuthoringModals';
import { dashboardApi, analyticsApi, classroomApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useLiveAlerts } from '../hooks/useLiveAlerts';
import { useCountUp } from '../hooks/useRealtime';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  const fetchStats = useCallback(() => dashboardApi.teacher(), []);
  const fetchTrend = useCallback(() => analyticsApi.weekly(), []);
  const fetchRoster = useCallback(() => analyticsApi.roster(), []);
  const fetchReport = useCallback(() => classroomApi.report(), []);

  const { data: stats, loading, error, refetch } = useApi(fetchStats, []);
  const { data: trend } = useApi(fetchTrend, [], { initialData: [] });
  const { data: roster } = useApi(fetchRoster, [], { initialData: [] });
  const { data: report } = useApi(fetchReport, []);
  const { alerts, connected } = useLiveAlerts({ limit: 12 });

  const totalStudents = useCountUp(stats?.totalStudents ?? 0, 1500, 0);
  const activeClasses = useCountUp(stats?.activeClasses ?? 0, 1500, 0);
  const attendanceRate = useCountUp(stats?.attendanceRate ?? 0, 1500, 0);
  const pendingReviews = useCountUp(stats?.pendingAssignments ?? 0, 1500, 0);

  if (loading) return <LoadingState label="Loading your cohort…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const filteredStudents = (roster || []).filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const atRiskStudents = filteredStudents.filter(s => s.risk === 'high');

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Welcome back, {user?.name || 'Teacher'}. Live overview of your active cohorts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            connected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {connected ? 'Live Alerts Connected' : 'Connecting…'}
          </div>
          <Button variant="primary" onClick={() => setSessionModalOpen(true)}
            className="flex items-center gap-2 shrink-0">
            <Radio size={16} /> Go Live
          </Button>
          <Link to="/ai-monitoring" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-dark-card border border-dark-border hover:bg-dark-cardHover transition-colors shrink-0 flex items-center gap-2">
            <Brain size={16} /> AI Monitoring
          </Link>
          <Link to="/grading" className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-dark-card border border-dark-border hover:bg-dark-cardHover transition-colors shrink-0">
            Grading
          </Link>
        </div>
      </div>

      <StartSessionModal
        isOpen={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        onCreated={refetch}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Students" value={totalStudents} color="brand" />
        <StatCard icon={MonitorPlay} label="Active Classes" value={activeClasses} color="violet" />
        <StatCard icon={Activity} label="Avg Engagement" value={stats?.avgEngagement ?? 0} suffix="%" color="emerald" />
        <StatCard icon={ClipboardCheck} label="Attendance Rate" value={attendanceRate} suffix="%" color="cyan" />
        <StatCard icon={FileText} label="Pending Reviews" value={pendingReviews} color="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <ChartCard title="Class Engagement Trend" subtitle="Cohort readings over the last 7 days" className="lg:col-span-2 relative">
          <div className="absolute top-5 right-5 flex gap-3">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-indigo-400"><span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> Engaged</span>
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Present</span>
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-violet-400"><span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" /> Active</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tEngGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tAttGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tPartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="engagement" stroke="#6366f1" fill="url(#tEngGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="attendance" stroke="#10b981" fill="url(#tAttGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="participation" stroke="#8b5cf6" fill="url(#tPartGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Live alert stream */}
        <GlassCard hover={false} className="flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center animate-pulse">
              <AlertTriangle size={14} className="text-rose-400" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-white mb-4">Live Proctoring Alerts</h3>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[300px]">
            {alerts.length === 0 ? (
              <EmptyState title="No alerts" description="Nothing has been flagged in your sessions." />
            ) : alerts.map(a => (
              <div key={a.id} className={`p-3 rounded-xl border transition-colors ${
                a.severity === 'CRITICAL' || a.severity === 'HIGH'
                  ? 'bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/10'
                  : 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-white truncate">{a.studentName}</p>
                  <Badge variant={a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'danger' : 'warning'}>
                    {a.alertType?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{a.message}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-4 text-center">Streamed over STOMP as the engine raises them.</p>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Student roster */}
        <GlassCard hover={false} padding="p-0" className="lg:col-span-2 flex flex-col">
          <div className="p-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border">
            <div>
              <h3 className="text-sm font-semibold text-white">Student Roster</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {atRiskStudents.length} of {filteredStudents.length} flagged at risk
              </p>
            </div>
            <div className="flex items-center gap-2 relative">
              <Search size={14} className="absolute left-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 w-full sm:w-48 transition-colors"
                title="Search roster"
              />
              <button className="p-1.5 rounded-lg bg-dark-bg border border-dark-border text-slate-400 hover:text-white transition-colors" title="Filter Roster">
                <SlidersHorizontal size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-bg/30">
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Student</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Dept</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">GPA</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">Engagement</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/50">
                {filteredStudents.slice(0, 6).map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl bg-dark-bg/50 w-9 h-9 rounded-lg flex items-center justify-center shrink-0">{s.avatar}</span>
                        <div>
                          <p className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">{s.name}</p>
                          <p className="text-[11px] text-slate-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[11px] font-medium text-slate-300 uppercase tracking-wider">{s.department}</td>
                    <td className="px-5 py-3 text-sm font-black text-white">{s.gpa}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full max-w-[80px] h-1.5 bg-dark-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            s.engagement >= 80 ? 'bg-emerald-500' : s.engagement >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                          }`} style={{ width: `${s.engagement}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-white tabular-nums">{s.engagement}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={s.risk === 'low' ? 'success' : s.risk === 'medium' ? 'warning' : 'danger'}>
                        {s.risk === 'low' ? 'Good' : s.risk === 'medium' ? 'Monitor' : 'At Risk'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">
                {searchTerm ? `No students found matching "${searchTerm}"` : 'No students enrolled in your courses yet.'}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-dark-border text-center">
            <Link to="/engagement" className="text-xs font-medium text-brand-400 hover:text-brand-300">View Complete Roster →</Link>
          </div>
        </GlassCard>

        {/* Session insights */}
        <GlassCard hover={false} className="flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Brain size={16} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Engine Insights</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                {report?.sessionTitle || 'Latest session'}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {(report?.insights || []).slice(0, 4).map((insight, i) => (
              <div key={i} className="flex items-center gap-3 border border-dark-border bg-dark-bg/40 p-3 rounded-xl hover:border-dark-borderHover transition-colors">
                <div className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
                  insight.type === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  insight.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                }`}>
                  {insight.type === 'positive' ? '✓' : insight.type === 'warning' ? '!' : 'i'}
                </div>
                <p className="text-xs font-medium text-slate-300 leading-snug flex-1">{insight.text}</p>
              </div>
            ))}
            {(!report?.insights || report.insights.length === 0) && (
              <EmptyState title="No session data" description="Insights appear once a class session has telemetry." />
            )}
          </div>

          <div className="mt-5 text-center">
            <Link to="/ai-reports" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
              View Full Report <ChevronRight size={14} />
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default TeacherDashboard;