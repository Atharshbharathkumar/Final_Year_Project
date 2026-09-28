import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, Button, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { HelpCircle, Activity, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { alseApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

const LearningSimulator = () => {
  const { addToast } = useToast();
  const fetchSimulator = useCallback(() => alseApi.simulator(), []);
  const { data: sim, loading, error, refetch } = useApi(fetchSimulator, []);

  const [selectedScenario, setSelectedScenario] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Select the first scenario once the forecast arrives.
  useEffect(() => {
    if (sim?.scenarios?.length && !selectedScenario) {
      setSelectedScenario(sim.scenarios[0]);
    }
  }, [sim, selectedScenario]);

  const handleSimulate = (scenario) => {
    setSelectedScenario(scenario);
    setIsSimulating(true);
    // Brief pause so the forecast reads as a deliberate model run.
    setTimeout(() => setIsSimulating(false), 700);
  };

  if (loading) return <LoadingState label="Running the cohort model…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const scenarios = sim?.scenarios || [];

  return (
    <div className="space-y-6 page-enter">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle size={24} className="text-cyan-400" /> What-If Learning Simulator
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Forecasts are computed against your live cohort — baseline engagement is currently {sim?.baselineEngagement ?? 0}%.
        </p>
      </motion.div>

      {scenarios.length === 0 ? (
        <EmptyState icon={Activity} title="No cohort to model" description="Enrol students to generate intervention forecasts." />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Scenario list */}
          <div className="lg:col-span-5 space-y-4">
            <GlassCard hover={false} className="h-full">
              <h3 className="text-sm font-semibold text-white mb-4">Intervention Scenarios</h3>
              <div className="space-y-3">
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => handleSimulate(sc)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedScenario?.id === sc.id && !isSimulating
                        ? 'bg-cyan-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20'
                        : 'bg-dark-bg/50 border-dark-border/50 hover:border-dark-borderHover'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className={`text-sm font-semibold ${selectedScenario?.id === sc.id && !isSimulating ? 'text-cyan-300' : 'text-white'}`}>
                        {sc.name}
                      </p>
                      {selectedScenario?.id === sc.id && !isSimulating && (
                        <Badge variant="cyan" className="animate-pulse">Active</Badge>
                      )}
                    </div>
                    <div className="flex gap-4 mt-3">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Predicted Eng: <span className="text-emerald-400 font-bold">{sc.impact}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Predicted Score: <span className="text-emerald-400 font-bold">{sc.assessment}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Forecast canvas */}
          <div className="lg:col-span-7">
            <GlassCard hover={false} className="h-full flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl opacity-50 pointer-events-none" />

              <div className="flex items-center gap-2 mb-8 pb-4 border-b border-dark-border">
                <Sparkles size={18} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Simulation Forecast</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/20 ml-auto">
                  Estimated Variables
                </span>
              </div>

              {isSimulating ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                  <Activity size={48} className="text-cyan-500 mb-6 opacity-80 animate-pulse" />
                  <p className="text-base font-semibold text-cyan-300 mb-2">Running AI Simulation Matrix…</p>
                  <p className="text-xs text-slate-400 max-w-sm text-center">Processing cohort data against the proposed intervention model.</p>
                </div>
              ) : selectedScenario ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedScenario.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex-1 flex flex-col justify-center space-y-8"
                  >
                    <div className="text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Modelled Intervention</p>
                      <h2 className="text-xl font-bold text-white">{selectedScenario.name}</h2>
                    </div>

                    <div className="bg-dark-bg/50 border border-dark-border rounded-2xl p-6 relative">
                      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-dark-border -translate-x-1/2" />
                      <div className="grid grid-cols-2 gap-8 text-center relative z-10">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Current Cohort</p>
                          <div className="space-y-4">
                            <div>
                              <p className="text-3xl font-bold text-white">{sim.currentStruggling}</p>
                              <p className="text-xs text-slate-500 mt-1">Struggling Students</p>
                            </div>
                            <div>
                              <p className="text-3xl font-bold text-slate-300">{sim.baselineEngagement}%</p>
                              <p className="text-xs text-slate-500 mt-1">Class Engagement</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider mb-4">Predicted Outcome</p>
                          <div className="space-y-4">
                            <div>
                              <p className="text-3xl font-bold text-emerald-400 flex items-center justify-center gap-2">
                                {selectedScenario.result}
                                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                  -{sim.currentStruggling - selectedScenario.result}
                                </span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1">Struggling Students</p>
                            </div>
                            <div>
                              <p className="text-3xl font-bold text-cyan-400 flex items-center justify-center gap-2">
                                <TrendingUp size={20} className="text-cyan-400" /> {selectedScenario.impact}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">Class Engagement</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-dark-border flex justify-between items-center gap-4">
                      <p className="text-[10px] text-slate-500 md:max-w-xs leading-relaxed italic">
                        * Probabilistic estimates derived from the current cohort distribution. Not guarantees of student performance.
                      </p>
                      <Button
                        variant="primary" size="sm" className="hidden sm:flex items-center gap-2 shrink-0"
                        onClick={() => addToast('Route this scenario through the Intervention Center to apply it per student.', 'info')}
                      >
                        Apply Intervention <ChevronRight size={14} />
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-slate-500">Select a scenario to forecast outcomes.</p>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningSimulator;