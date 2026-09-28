import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { publicApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import {
  GraduationCap, Users, Shield, BookOpen, Eye, EyeOff,
  ArrowRight, Brain, Sparkles, CheckCircle, WifiOff, Zap
} from 'lucide-react';

// Seeded demonstration accounts. Every one of these is a real row in the users
// table created by DataInitializer.
const roles = [
  { key: 'student', label: 'Student', icon: GraduationCap, color: 'from-brand-500 to-indigo-500',
    hint: { email: 'student@edu.in', password: 'password' } },
  { key: 'teacher', label: 'Teacher', icon: BookOpen, color: 'from-violet-500 to-purple-500',
    hint: { email: 'teacher@edu.in', password: 'password' } },
  { key: 'parent', label: 'Parent', icon: Users, color: 'from-cyan-500 to-blue-500',
    hint: { email: 'parent@edu.in', password: 'password' } },
  { key: 'admin', label: 'Admin', icon: Shield, color: 'from-amber-500 to-orange-500',
    hint: { email: 'admin@edu.in', password: 'password' } },
];

const LoginPage = () => {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [statTicker, setStatTicker] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const fetchStats = useCallback(() => publicApi.stats(), []);
  const { data: platform } = useApi(fetchStats, []);

  // Live platform figures pulled from the public stats endpoint.
  const liveStats = useMemo(() => {
    if (!platform) return [{ value: '—', label: 'Connecting to server…' }];
    return [
      { value: platform.students?.toLocaleString() ?? '0', label: 'Enrolled Students' },
      { value: platform.teachers?.toLocaleString() ?? '0', label: 'Faculty Members' },
      { value: `${platform.avgEngagement ?? 0}%`, label: 'Avg Engagement' },
      { value: `${platform.attendanceRate ?? 0}%`, label: 'Attendance Rate' },
    ];
  }, [platform]);

  useEffect(() => {
    const id = setInterval(() => setStatTicker(t => (t + 1) % liveStats.length), 3000);
    return () => clearInterval(id);
  }, [liveStats.length]);

  useEffect(() => {
    if (statTicker >= liveStats.length) setStatTicker(0);
  }, [liveStats.length, statTicker]);

  const validate = () => {
    const errs = {};
    if (!email) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 4) errs.password = 'Password must be at least 4 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRoleChange = (key) => {
    setSelectedRole(key);
    setErrors({});
    const r = roles.find(r => r.key === key);
    if (r) {
      setEmail(r.hint.email);
      setPassword(r.hint.password);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      // The server decides the role — the selector above only prefills a demo login.
      const user = await login(email, password);
      addToast(`Welcome back, ${user.name}! 👋`, 'success', 4000);
      if (remember) localStorage.setItem('lms_remember', email);
      navigate(`/${user.role}/dashboard`);
    } catch (err) {
      setErrors({ form: err.message });
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentRole = roles.find(r => r.key === selectedRole);

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Left - Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-violet-600/10 to-dark-bg" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-[100px]" />

        {/* Animated grid background */}
        <div className="absolute inset-0 hero-grid-bg opacity-60" />

        <div className="relative z-10 flex flex-col justify-between h-full px-16 py-12">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-xl shadow-brand-500/25">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">EduVerse AI</span>
          </Link>

          <div>
            <div className="mb-3">
              <span className="text-xs font-medium text-brand-400 bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full">
                ✦ AI-Powered Learning Platform
              </span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              <span className="gradient-text-hero">Smarter Learning.</span><br />
              Connected Classrooms.
            </h2>
            <p className="text-slate-400 mb-10 leading-relaxed max-w-md">
              Experience the future of education with AI-powered monitoring, intelligent engagement analytics, and personalized learning paths built for every student.
            </p>

            {/* Live ticker stat */}
            <div className="flex items-center gap-3 mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Zap size={18} className="text-emerald-400" />
              </div>
              <div key={statTicker} className="animate-fade-in">
                <p className="text-2xl font-bold text-white">{liveStats[statTicker]?.value ?? '—'}</p>
                <p className="text-xs text-slate-400">{liveStats[statTicker]?.label ?? ''}</p>
              </div>
              <div className="ml-auto flex gap-1">
                {liveStats.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === statTicker ? 'bg-brand-400 w-3' : 'bg-slate-600'}`} />
                ))}
              </div>
            </div>

            {/* Feature badges */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                { icon: Brain, label: 'Live Classes', value: `${platform?.liveClasses ?? 0} running` },
                { icon: Sparkles, label: 'Avg Engagement', value: `${platform?.avgEngagement ?? 0}%` },
                { icon: CheckCircle, label: 'Secure Auth', value: 'JWT + RBAC' },
                { icon: Users, label: 'Enrolled', value: `${platform?.students ?? 0} Students` },
              ].map((item, i) => (
                <div key={i} className="glass-card-static rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0">
                    <item.icon size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">{item.label}</p>
                    <p className="text-sm font-semibold text-white">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-600">
            © 2026 EduVerse AI · Final Year Project · B.Tech CSE
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative">
        {/* Subtle bg blob */}
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-brand-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="text-xl font-bold text-white">EduVerse AI</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
          <p className="text-sm text-slate-400 mb-8">Sign in to continue to your dashboard</p>

          {/* Role Selector */}
          <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">Select Your Role</p>
          <div className="grid grid-cols-4 gap-2 mb-8">
            {roles.map(role => {
              const Icon = role.icon;
              const isActive = selectedRole === role.key;
              return (
                <button key={role.key} onClick={() => handleRoleChange(role.key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-br ${role.color} border-transparent shadow-lg shadow-brand-500/20 text-white scale-[1.03]`
                      : 'bg-dark-card border-dark-border text-slate-400 hover:border-dark-borderHover hover:text-white'
                  }`}>
                  <Icon size={18} />
                  <span className="text-[11px] font-medium">{role.label}</span>
                </button>
              );
            })}
          </div>

          {/* Credential hint */}
          <button onClick={() => setShowHint(h => !h)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-brand-400 transition-colors mb-4">
            <span className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px]">?</span>
            {showHint ? 'Hide' : 'Show'} demo credentials for {currentRole?.label}
          </button>
          {showHint && currentRole && (
            <div className="mb-4 p-3 rounded-xl bg-brand-500/5 border border-brand-500/15 text-xs text-slate-400 space-y-1 animate-fade-in">
              <p>📧 Email: <span className="text-brand-300 font-mono">{currentRole.hint.email}</span></p>
              <p>🔑 Password: <span className="text-brand-300 font-mono">{currentRole.hint.password}</span></p>
            </div>
          )}

          {errors.form && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-sm text-rose-300 animate-fade-in">
              <WifiOff size={14} />
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                placeholder={`${selectedRole}@edu.in`}
                className={`input-field ${errors.email ? 'border-rose-500/50 focus:border-rose-500/70' : ''}`}
              />
              {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Enter your password"
                  className={`input-field pr-12 ${errors.password ? 'border-rose-500/50' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-400">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${remember ? 'bg-brand-500 border-brand-500' : 'border-dark-border bg-dark-card'}`}
                  onClick={() => setRemember(!remember)}>
                  {remember && <CheckCircle size={10} className="text-white" />}
                </div>
                <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Remember me</span>
              </label>
              <a href="#" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">Forgot password?</a>
            </div>

            <button type="submit" disabled={loading}
              className="w-full gradient-btn py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 relative z-10 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-border">
            <p className="text-center text-xs text-slate-500">
              Secured with <span className="text-brand-400">JWT Authentication</span> &amp; Role-Based Access Control
            </p>
            <div className="flex items-center justify-center gap-4 mt-3">
              {['Student', 'Teacher', 'Parent', 'Admin'].map(r => (
                <button key={r} onClick={() => handleRoleChange(r.toLowerCase())}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors capitalize">
                  {r} demo
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
