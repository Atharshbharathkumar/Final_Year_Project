import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, Badge, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { User, Activity, Brain, Clock, HelpCircle, Star, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { alseApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const DigitalTwin = () => {
  const fetchTwin = useCallback(() => alseApi.digitalTwin(), []);
  const { data: twin, loading, error, refetch } = useApi(fetchTwin, []);

  if (loading) return <LoadingState label="Assembling the learner profile…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const dominant = twin?.dominantState;
  const successRate = twin?.interventionSuccessRate ?? 0;
  const circumference = 283;

  return (
    <div className="space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User size={24} className="text-indigo-400" /> Student Profile / Digital Twin
        </h1>
        <p className="text-sm text-slate-400 mt-1">An evolving, non-stigmatizing learning profile showing characteristics, habits, and optimal contexts.</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Core identity */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <GlassCard hover={false} className="h-full flex flex-col items-center justify-center text-center relative overflow-hidden p-8 border-indigo-500/20">
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/20 to-transparent" />
            <div className="w-24 h-24 rounded-full border-4 border-dark-bg bg-gradient-to-br from-indigo-500 to-brand-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-indigo-500/20 relative z-10 mb-4">
              {(twin?.student || '?').charAt(0)}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 relative z-10">{twin?.student}</h2>
            <Badge variant="brand" className="mb-6 relative z-10">{twin?.cohort}</Badge>

            <div className="w-full space-y-4 text-left relative z-10 mt-auto pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-2 shrink-0"><Clock size={14} /> Peak Learning</span>
                <span className="text-xs font-semibold text-white text-right">{twin?.characteristics?.peakLearning}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-2 shrink-0"><Star size={14} /> Strongest Format</span>
                <span className="text-xs font-semibold text-emerald-400 text-right">{twin?.characteristics?.bestPerformance}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 flex items-center gap-2 shrink-0"><HelpCircle size={14} /> Current Challenge</span>
                <span className="text-xs font-semibold text-amber-400 text-right">{twin?.characteristics?.difficulty}</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* State distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="lg:col-span-2">
          <GlassCard hover={false} className="h-full">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <Activity size={18} className="text-brand-400" /> Historical Learning State Distribution
            </h3>

            {(twin?.stateDistribution || []).length === 0 ? (
              <EmptyState icon={Activity} title="No state history" description="States accumulate as attention telemetry is captured." />
            ) : (
              <div className="grid md:grid-cols-2 gap-8 items-center h-[280px]">
                <div className="h-full w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={twin.stateDistribution}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100}
                        paddingAngle={5} dataKey="value" stroke="none"
                      >
                        {twin.stateDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(19,27,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-white">{dominant?.value ?? 0}%</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold mt-1" style={{ color: dominant?.color }}>
                      {dominant?.name}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {twin.stateDistribution.map((state, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-slate-300 font-medium">{state.name}</span>
                          <span className="text-xs font-bold text-white">{state.value}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-dark-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${state.value}%`, backgroundColor: state.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
            <Star size={16} className="text-amber-400" /> Academic Highlights
          </h3>
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Highest Mastery Area</p>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-100 flex items-start gap-3">
                <div className="mt-0.5"><Zap size={16} className="text-emerald-400" /></div>
                <p className="text-sm leading-relaxed">{twin?.characteristics?.strongest}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Growth Opportunity</p>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-100 flex items-start gap-3">
                <div className="mt-0.5"><Brain size={16} className="text-amber-400" /></div>
                <p className="text-sm leading-relaxed">{twin?.characteristics?.weakest}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard hover={false} className="flex flex-col justify-center text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Intervention Success Rate</h3>
          <div className="relative w-48 h-48 mx-auto mt-6">
            <svg viewBox="0 0 100 100" className="drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#twinGrad)" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (successRate / 100) * circumference}
                strokeLinecap="round" className="origin-center -rotate-90 transition-all duration-1000 ease-out" />
              <defs>
                <linearGradient id="twinGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white">{successRate}%</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-6 max-w-sm mx-auto">
            {twin?.interventionsObserved > 0
              ? `Measured across ${twin.interventionsObserved} delivered intervention(s) for this profile.`
              : 'No interventions have been delivered for this profile yet, so there is nothing to measure.'}
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default DigitalTwin;