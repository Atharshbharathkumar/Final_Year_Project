import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { StatCard, GlassCard, ChartCard, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users, GraduationCap, BookOpen, Video, Activity, Shield, Cpu,
  FileBarChart, ChevronRight, Settings
} from 'lucide-react';
import { dashboardApi, analyticsApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const AdminDashboard = () => {
  const fetchStats = useCallback(() => dashboardApi.admin(), []);
  const fetchMonthly = useCallback(() => analyticsApi.monthly(), []);
  const fetchDepartments = useCallback(() => analyticsApi.departments(), []);

  const { data: stats, loading, error, refetch } = useApi(fetchStats, []);
  const { data: monthly } = useApi(fetchMonthly, [], { initialData: [] });
  const { data: departments } = useApi(fetchDepartments, [], { initialData: [] });

  if (loading) return <LoadingState label="Loading platform metrics…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Enterprise-level overview of the EduVerse AI platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/users" className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-dark-card border border-dark-border hover:bg-dark-cardHover flex items-center gap-2">
            <Users size={14} /> Manage Users
          </Link>
          <Link to="/admin/reports" className="gradient-btn px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 relative z-10">
            <FileBarChart size={14} /> Reports
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Total Students" value={(stats?.totalStudents ?? 0).toLocaleString()} color="brand" />
        <StatCard icon={GraduationCap} label="Total Teachers" value={stats?.totalTeachers ?? 0} color="violet" />
        <StatCard icon={Shield} label="Departments" value={stats?.departments ?? 0} color="cyan" />
        <StatCard icon={BookOpen} label="Active Courses" value={stats?.activeCourses ?? 0} color="emerald" />
        <StatCard icon={Video} label="Live Classes" value={stats?.onlineClasses ?? 0} color="amber" />
        <StatCard icon={Activity} label="Avg Engagement" value={stats?.avgEngagement ?? 0} suffix="%" color="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <ChartCard title="Student Growth & Engagement" subtitle="Enrolment and measured engagement by month" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly || []}>
              <defs>
                <linearGradient id="aStudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aEngGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="students" stroke="#6366f1" fill="url(#aStudGrad)" strokeWidth={2} name="Students" />
              <Area type="monotone" dataKey="engagement" stroke="#8b5cf6" fill="url(#aEngGrad)" strokeWidth={2} name="Engagement %" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-white mb-4">System Health</h3>
          <p className="text-[10px] text-slate-500 mb-4 -mt-2">Sampled live from the running JVM and host.</p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Uptime</span>
                <span className="text-xs font-bold text-emerald-400">{stats?.systemUptime ?? 0}%</span>
              </div>
              <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, stats?.systemUptime ?? 0)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Disk Used</span>
                <span className="text-xs font-bold text-amber-400">{stats?.storageUsed ?? 0}%</span>
              </div>
              <div className="h-2 bg-dark-border rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${stats?.storageUsed ?? 0}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center p-3 rounded-xl bg-dark-bg/50 border border-dark-border">
                <Cpu size={16} className="text-brand-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">CPU Load</p>
                <p className="text-sm font-bold text-white">{stats?.cpuUsage ?? 0}%</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-dark-bg/50 border border-dark-border">
                <Activity size={16} className="text-violet-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500">Heap Used</p>
                <p className="text-sm font-bold text-white">{stats?.memoryUsage ?? 0}%</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Department Performance */}
      <GlassCard hover={false} padding="p-0">
        <div className="p-5 pb-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Department Performance</h3>
        </div>
        {(departments || []).length === 0 ? (
          <EmptyState icon={Shield} title="No departments configured" className="py-8" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  {['Department', 'Students', 'Teachers', 'Courses', 'Avg Engagement'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(departments || []).map((d) => (
                  <tr key={d.code} className="border-b border-dark-border/50 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-sm font-medium text-white">{d.name}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">{d.students}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">{d.teachers}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">{d.courses}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-dark-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${d.avgEngagement >= 80 ? 'bg-emerald-500' : d.avgEngagement >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${d.avgEngagement}%` }} />
                        </div>
                        <span className="text-xs font-medium text-white">{d.avgEngagement}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'User Management', path: '/admin/users', color: 'from-brand-500 to-indigo-500' },
          { icon: BookOpen, label: 'Course Management', path: '/courses', color: 'from-violet-500 to-purple-500' },
          { icon: FileBarChart, label: 'Generate Reports', path: '/ai-reports', color: 'from-emerald-500 to-teal-500' },
          { icon: Settings, label: 'System Settings', path: '/settings', color: 'from-amber-500 to-orange-500' },
        ].map((action, i) => (
          <Link key={i} to={action.path} className="glass-card rounded-xl p-5 group flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <action.icon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">Open <ChevronRight size={10} /></p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;