import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BookOpen, FileText, Calendar, ClipboardCheck, GraduationCap,
  Video, Trophy, Bell, Bot, User, Settings, Users, BarChart3, Brain, MonitorPlay,
  FileBarChart, Award, CalendarDays, Shield, Cpu, X, FileSearch, Target, ShieldCheck, HelpCircle
} from 'lucide-react';

const roleMenus = {
  student: [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', path: '/courses', icon: BookOpen },
    { label: 'Assignments', path: '/assignments', icon: FileText },
    { label: 'Learning States', path: '/learning-states', icon: MonitorPlay },
    { label: 'Digital Twin', path: '/digital-twin', icon: User },
    { label: 'Attendance', path: '/attendance', icon: ClipboardCheck },
    { label: 'Exams', path: '/exams', icon: GraduationCap },
    { label: 'Online Classes', path: '/classroom/live', icon: Video },
    { label: 'Events', path: '/events', icon: CalendarDays },
    { label: 'Academic Credits', path: '/credits', icon: Trophy },
    { label: 'Resume AI', path: '/resume-scoring', icon: FileSearch },
    { label: 'Notifications', path: '/notifications', icon: Bell },
  ],
  teacher: [
    { label: 'Dashboard', path: '/teacher/dashboard', icon: LayoutDashboard },
    { label: 'Courses', path: '/courses', icon: BookOpen },
    { label: 'Assignments', path: '/assignments', icon: FileText },
    { label: 'Grading', path: '/grading', icon: ClipboardCheck },
    { label: 'Online Classes', path: '/classroom/live', icon: Video },
    { label: 'Students', path: '/engagement', icon: Users },
    { label: 'Interventions', path: '/interventions', icon: Target },
    { label: 'Learning Simulator', path: '/simulator', icon: HelpCircle },
    { label: 'Digital Twin', path: '/digital-twin', icon: User },
    { label: 'Analytics', path: '/engagement', icon: BarChart3 },
    { label: 'AI Monitoring', path: '/ai-monitoring', icon: Brain },
    { label: 'AI Reports', path: '/ai-reports', icon: FileBarChart },
    { label: 'Responsible AI', path: '/responsible-ai', icon: ShieldCheck },
  ],
  parent: [
    { label: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', path: '/attendance', icon: ClipboardCheck },
    { label: 'Performance', path: '/grades', icon: GraduationCap },
    { label: 'Learning States', path: '/learning-states', icon: MonitorPlay },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Settings', path: '/settings', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Reports', path: '/admin/reports', icon: FileBarChart },
    { label: 'Learning Simulator', path: '/simulator', icon: HelpCircle },
    { label: 'System', path: '/architecture', icon: Cpu },
    { label: 'Responsible AI', path: '/responsible-ai', icon: ShieldCheck },
    { label: 'Settings', path: '/settings', icon: Settings },
  ],
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const menu = roleMenus[user?.role] || roleMenus.student;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed lg:sticky top-0 lg:top-16 left-0 z-40 lg:z-30
        w-64 h-screen lg:h-[calc(100vh-4rem)]
        glass-sidebar overflow-y-auto
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-dark-border">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <nav className="p-3 space-y-0.5">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink key={item.path + item.label} to={item.path} onClick={onClose}
                className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}>
                <Icon size={18} className={isActive ? 'text-brand-400' : ''} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-4 mt-2 rounded-xl bg-gradient-to-br from-brand-600/20 to-violet-600/20 border border-brand-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={16} className="text-brand-400" />
            <span className="text-xs font-semibold text-brand-300">AI Assistant</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Get help with assignments, generate notes, or ask questions about your courses.
          </p>
          <NavLink to="/ai-assistant" onClick={onClose}
            className="mt-2.5 block text-center py-1.5 rounded-lg bg-brand-600/30 text-xs font-medium text-brand-300 hover:bg-brand-600/40 transition-colors">
            Open Assistant
          </NavLink>
        </div>
      </aside>
    </>
  );
};
