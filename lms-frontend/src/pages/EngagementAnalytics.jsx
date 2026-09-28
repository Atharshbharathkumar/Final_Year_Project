import React, { useCallback, useMemo } from 'react';
import { GlassCard, ChartCard, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import {
  BarChart3, Brain, Activity, Clock, Target, CalendarDays,
  ChevronUp, ChevronDown, MonitorPlay, TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { dashboardApi, analyticsApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const insightIcon = (type) => {
  if (type === 'positive') return <ChevronUp size={16} className="text-emerald-400" />;
  if (type === 'warning') return <ChevronDown size={16} className="text-amber-400" />;
  return <Target size={16} className="text-brand-400" />;
};

const EngagementAnalytics = () => {
  const fetchBreakdown = useCallback(() => dashboardApi.engagementBreakdown(), []);
  const fetchTrend = useCallback(() => analyticsApi.weekly(), []);

  const { data: breakdown, loading, error, refetch } = useApi(fetchBreakdown, []);
  const { data: trend } = useApi(fetchTrend, [], { initialData: [] });

  const radarData = useMemo(() => {
    if (!breakdown) return [];
    return [
      { subject: 'Participation', A: breakdown.participation, fullMark: 100 },
      { subject: 'Attendance', A: breakdown.attendance, fullMark: 100 },
      { subject: 'Classroom', A: breakdown.classroomEngagement, fullMark: 100 },
      { subject: 'Progress', A: breakdown.courseProgress, fullMark: 100 },
      { subject: 'Quizzes', A: breakdown.quizPerformance, fullMark: 100 },
      { subject: 'Assignments', A: breakdown.assignments, fullMark: 100 },
    ];
  }, [breakdown]);

  if (loading) return <LoadingState label="Computing your engagement profile…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-violet-400" /> Multimodal Engagement Intelligence
        </h1>
        <p className="text-sm text-slate-400 mt-1">Holistic analysis of your learning patterns and academic involvement.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Score Card */}
        <GlassCard hover={false} className="lg:col-span-1 flex flex-col items-center justify-center text-center p-8 border-brand-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl" />

          <div className="flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold relative z-10">
            <TrendingUp size={14} /> {breakdown?.percentileLabel}
          </div>

          <div className="relative mb-2 z-10 w-40 h-40 flex items-center justify-center rounded-full border-4 border-dark-border">
            <div className="absolute inset-0 rounded-full border-t-4 border-brand-500 transform rotate-45" />
            <div className="absolute inset-0 rounded-full border-r-4 border-violet-500 transform rotate-45" />
            <div className="flex flex-col items-center justify-center">
              <span className="text-5xl font-bold gradient-text">{breakdown?.overallScore ?? 0}</span>
              <span className="text-xs text-slate-400 font-medium">Out of 100</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white mt-4 relative z-10">{breakdown?.headline}</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-[220px] relative z-10">{breakdown?.narrative}</p>
        </GlassCard>

        {/* Multimodal Radar */}
        <GlassCard hover={false} className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Target size={18} className="text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Multimodal Intelligence Breakdown</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Student" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Attendance', value: breakdown?.attendance ?? 0, color: 'from-emerald-500 to-teal-500', icon: CalendarDays },
                { label: 'Participation', value: breakdown?.participation ?? 0, color: 'from-brand-500 to-indigo-500', icon: Activity },
                { label: 'Classroom Focus', value: breakdown?.classroomEngagement ?? 0, color: 'from-violet-500 to-purple-500', icon: MonitorPlay },
                { label: 'Assignments', value: breakdown?.assignments ?? 0, color: 'from-cyan-500 to-blue-500', icon: Target },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 flex items-center gap-1.5"><item.icon size={12} className="text-slate-500" />{item.label}</span>
                    <span className="text-xs font-bold text-white">{item.value}%</span>
                  </div>
                  <ProgressBar value={item.value} color={item.color} showValue={false} height="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Engagement History" subtitle="Your 7-day rolling performance" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend || []}>
              <defs>
                <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="engagement" stroke="#8b5cf6" fill="url(#eGrad)" strokeWidth={3} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <GlassCard hover={false} className="flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Brain size={18} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">AI Insights & Advice</h3>
          </div>

          <div className="space-y-4 flex-1">
            {(breakdown?.insights || []).length === 0 ? (
              <EmptyState icon={Clock} title="Not enough data" description="Insights appear once more activity is recorded." />
            ) : (breakdown?.insights || []).map((insight, i) => (
              <div key={i} className="p-3 rounded-xl bg-dark-bg/50 border border-dark-border flex items-start gap-3">
                <div className="mt-0.5">{insightIcon(insight.type)}</div>
                <div>
                  <p className="text-xs font-semibold text-white mb-1">{insight.title}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default EngagementAnalytics;