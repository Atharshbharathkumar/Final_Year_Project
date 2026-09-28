import React from 'react';
import { AlertTriangle, ShieldOff, MonitorUp, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Components';

/**
 * Full-cover block shown when the student goes off-task.
 *
 * This is the honest limit of what a web page can enforce: it covers the class
 * so there is nothing to gain by staying away, records the event against the
 * student, and tells them what happens next. It cannot reach out and close
 * whatever they switched to.
 *
 * @param {'WARN'|'FINAL_WARNING'|'REMOVED'} action
 */
const OffTaskOverlay = ({ action, violations, limit, message, onAcknowledge, onLeave }) => {
  const removed = action === 'REMOVED';
  const final = action === 'FINAL_WARNING';

  const accent = removed
    ? { ring: 'border-rose-500/40', chip: 'bg-rose-500/15 text-rose-300', icon: 'text-rose-400' }
    : final
      ? { ring: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-300', icon: 'text-amber-400' }
      : { ring: 'border-brand-500/40', chip: 'bg-brand-500/15 text-brand-300', icon: 'text-brand-400' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-dark-bg/95 backdrop-blur-md">
      <div className={`max-w-lg w-full rounded-2xl border-2 ${accent.ring} bg-dark-card p-8 text-center shadow-2xl`}>
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5 ${accent.chip}`}>
          {removed ? <ShieldOff size={30} className={accent.icon} /> : <AlertTriangle size={30} className={accent.icon} />}
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {removed ? 'Removed from this class' : final ? 'Final warning' : 'Class paused — you left the window'}
        </h2>

        <p className="text-sm text-slate-300 leading-relaxed mb-5">{message}</p>

        {/* Strike counter */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: limit || 3 }).map((_, i) => (
            <span
              key={i}
              className={`w-9 h-1.5 rounded-full transition-colors ${
                i < (violations || 0)
                  ? removed ? 'bg-rose-500' : final ? 'bg-amber-500' : 'bg-brand-500'
                  : 'bg-dark-border'
              }`}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mb-6">
          {violations} of {limit} off-task events used in this session
        </p>

        {removed ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your teacher has been notified. You will need them to readmit you before you can rejoin.
            </p>
            <Button variant="secondary" onClick={onLeave} className="w-full flex items-center justify-center gap-2">
              <ArrowLeft size={15} /> Back to dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="primary" onClick={onAcknowledge} className="w-full flex items-center justify-center gap-2">
              <MonitorUp size={15} /> I'm back — resume class
            </Button>
            <button onClick={onLeave} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              Leave the class instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OffTaskOverlay;
