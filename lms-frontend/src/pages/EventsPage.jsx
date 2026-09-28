import React, { useCallback } from 'react';
import { GlassCard, Badge, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { CalendarDays, MapPin, Clock, Trophy } from 'lucide-react';
import { campusApi } from '../services/api';
import { useApi } from '../hooks/useApi';

const typeStyles = {
  workshop: { variant: 'brand', emoji: '🔧' },
  competition: { variant: 'amber', emoji: '🏆' },
  seminar: { variant: 'info', emoji: '🎓' },
  career: { variant: 'success', emoji: '💼' },
};

const EventsPage = () => {
  const fetchEvents = useCallback(() => campusApi.events(), []);
  const { data: events, loading, error, refetch } = useApi(fetchEvents, [], { initialData: [] });

  if (loading) return <LoadingState label="Loading campus events…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays size={24} className="text-violet-400" /> Events Calendar
        </h1>
        <p className="text-sm text-slate-400 mt-1">Upcoming academic and co-curricular events, with the credits each one carries.</p>
      </div>

      {(events || []).length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events" description="Scheduled events will appear here." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(events || []).map(e => {
            const style = typeStyles[e.type] || { variant: 'brand', emoji: '📅' };
            return (
              <GlassCard key={e.id} className="flex flex-col group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center text-2xl">
                    {style.emoji}
                  </div>
                  <Badge variant={style.variant}>{e.type}</Badge>
                </div>

                <h3 className="text-base font-semibold text-white leading-tight mb-3 group-hover:text-brand-300 transition-colors">
                  {e.title}
                </h3>

                <div className="space-y-2 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={13} className="text-brand-400" /> {e.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-violet-400" /> {e.time}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-emerald-400" /> {e.location}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-dark-border/50 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Credits on completion</span>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-400">
                    <Trophy size={14} /> +{e.credits}
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsPage;