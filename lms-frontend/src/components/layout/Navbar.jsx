import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useLiveClock } from '../../hooks/useRealtime';
import { useApi } from '../../hooks/useApi';
import { campusApi } from '../../services/api';
import websocket from '../../services/websocket';
import {
  Search, Bell, Sun, Moon, Menu, ChevronDown, LogOut,
  User, Settings, Wifi, WifiOff, Clock, X
} from 'lucide-react';

export const Navbar = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const liveClock = useLiveClock();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [connected, setConnected] = useState(false);

  const fetchNotifications = useCallback(() => campusApi.notifications(), []);
  const { data: notificationData, setData: setNotifications } = useApi(fetchNotifications, [], { initialData: [] });
  const notifications = notificationData || [];

  const unreadCount = notifications.filter(n => !n.read).length;

  // New notifications are pushed to this user's private topic by the server.
  useEffect(() => {
    if (!user?.id) return undefined;
    const topic = `/topic/notifications/${user.id}`;

    websocket.connect(() => {
      setConnected(true);
      websocket.subscribe(topic, (incoming) => {
        setNotifications(prev => [incoming, ...(prev || [])]);
        addToast(incoming.title, incoming.type === 'danger' ? 'error' : incoming.type || 'info', 6000);
      });
    });

    return () => websocket.unsubscribe(topic);
  }, [user?.id, addToast, setNotifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    addToast('You have been signed out successfully.', 'info');
  };

  const markAllRead = async () => {
    setNotifications(prev => (prev || []).map(n => ({ ...n, read: true })));
    try {
      await campusApi.markAllRead();
    } catch {
      addToast('Could not sync read state to the server.', 'error');
    }
  };

  const markOneRead = async (id) => {
    setNotifications(prev => (prev || []).map(n => (n.id === id ? { ...n, read: true } : n)));
    try {
      await campusApi.markRead(id);
    } catch {
      /* optimistic update stands; the next fetch reconciles */
    }
  };

  // Live search against courses + labels
  const searchItems = [
    { label: 'Student Dashboard', path: '/student/dashboard', group: 'Pages' },
    { label: 'Teacher Dashboard', path: '/teacher/dashboard', group: 'Pages' },
    { label: 'AI Monitoring', path: '/ai-monitoring', group: 'AI Tools' },
    { label: 'Assignments', path: '/assignments', group: 'Pages' },
    { label: 'Courses', path: '/courses', group: 'Pages' },
    { label: 'Engagement Analytics', path: '/engagement', group: 'Analytics' },
    { label: 'Digital Twin', path: '/digital-twin', group: 'AI Tools' },
    { label: 'AI Interventions', path: '/interventions', group: 'AI Tools' },
    { label: 'Learning Simulator', path: '/simulator', group: 'AI Tools' },
    { label: 'Academic Credits', path: '/credits', group: 'Pages' },
    { label: 'Resume AI Scoring', path: '/resume-scoring', group: 'AI Tools' },
  ];

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (q.trim().length > 1) {
      const filtered = searchItems.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
      setSearchResults(filtered);
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const handleSearchSelect = (path) => {
    navigate(path);
    setSearchQuery('');
    setShowSearch(false);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <nav className="glass-navbar sticky top-0 z-50 px-4 lg:px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-slate-400">
          <Menu size={20} />
        </button>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/25 relative">
            <span className="text-white font-bold text-sm">E</span>
            {/* Live pulse indicator */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-dark-bg animate-pulse" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight hidden sm:block">
            Edu<span className="gradient-text">Verse</span> AI
          </span>
        </Link>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6 relative">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Search pages, courses, tools..."
            value={searchQuery} onChange={e => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          )}
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-12 left-0 right-0 glass-card-static border border-dark-border rounded-xl shadow-2xl overflow-hidden z-50">
            {searchResults.map((r, i) => (
              <button key={i} onMouseDown={() => handleSearchSelect(r.path)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left">
                <span>{r.label}</span>
                <span className="text-[10px] text-slate-500 bg-dark-bg px-2 py-0.5 rounded-full">{r.group}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Live clock */}
        <div className="hidden lg:flex flex-col items-end text-right mr-1">
          <span className="text-xs font-mono font-semibold text-white tabular-nums">{formatTime(liveClock)}</span>
          <span className="text-[10px] text-slate-500">{formatDate(liveClock)}</span>
        </div>

        {/* Realtime connection status */}
        <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border mr-1 ${
          connected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'
        }`} title={connected ? 'Connected to the realtime server' : 'Realtime channel not connected'}>
          {connected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-slate-400" />}
          <span className={`text-[11px] font-medium ${connected ? 'text-emerald-400' : 'text-slate-400'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        <button onClick={toggleTheme} className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
            className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 glass-card-static border border-dark-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
              <div className="p-4 border-b border-dark-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <button onClick={markAllRead} className="text-[11px] text-brand-400 hover:text-brand-300">
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="p-6 text-center text-xs text-slate-500">You have no notifications.</p>
                )}
                {notifications.slice(0, 6).map(n => (
                  <div key={n.id} className={`p-3.5 border-b border-dark-border/50 hover:bg-white/[0.03] cursor-pointer ${!n.read ? 'bg-brand-500/5' : ''}`}
                    onClick={() => markOneRead(n.id)}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.read ? 'bg-brand-400' : 'bg-slate-600'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white leading-tight">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock size={10} className="text-slate-500" />
                          <p className="text-[10px] text-slate-500">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/notifications" onClick={() => setShowNotifications(false)}
                className="block p-3 text-center text-xs text-brand-400 hover:bg-white/3 font-medium">
                View All Notifications
              </Link>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-sm">
              {user?.avatar || '👤'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-tight">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'student'}</p>
            </div>
            <ChevronDown size={14} className={`text-slate-500 hidden sm:block transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-12 w-56 glass-card-static border border-dark-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50">
              <div className="p-3.5 border-b border-dark-border">
                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400">Active Session</span>
                </div>
              </div>
              <div className="p-1.5">
                <Link to="/profile" onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <User size={15} /> Profile
                </Link>
                <Link to="/settings" onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  <Settings size={15} /> Settings
                </Link>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10">
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
