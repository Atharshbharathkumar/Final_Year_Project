import React, { useCallback } from 'react';
import { StatCard, GlassCard, ChartCard, ProgressBar, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClipboardCheck, TrendingUp, Activity, FileText, Bell, Calendar } from 'lucide-react';
import { dashboardApi, analyticsApi, assignmentApi, examApi, campusApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const ParentDashboard = () => {
  const fetchStats = useCallback(() => dashboardApi.parent(), []);
  const fetchTrend = useCallback(() => analyticsApi.weekly(), []);
  const fetchAssignments = useCallback(() => assignmentApi.my(), []);
  const fetchExams = useCallback(() => examApi.mine(), []);
  const fetchNotifications = useCallback(() => campusApi.notifications(), []);

  const { data: stats, loading, error, refetch } = useApi(fetchStats, []);
  const { data: trend } = useApi(fetchTrend, [], { initialData: [] });
  const { data: assignments } = useApi(fetchAssignments, [], { initialData: [] });
  const { data: exams } = useApi(fetchExams, [], { initialData: [] });
  const { data: notifications } = useApi(fetchNotifications, [], { initialData: [] });

  if (loading) return <LoadingState label="Loading your child's record…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const upcomingExams = (exams || []).filter(e => e.status === 'upcoming');

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white">Parent Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitoring academic progress for <strong className="text-white">{stats?.childName}</strong> — {stats?.childGrade}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="Attendance" value={stats?.attendance ?? 0} suffix="%" color="emerald" />
        <StatCard icon={TrendingUp} label="Performance" value={stats?.performance ?? 0} suffix="%" color="brand" />
        <StatCard icon={Activity} label="Engagement Score" value={stats?.engagement ?? 0} suffix="/100" color="violet" />
        <StatCard icon={FileText} label="Assignment Completion" value={stats?.assignmentCompletion ?? 0} suffix="%" color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Weekly Performance Trend" subtitle="Engagement and attendance over the past week">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend || []}>
              <defs>
                <linearGradient id="pEngGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pAttGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="engagement" stroke="#6366f1" fill="url(#pEngGrad)" strokeWidth={2} name="Engagement" />
              <Area type="monotone" dataKey="attendance" stroke="#10b981" fill="url(#pAttGrad)" strokeWidth={2} name="Attendance" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-white mb-4">Academic Overview</h3>
          <div className="space-y-3">
            <ProgressBar label="Attendance" value={stats?.attendance ?? 0} color="from-emerald-500 to-teal-500" />
            <ProgressBar label="Academic Performance" value={stats?.performance ?? 0} color="from-brand-500 to-indigo-500" />
            <ProgressBar label="Engagement Score" value={stats?.engagement ?? 0} color="from-violet-500 to-purple-500" />
            <ProgressBar label="Assignment Completion" value={stats?.assignmentCompletion ?? 0} color="from-cyan-500 to-blue-500" />
            <ProgressBar label="Quiz Performance" value={stats?.quizPerformance ?? 0} color="from-amber-500 to-orange-500" />
          </div>
          <div className={`mt-4 p-3 rounded-xl border ${
            stats?.summaryTone === 'positive'
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
          }`}>
            <p className={`text-xs font-medium ${stats?.summaryTone === 'positive' ? 'text-emerald-300' : 'text-amber-300'}`}>
              {stats?.summaryTone === 'positive' ? '✅ ' : '⚠️ '}{stats?.summary}
            </p>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-white mb-4">Upcoming Exams</h3>
          {upcomingExams.length === 0 ? (
            <EmptyState icon={Calendar} title="No exams scheduled" description="Upcoming assessments will appear here." />
          ) : (
            <div className="space-y-3">
              {upcomingExams.map(e => (
                <div key={e.id} className="p-3 rounded-xl bg-dark-bg/50 border border-dark-border/50">
                  <p className="text-sm font-medium text-white">{e.title}</p>
                  <p className="text-[11px] text-slate-500">{e.course}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                    <Calendar size={11} /> {e.date} • {e.time}
                    <Badge variant="info">{e.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-white mb-4">Assignment Status</h3>
          {(assignments || []).length === 0 ? (
            <EmptyState icon={FileText} title="No assignments" />
          ) : (
            <div className="space-y-3">
              {(assignments || []).slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg/50 border border-dark-border/50">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium text-white truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-500">Due: {a.dueDate}</p>
                  </div>
                  <Badge variant={a.status === 'graded' ? 'success' : a.status === 'submitted' ? 'info' : 'warning'}>
                    {a.status === 'graded' && a.grade != null ? `${a.grade}/${a.points}` : a.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={14} className="text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
          </div>
          {(notifications || []).length === 0 ? (
            <EmptyState icon={Bell} title="Nothing new" />
          ) : (
            <div className="space-y-3">
              {(notifications || []).slice(0, 4).map(n => (
                <div key={n.id} className={`p-3 rounded-xl border ${!n.read ? 'bg-brand-500/5 border-brand-500/10' : 'bg-dark-bg/30 border-dark-border/50'}`}>
                  <p className="text-xs font-medium text-white">{n.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{n.time}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default ParentDashboard;