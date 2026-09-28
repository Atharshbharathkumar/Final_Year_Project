import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatCard, GlassCard, ChartCard, ProgressBar, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  GraduationCap, ClipboardCheck, Activity, FileText, Trophy,
  Clock, ChevronRight, Zap, BookOpen
} from 'lucide-react';
import { dashboardApi, analyticsApi, assignmentApi, courseApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useCountUp } from '../hooks/useRealtime';

const StudentDashboard = () => {
  const { user } = useAuth();

  const fetchStats = useCallback(() => dashboardApi.student(), []);
  const fetchTrend = useCallback(() => analyticsApi.weekly(), []);
  const fetchAssignments = useCallback(() => assignmentApi.my(), []);
  const fetchCourses = useCallback(() => courseApi.my(), []);

  const { data: stats, loading, error, refetch } = useApi(fetchStats, []);
  const { data: trend } = useApi(fetchTrend, [], { initialData: [] });
  const { data: assignments } = useApi(fetchAssignments, [], { initialData: [] });
  const { data: courses } = useApi(fetchCourses, [], { initialData: [] });

  // Count-up animates the real value returned by the server.
  const gpa = useCountUp(stats?.gpa ?? 0, 1500, 2);
  const attendance = useCountUp(stats?.attendance ?? 0, 1500);
  const credits = useCountUp(stats?.credits ?? 0, 2000);

  if (loading) return <LoadingState label="Loading your academic record…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const engagement = stats?.engagementScore ?? 0;
  const actionRequired = (assignments || [])
    .filter(a => a.status !== 'graded' && a.status !== 'submitted')
    .slice(0, 4);

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Welcome back, {user?.name?.split(' ')[0] || 'Student'} <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Live overview of your academic performance and AI insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Sync Active
          </div>
          <Link to="/ai-assistant" className="gradient-btn px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 relative z-10 shadow-lg shadow-brand-500/25 shrink-0">
            🧠 AI Assistant
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={GraduationCap} label="Overall GPA" value={gpa} color="brand" />
        <StatCard icon={ClipboardCheck} label="Attendance" value={attendance} suffix="%" color="emerald" />
        <StatCard
          icon={Activity}
          label="Engagement Score"
          value={engagement}
          suffix="/100"
          color="violet"
          changeType={stats?.gpaChange >= 0 ? 'positive' : 'negative'}
          change={stats?.gpaChange ? Math.abs(stats.gpaChange) : undefined}
        />
        <StatCard icon={FileText} label="Assignment Progress" value={stats?.assignmentProgress ?? 0} suffix="%" color="amber" />
        <StatCard icon={Trophy} label="Academic Credits" value={credits} suffix={`/${stats?.creditTarget ?? 60}`} color="cyan" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Engagement Chart */}
        <ChartCard title="Engagement Trend" subtitle="Your last 7 days of measured activity" className="lg:col-span-2 relative">
          <div className="absolute top-5 right-5 flex gap-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Engagement</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Attendance</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="engagement" stroke="#6366f1" fill="url(#engGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="attendance" stroke="#10b981" fill="url(#attGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Current state panel */}
        <GlassCard hover={false} className="flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center animate-pulse">
              <Zap size={18} className="text-violet-400" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-white mb-6">Current State</h3>

          <div className="text-center mb-6 relative z-10">
            <p className="text-6xl font-black gradient-text tracking-tighter">{engagement}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mt-2">
              {stats?.currentLearningState || 'No Data'}
            </p>
            {stats?.stateConfidence > 0 && (
              <p className="text-[10px] text-slate-500 mt-1">{stats.stateConfidence}% engine confidence</p>
            )}
          </div>

          <div className="space-y-4 flex-1">
            <ProgressBar label="Attendance" value={stats?.attendance ?? 0} color="from-emerald-500 to-teal-500" />
            <ProgressBar label="Assignment Progress" value={stats?.assignmentProgress ?? 0} color="from-brand-500 to-indigo-500" />
            <ProgressBar
              label="Courses Completed"
              value={stats?.totalCourses ? Math.round((stats.completedCourses / stats.totalCourses) * 100) : 0}
              color="from-amber-500 to-orange-500"
            />
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Upcoming Assignments */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Action Required</h3>
            <Link to="/assignments" className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1">View All <ChevronRight size={14} /></Link>
          </div>
          {actionRequired.length === 0 ? (
            <EmptyState icon={FileText} title="You're all caught up" description="No assignments are waiting on you right now." />
          ) : (
            <div className="space-y-3">
              {actionRequired.map(a => (
                <div key={a.id} className="group flex items-center gap-4 p-3.5 rounded-xl bg-dark-bg/30 border border-dark-border hover:border-dark-borderHover hover:bg-white/[0.02] transition-all cursor-pointer">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                    a.priority === 'high' ? 'bg-rose-500/15' : a.priority === 'medium' ? 'bg-amber-500/15' : 'bg-emerald-500/15'
                  }`}>
                    <FileText size={18} className={a.priority === 'high' ? 'text-rose-400' : a.priority === 'medium' ? 'text-amber-400' : 'text-emerald-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{a.course}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={a.status === 'pending' ? 'warning' : 'brand'}>{a.status}</Badge>
                    <p className="text-[10px] font-medium text-slate-500 mt-1.5 flex items-center gap-1 justify-end">
                      <Clock size={10} className={a.priority === 'high' ? 'text-rose-400' : ''} /> {a.dueDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Course Progress */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Active Courses</h3>
            <Link to="/courses" className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1">All Courses <ChevronRight size={14} /></Link>
          </div>
          {(courses || []).length === 0 ? (
            <EmptyState icon={BookOpen} title="No enrolled courses" description="Once you are enrolled, your courses appear here." />
          ) : (
            <div className="space-y-4">
              {(courses || []).slice(0, 4).map(c => (
                <div key={c.id} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl bg-white/5 w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-white/10 transition-colors">{c.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white transition-colors">{c.name}</p>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider">{c.code}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white px-2 py-1 rounded bg-white/5 border border-white/5">{c.grade}</span>
                  </div>
                  <ProgressBar value={c.progress} height="h-1.5" showValue={false} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default StudentDashboard;