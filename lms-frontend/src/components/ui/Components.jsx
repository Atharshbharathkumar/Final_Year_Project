import React from 'react';

export const StatCard = ({ icon: Icon, label, value, change, changeType = 'positive', suffix = '', color = 'brand' }) => {
  const colorMap = {
    brand: { bg: 'bg-brand-500/15', text: 'text-brand-400', glow: 'shadow-brand-500/10' },
    violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', glow: 'shadow-violet-500/10' },
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', glow: 'shadow-amber-500/10' },
    rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', glow: 'shadow-rose-500/10' },
    sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', glow: 'shadow-sky-500/10' },
    cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
  };
  const c = colorMap[color] || colorMap.brand;

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
          {Icon && <Icon size={20} className={c.text} />}
        </div>
        {change !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            changeType === 'positive' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
          }`}>
            {changeType === 'positive' ? '↑' : '↓'} {change}%
          </span>
        )}
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{value}{suffix}</p>
      <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
    </div>
  );
};

export const GlassCard = ({ children, className = '', hover = true, padding = 'p-5' }) => (
  <div className={`${hover ? 'glass-card' : 'glass-card-static'} ${padding} ${className}`}>
    {children}
  </div>
);

export const ChartCard = ({ title, subtitle, action, children, className = '' }) => (
  <div className={`glass-card-static p-5 ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const ProgressRing = ({ value, size = 80, strokeWidth = 6, color = '#6366f1', label }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold text-white">{value}%</span>
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
};

export const ProgressBar = ({ value, max = 100, color = 'from-brand-500 to-violet-500', label, showValue = true, height = 'h-2' }) => (
  <div className="w-full">
    {(label || showValue) && (
      <div className="flex items-center justify-between mb-1.5">
        {label && <span className="text-xs text-slate-400">{label}</span>}
        {showValue && <span className="text-xs font-semibold text-white">{value}%</span>}
      </div>
    )}
    <div className={`w-full ${height} bg-dark-border rounded-full overflow-hidden`}>
      <div className={`${height} bg-gradient-to-r ${color} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  </div>
);

export const Badge = ({ children, variant = 'brand', className = '' }) => (
  <span className={`badge badge-${variant} ${className}`}>{children}</span>
);

/** Shown while a page is waiting on its first API response. */
export const LoadingState = ({ label = 'Loading live data…', className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center animate-pulse shadow-lg shadow-brand-500/25 mb-4">
      <span className="text-lg">🧠</span>
    </div>
    <p className="text-sm text-slate-400">{label}</p>
  </div>
);

/** Shown when an API call fails, with an optional retry. */
export const ErrorState = ({ message = 'Could not reach the server.', onRetry, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
    <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
      <span className="text-xl">⚠️</span>
    </div>
    <p className="text-sm font-semibold text-white mb-1">Unable to load this view</p>
    <p className="text-xs text-slate-400 max-w-sm mb-4">{message}</p>
    {onRetry && (
      <button onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-dark-card border border-dark-border text-xs font-medium text-slate-300 hover:text-white hover:border-dark-borderHover transition-colors">
        Try again
      </button>
    )}
  </div>
);

/** Shown when a request succeeds but the collection is empty. */
export const EmptyState = ({ icon: Icon, title = 'Nothing here yet', description, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
    {Icon && (
      <div className="w-12 h-12 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center mb-3">
        <Icon size={20} className="text-slate-500" />
      </div>
    )}
    <p className="text-sm font-semibold text-white mb-1">{title}</p>
    {description && <p className="text-xs text-slate-400 max-w-sm">{description}</p>}
  </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', onClick, className = '', ...props }) => {
  const variants = {
    primary: 'gradient-btn text-white font-semibold',
    secondary: 'bg-dark-card border border-dark-border text-slate-300 hover:bg-dark-cardHover hover:text-white hover:border-dark-borderHover',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    danger: 'bg-rose-500/15 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-7 py-3 text-base rounded-xl',
  };
  return (
    <button onClick={onClick} className={`${variants[variant]} ${sizes[size]} transition-all duration-200 relative z-10 ${className}`} {...props}>
      {children}
    </button>
  );
};

export const DataTable = ({ columns, data, onRowClick }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-dark-border">
          {columns.map((col, i) => (
            <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} onClick={() => onRowClick?.(row)}
            className="border-b border-dark-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors">
            {columns.map((col, j) => (
              <td key={j} className="px-4 py-3 text-sm text-slate-300">
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card-static border border-dark-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-dark-border">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
