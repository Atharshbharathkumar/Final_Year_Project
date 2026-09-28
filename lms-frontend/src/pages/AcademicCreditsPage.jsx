import React, { useCallback } from 'react';
import { GlassCard, Badge, ProgressBar, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { Trophy, Medal, Star, Target, Calendar, Sparkles, Hexagon } from 'lucide-react';
import { campusApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const AcademicCreditsPage = () => {
  const fetchCredits = useCallback(() => campusApi.credits(), []);
  const { data: wallet, loading, error, refetch } = useApi(fetchCredits, []);

  if (loading) return <LoadingState label="Loading your credits wallet…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const total = wallet?.total ?? 0;
  const target = wallet?.target ?? 60;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy size={24} className="text-amber-400" /> Academic Credits Wallet
          </h1>
          <p className="text-sm text-slate-400 mt-1">Unlock achievements and earn credits through co-curricular activities.</p>
        </div>
        <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold rounded-xl flex items-center gap-2">
          <Star size={16} className="fill-amber-400" /> {wallet?.levelLabel}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <GlassCard hover={false} className="lg:col-span-1 p-8 text-center flex flex-col justify-center items-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 group-hover:from-amber-500/10 group-hover:to-orange-500/10 transition-colors" />
          <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
            <Hexagon size={96} className="text-amber-500/20 absolute inset-0" strokeWidth={1} />
            <Trophy size={40} className="text-amber-400 relative z-10" />
          </div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-1">Total Balance</h2>
          <p className="text-6xl font-bold text-white mb-2 tracking-tight">{total}</p>
          <p className="text-xs text-slate-400 mb-6 font-medium">Credits Earned</p>

          <div className="w-full space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Progress to Target</span>
              <span>{total} / {target}</span>
            </div>
            <ProgressBar value={(total / target) * 100} color="from-amber-400 to-orange-500" showValue={false} height="h-2" />
            <p className="text-[10px] text-slate-500 text-left mt-2 italic">
              {wallet?.remainingForHonors > 0
                ? `${wallet.remainingForHonors} credits needed to graduate with honours.`
                : 'Honours credit threshold reached.'}
            </p>
          </div>
        </GlassCard>

        {/* Categories */}
        <GlassCard hover={false} className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Target size={16} className="text-brand-400" /> Earning Categories
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {(wallet?.categories || []).map((cat, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-dark-bg/50 border border-dark-border/50 hover:border-dark-borderHover transition-colors cursor-pointer group">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}20`, border: `1px solid ${cat.color}40`, color: cat.color }}
                >
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">{cat.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (cat.earned / (cat.categoryMax || 15)) * 100)}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-6 text-right">{cat.earned}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Achievement Timeline */}
      <GlassCard hover={false}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Medal size={16} className="text-amber-400" /> Recent Achievements
          </h3>
          <Badge variant="brand">{(wallet?.achievements || []).length} total</Badge>
        </div>

        {(wallet?.achievements || []).length === 0 ? (
          <EmptyState icon={Medal} title="No achievements yet" description="Attend workshops and competitions to earn credits." />
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-dark-border before:to-transparent">
            {(wallet?.achievements || []).map((ach, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-dark-bg bg-amber-500 text-white shadow shadow-amber-500/50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 -translate-x-[22px] md:relative md:left-auto">
                  <Sparkles size={12} />
                </div>
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl bg-dark-bg border border-dark-border/50 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1"><Calendar size={10} /> {ach.date}</span>
                    <Badge variant="amber">+{ach.credits} cr</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{ach.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 capitalize">{ach.type} activity</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="text-center">
        <p className="text-[10px] text-slate-500 leading-relaxed italic">
          * Academic credits are recognised according to institutional policy.
        </p>
      </div>
    </div>
  );
};

export default AcademicCreditsPage;