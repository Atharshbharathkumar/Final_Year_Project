import React, { useCallback, useState } from 'react';
import { GlassCard, ProgressBar, Button, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { BookOpen, User, Calendar, Activity, ChevronRight, Users, Plus } from 'lucide-react';
import { courseApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { CreateCourseModal } from '../components/teacher/AuthoringModals';

const CoursesPage = () => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const fetchCourses = useCallback(() => courseApi.my(), []);
  const { data: courses, loading, error, refetch } = useApi(fetchCourses, [], { initialData: [] });

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  if (loading) return <LoadingState label="Loading courses…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={24} className="text-brand-400" /> {isTeacher ? 'Courses You Teach' : 'My Courses'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isTeacher
              ? 'Cohort progress and grades across the courses you own.'
              : 'Manage and track progress across all your enrolled subjects.'}
          </p>
        </div>
        {isTeacher && (
          <Button variant="primary" onClick={() => setCreateOpen(true)} className="flex items-center gap-2 shrink-0">
            <Plus size={16} /> New Course
          </Button>
        )}
      </div>

      <CreateCourseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />

      {(courses || []).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description={isTeacher ? 'You do not own any courses.' : 'You are not enrolled in any courses yet.'}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {(courses || []).map((c) => (
            <GlassCard key={c.id} className="flex flex-col group cursor-pointer border-transparent hover:border-brand-500/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg relative"
                    style={{ backgroundColor: `${c.color}20`, border: `1px solid ${c.color}40` }}
                  >
                    {c.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white leading-tight mb-1 group-hover:text-brand-400 transition-colors">{c.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                      <span className="px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border">{c.code}</span>
                      <span>{c.credits} Credits</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User size={14} className="text-indigo-400" />
                  <span className="font-medium text-slate-300">{c.instructor}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar size={14} className="text-violet-400" />
                  <span>{c.semester}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Users size={14} className="text-emerald-400" />
                  <span>{c.enrolled} enrolled</span>
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Activity size={12} /> {isTeacher ? 'Cohort Progress' : 'Course Progress'}
                    </span>
                    <span className="text-xs font-bold text-white">{c.progress}%</span>
                  </div>
                  <ProgressBar value={c.progress} showValue={false} height="h-2" />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-dark-border/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      {isTeacher ? 'Cohort Grade' : 'Current Grade'}
                    </span>
                    <span className="text-sm font-bold text-white mt-0.5">{c.grade}</span>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors group-hover:translate-x-1 duration-300">
                    View Details <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;