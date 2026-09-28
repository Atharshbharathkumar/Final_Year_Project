import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, Badge, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { MonitorPlay, Target, Sparkles, Activity, Clock, ShieldAlert, ArrowRight } from 'lucide-react';
import { alseApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const stateBadgeVariant = (type) => {
  switch (type) {
    case 'positive': return 'success';
    case 'warning': return 'warning';
    case 'danger': return 'danger';
    default: return 'brand';
  }
};

const stateIcon = (state) => {
  switch (state) {
    case 'Deep Learning':
    case 'Focused': return <Target size={14} />;
    case 'Collaborative': return <Sparkles size={14} />;
    case 'Passive Learning': return <Clock size={14} />;
    case 'Distracted':
    case 'Struggling': return <ShieldAlert size={14} />;
    default: return <Activity size={14} />;
  }
};

const AdaptiveLearningState = () => {
  const fetchState = useCallback(() => alseApi.learningState(), []);
  const { data: view, loading, error, refetch } = useApi(fetchState, []);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (loading) return <LoadingState label="Reconstructing your learning states…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const current = view?.current;
  const score = view?.explainableScore;

  return (
    <div className="space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MonitorPlay size={24} className="text-brand-400" /> Adaptive Learning State Engine
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time identification of learning state transitions for {view?.studentName}, based on multimodal evidence.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Current state and explainable score */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <GlassCard hover={false} className={`relative overflow-hidden text-center p-8 ${
              current?.type === 'positive' ? 'border-emerald-500/30' :
              current?.type === 'warning' ? 'border-amber-500/30' :
              current?.type === 'danger' ? 'border-rose-500/30' : 'border-brand-500/30'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

              <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-4 relative z-10">Current Estimated State</h3>
              <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-4 relative z-10">
                <Target size={48} className="text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 relative z-10">{current?.state}</h2>
              <Badge variant={stateBadgeVariant(current?.type)} className="relative z-10">
                Confidence: {current?.confidence ?? 0}%
              </Badge>
              <p className="text-xs text-slate-400 mt-4 leading-relaxed relative z-10">{current?.description}</p>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <GlassCard hover={false}>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-brand-400" />
                <h3 className="text-sm font-semibold text-white">Explainable Engagement Score</h3>
              </div>

              <div className="flex items-end justify-between mb-6">
                <div>
                  <span className="text-5xl font-bold gradient-text">{score?.total ?? 0}</span>
                  <span className="text-sm text-slate-400 font-medium">/100</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Priority Focus Area</p>
                  <p className="text-xs font-semibold text-rose-400 mt-1">{score?.improvementArea}</p>
                </div>
              </div>

              <div className="space-y-4">
                {(score?.breakdown || []).map((f, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] text-slate-300">{f.factor}</span>
                      <span className="text-[11px] font-bold text-emerald-400">
                        +{f.impact} <span className="text-slate-500 font-normal">/ {f.max}</span>
                      </span>
                    </div>
                    <ProgressBar value={(f.impact / f.max) * 100} color="from-brand-500 to-indigo-500" showValue={false} height="h-1" />
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Evidence timeline */}
        <div className="lg:col-span-2">
          <GlassCard hover={false} className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-dark-border">
              <div>
                <h3 className="text-lg font-semibold text-white">Learning State Transitions</h3>
                <p className="text-xs text-slate-400 mt-1">Contextual evidence triggering each engine state change.</p>
              </div>
              <Badge variant="brand" className="animate-pulse">Live Tracking Active</Badge>
            </div>

            {(view?.timeline || []).length === 0 ? (
              <EmptyState icon={Activity} title="No transitions recorded" description="States appear once attention telemetry is captured." />
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-6 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-brand-500/20 before:via-dark-border before:to-transparent flex-1"
              >
                {(view?.timeline || []).map((log, i) => (
                  <motion.div variants={item} key={i} className="relative flex items-start group">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 border-dark-bg shrink-0 absolute left-0 -translate-x-[22px] transition-transform group-hover:scale-110 z-10 ${
                      log.type === 'positive' ? 'bg-emerald-500 text-white' :
                      log.type === 'warning' ? 'bg-amber-500 text-white' :
                      log.type === 'danger' ? 'bg-rose-500 text-white' : 'bg-brand-500 text-white'
                    }`}>
                      {stateIcon(log.state)}
                    </div>
                    <div className="w-full pl-6">
                      <div className={`p-4 rounded-xl border transition-colors ${
                        log.type === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' :
                        log.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10' :
                        log.type === 'danger' ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10' :
                        'bg-brand-500/5 border-brand-500/20 hover:bg-brand-500/10'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 font-mono">{log.time}</span>
                            <span className="text-slate-600 px-1"><ArrowRight size={12} /></span>
                            <span className={`text-sm font-bold ${
                              log.type === 'positive' ? 'text-emerald-400' :
                              log.type === 'warning' ? 'text-amber-400' :
                              log.type === 'danger' ? 'text-rose-400' : 'text-brand-400'
                            }`}>{log.state}</span>
                          </div>
                          <Badge variant={stateBadgeVariant(log.type)}>{log.confidence}% Conf</Badge>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[11px] text-slate-400 uppercase font-semibold mb-1">Contextual Evidence</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{log.evidence}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            <div className="mt-8 p-3 rounded-lg bg-dark-bg border border-dark-border text-center">
              <p className="text-[10px] text-slate-500">
                Learning states are predictions generated by fusing attention telemetry with coursework activity. Human verification recommended.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveLearningState;