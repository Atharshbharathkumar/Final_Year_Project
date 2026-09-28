import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, Badge, Button, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { Target, CheckCircle2, XCircle, Brain, RefreshCw } from 'lucide-react';
import { alseApi, errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

const AIInterventionCenter = () => {
  const { addToast } = useToast();
  const [busyId, setBusyId] = useState(null);

  const fetchInterventions = useCallback(() => alseApi.interventions(), []);
  const { data: summary, loading, error, refetch } = useApi(fetchInterventions, []);

  const decide = async (intervention, approve) => {
    setBusyId(intervention.id);
    try {
      await (approve ? alseApi.approve(intervention.id) : alseApi.reject(intervention.id));
      await refetch();
      addToast(
        approve
          ? `Intervention delivered for ${intervention.student}. Outcome is now being measured.`
          : `Intervention rejected for ${intervention.student}.`,
        approve ? 'success' : 'info'
      );
    } catch (err) {
      addToast(errorMessage(err, 'Could not update this intervention.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Scanning cohort for at-risk students…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const interventions = summary?.interventions || [];

  return (
    <div className="space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target size={24} className="text-rose-400" /> AI Intervention Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">Review AI-detected struggling students, approve interventions, and observe measured outcomes.</p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6 mb-8 text-center">
        <GlassCard hover={false} className="p-4 border-l-4 border-l-brand-500">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Detect & Explain</h3>
          <p className="text-2xl font-bold text-white">{summary?.atRisk ?? 0}</p>
          <p className="text-[10px] text-brand-400 mt-1">Students identified at-risk</p>
        </GlassCard>
        <GlassCard hover={false} className="p-4 border-l-4 border-l-amber-500">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Intervene</h3>
          <p className="text-2xl font-bold text-white">{summary?.pending ?? 0}</p>
          <p className="text-[10px] text-amber-400 mt-1">Actions pending approval</p>
        </GlassCard>
        <GlassCard hover={false} className="p-4 border-l-4 border-l-emerald-500">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Measured Impact</h3>
          <p className="text-2xl font-bold text-white">
            {(summary?.averageImprovement ?? 0) >= 0 ? '+' : ''}{summary?.averageImprovement ?? 0}%
          </p>
          <p className="text-[10px] text-emerald-400 mt-1">Avg change post-intervention</p>
        </GlassCard>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Recommended Actions Loop</h3>

        {interventions.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No interventions required"
            description="No student in your cohort currently meets the at-risk threshold."
          />
        ) : interventions.map((intervention, index) => (
          <motion.div
            key={intervention.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <GlassCard hover={false} className={`p-0 overflow-hidden border-2 ${
              intervention.status === 'Pending' ? 'border-amber-500/30' : 'border-dark-border/50'
            }`}>
              <div className="bg-dark-bg/80 border-b border-dark-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg">
                    {intervention.student.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">{intervention.student}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 uppercase">State Trigger:</span>
                      <Badge variant={
                        intervention.currentState === 'Struggling' || intervention.currentState === 'Distracted' ? 'danger' : 'warning'
                      }>
                        {intervention.currentState}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge variant={
                  intervention.status === 'Delivered' ? 'success' :
                  intervention.status === 'Pending' ? 'warning' :
                  intervention.status === 'Rejected' ? 'danger' : 'info'
                }>
                  Status: {intervention.status}
                </Badge>
              </div>

              <div className="p-5 grid lg:grid-cols-12 gap-6">
                {/* Evidence */}
                <div className="lg:col-span-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Brain size={14} className="text-violet-400" /> Evidence Explained
                  </h5>
                  <ul className="space-y-2">
                    {(intervention.evidence || []).map((ev, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" /> {ev}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendation */}
                <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-dark-border pt-4 lg:pt-0 lg:pl-6 space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Target size={14} className="text-amber-400" /> AI Recommendation
                  </h5>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-100 font-medium">{intervention.recommendation}</p>
                    <p className="text-[10px] text-amber-500/80 mt-2">Objective: {intervention.objective}</p>
                  </div>

                  {intervention.status === 'Pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="primary" size="sm" disabled={busyId === intervention.id}
                        className="flex-1 flex justify-center items-center gap-1"
                        onClick={() => decide(intervention, true)}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </Button>
                      <Button
                        variant="secondary" size="sm" disabled={busyId === intervention.id}
                        className="flex-1 flex justify-center items-center gap-1"
                        onClick={() => decide(intervention, false)}
                      >
                        <XCircle size={14} /> Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Outcome */}
                <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-dark-border pt-4 lg:pt-0 lg:pl-6 space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <RefreshCw size={14} className="text-emerald-400" /> Observed Outcome
                  </h5>
                  {intervention.outcome ? (
                    <div className="h-full flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-300">Metric Impact</span>
                        <span className={`text-sm font-bold ${
                          intervention.outcome.status === 'Positive' ? 'text-emerald-400' :
                          intervention.outcome.status === 'Negative' ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {intervention.outcome.improvement}
                        </span>
                      </div>
                      <ProgressBar
                        value={100}
                        color={intervention.outcome.status === 'Positive' ? 'from-emerald-500 to-teal-500' : 'from-slate-500 to-slate-400'}
                        showValue={false} height="h-1.5"
                      />
                      <p className="text-[10px] text-slate-400 mt-2">{intervention.outcome.metric}</p>
                      <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold text-slate-300">
                        State resolved to:
                        <Badge variant={intervention.outcome.resultingState === 'Deep Learning' ? 'success' : 'warning'}>
                          {intervention.outcome.resultingState}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-dark-border rounded-lg text-slate-500">
                      <RefreshCw size={24} className="mb-2 opacity-50 mx-auto" />
                      <p className="text-[10px] uppercase">Awaiting intervention delivery to measure impact.</p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AIInterventionCenter;