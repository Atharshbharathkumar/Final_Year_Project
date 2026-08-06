import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  Video,
  FileCheck,
  Eye,
  BarChart3,
  ShieldAlert,
  GraduationCap,
  ClipboardList,
  CalendarCheck,
  Trophy,
  Users
} from 'lucide-react';

export const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isParent = user?.role === 'PARENT';

  // A parent has no courses of their own and no session to join, so they get a
  // deliberately narrow menu rather than the student one with dead links.
  const navItems = isParent
    ? [{ label: 'My Children', path: '/parent', icon: Users }]
    : [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Courses', path: '/courses', icon: BookOpen },
        { label: 'Assignments', path: '/assignments', icon: ClipboardList },
        { label: 'Attendance', path: '/attendance', icon: CalendarCheck },
        { label: 'Achievements', path: '/achievements', icon: Trophy },
      ];

  if (isTeacher) {
    navItems.push(
      { label: 'Live Monitoring', path: '/teacher/monitoring/1', icon: Eye },
      { label: 'Session Reports', path: '/teacher/reports', icon: BarChart3 }
    );
  }

  return (
    <aside className="w-64 border-r border-dark-border bg-dark-bg/60 p-4 flex flex-col justify-between shrink-0 hidden md:flex min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        <div className="px-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            Main Navigation
          </p>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {!isParent && (
        <div className="px-3 pt-4 border-t border-dark-border">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            Quick Session Join
          </p>
          <div className="space-y-2">
            <Link
              to="/classroom/1"
              className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500/40 text-xs transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <div>
                  {/* Static shortcut to session 1. The course code and teacher
                      name were hardcoded here and did not track the session. */}
                  <span className="font-semibold text-slate-200 block group-hover:text-indigo-300">Live Classroom</span>
                  <span className="text-[10px] text-slate-400">Session 1</span>
                </div>
              </div>
              <Video className="w-4 h-4 text-indigo-400" />
            </Link>

            <Link
              to="/exam/1"
              className="flex items-center justify-between p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 hover:border-rose-500/40 text-xs transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <div>
                  <span className="font-semibold text-slate-200 block group-hover:text-rose-300">Proctored Exam</span>
                  <span className="text-[10px] text-slate-400">Exam 1</span>
                </div>
              </div>
              <FileCheck className="w-4 h-4 text-rose-400" />
            </Link>
          </div>
        </div>
        )}
      </div>

      <div className="p-3 bg-slate-900/60 rounded-xl border border-dark-border text-xs">
        <div className="flex items-center gap-2 mb-1.5 text-indigo-400 font-semibold">
          <GraduationCap className="w-4 h-4" />
          <span>Signed in as</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {user?.fullName} · <span className="font-mono">{user?.role}</span>
        </p>
      </div>
    </aside>
  );
};
