import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard, Badge, Button, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { GraduationCap, Calendar, Clock, Timer, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { examApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const ExamsPage = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const fetchExams = useCallback(() => examApi.mine(), []);
  const { data: exams, loading, error, refetch } = useApi(fetchExams, [], { initialData: [] });

  if (loading) return <LoadingState label="Loading your assessments…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const list = exams || [];
  const upcoming = list.filter(e => e.status === 'upcoming');
  const completed = list.filter(e => e.status === 'completed');

  const ExamCard = ({ e }) => (
    <GlassCard className="flex flex-col group">
      <div className="flex items-start justify-between mb-3">
        <Badge variant={e.status === 'upcoming' ? 'warning' : 'success'}>
          {e.status === 'upcoming' ? 'Upcoming' : 'Completed'}
        </Badge>
        <Badge variant="info">{e.type}</Badge>
      </div>

      <h3 className="text-base font-semibold text-white leading-tight mb-1 group-hover:text-brand-300 transition-colors">
        {e.title}
      </h3>
      <p className="text-[11px] text-slate-400 mb-4">{e.course}</p>

      <div className="space-y-2 text-xs text-slate-400 mt-auto">
        <div className="flex items-center gap-2"><Calendar size={13} className="text-brand-400" /> {e.date}</div>
        <div className="flex items-center gap-2"><Clock size={13} className="text-violet-400" /> {e.time}</div>
        <div className="flex items-center gap-2"><Timer size={13} className="text-amber-400" /> {e.duration}</div>
      </div>

      {e.score != null && (
        <div className="mt-4 pt-4 border-t border-dark-border/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Your Score</span>
          <span className={`text-lg font-bold ${e.score >= 75 ? 'text-emerald-400' : e.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
            {e.score}%
          </span>
        </div>
      )}

      {isStudent && (
        <div className="mt-4 pt-4 border-t border-dark-border/50">
          <Link to={`/exams/${e.id}/take`} className="block">
            <Button
              variant={e.status === 'upcoming' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full flex items-center justify-center gap-1.5"
            >
              {e.status === 'upcoming' ? 'Start Exam' : 'View Result'} <ArrowRight size={14} />
            </Button>
          </Link>
          {e.status === 'upcoming' && (
            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1 justify-center">
              <ShieldAlert size={10} /> Proctored · one attempt
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GraduationCap size={24} className="text-brand-400" /> Examinations
        </h1>
        <p className="text-sm text-slate-400 mt-1">Proctored assessments across your enrolled courses.</p>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No exams scheduled" description="Assessments for your courses will appear here." />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-white">Upcoming ({upcoming.length})</h2>
            </div>
            {upcoming.length === 0 ? (
              <GlassCard hover={false} className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 size={40} className="text-emerald-500/30 mb-3" />
                <p className="text-sm font-semibold text-white">No upcoming assessments</p>
              </GlassCard>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {upcoming.map(e => <ExamCard key={e.id} e={e} />)}
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-white px-1">Completed ({completed.length})</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {completed.map(e => <ExamCard key={e.id} e={e} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ExamsPage;