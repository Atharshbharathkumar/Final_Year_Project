import React, { useState, useCallback, useMemo } from 'react';
import { GlassCard, Badge, Button, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { ClipboardCheck, FileText, Clock, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { assignmentApi, errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';

const GradingPage = () => {
  const { addToast } = useToast();
  const [includeGraded, setIncludeGraded] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [mark, setMark] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchQueue = useCallback(() => assignmentApi.submissions(includeGraded), [includeGraded]);
  const { data: submissions, loading, error, refetch } = useApi(fetchQueue, [includeGraded], { initialData: [] });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return submissions || [];
    return (submissions || []).filter(s =>
      s.studentName.toLowerCase().includes(term) ||
      s.assignmentTitle.toLowerCase().includes(term) ||
      (s.courseCode || '').toLowerCase().includes(term)
    );
  }, [submissions, search]);

  const pendingCount = (submissions || []).filter(s => s.status === 'submitted').length;

  const open = (submission) => {
    setSelected(submission);
    setMark(submission.grade != null ? String(submission.grade) : '');
    setFeedback(submission.feedback || '');
  };

  const save = async () => {
    if (!selected) return;
    const value = Number(mark);
    if (mark === '' || Number.isNaN(value)) {
      addToast('Enter a mark before saving.', 'error');
      return;
    }
    if (value < 0 || value > selected.points) {
      addToast(`Mark must be between 0 and ${selected.points}.`, 'error');
      return;
    }

    setSaving(true);
    try {
      await assignmentApi.grade(selected.id, value, feedback);
      await refetch();
      addToast(`${selected.studentName} graded ${value}/${selected.points}. Their record has been updated.`, 'success');
      setSelected(null);
      setMark('');
      setFeedback('');
    } catch (err) {
      addToast(errorMessage(err, 'Could not save this mark.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !submissions?.length) return <LoadingState label="Loading the grading queue…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck size={24} className="text-emerald-400" /> Grading Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {pendingCount > 0
              ? `${pendingCount} submission${pendingCount === 1 ? '' : 's'} awaiting a mark.`
              : 'Nothing is waiting on you.'}
            {' '}Marks feed straight into each student's GPA and engagement score.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student or task…"
              className="pl-8 pr-3 py-2 bg-dark-card border border-dark-border rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 w-56"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={includeGraded} onChange={e => setIncludeGraded(e.target.checked)}
              className="accent-brand-500" />
            Show graded
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={search ? 'No matching submissions' : 'Grading queue is empty'}
          description={search
            ? `Nothing matches "${search}".`
            : 'When students submit work on your courses it appears here for marking.'}
        />
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Queue */}
          <div className="lg:col-span-2 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {list.map(s => (
              <button
                key={s.id}
                onClick={() => open(s)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected?.id === s.id
                    ? 'bg-brand-500/10 border-brand-500/40 ring-1 ring-brand-500/20'
                    : 'bg-dark-card border-dark-border hover:border-dark-borderHover'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{s.studentAvatar}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.studentName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{s.courseCode}</p>
                    </div>
                  </div>
                  {s.status === 'graded'
                    ? <Badge variant="success">{s.grade}/{s.points}</Badge>
                    : <Badge variant="warning">To mark</Badge>}
                </div>
                <p className="text-xs text-slate-300 truncate">{s.assignmentTitle}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {s.submittedAt || '—'}</span>
                  {s.late && <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> Late</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Marking panel */}
          <div className="lg:col-span-3">
            {!selected ? (
              <GlassCard hover={false} className="h-full flex items-center justify-center min-h-[320px]">
                <EmptyState icon={FileText} title="Select a submission" description="Choose an item from the queue to mark it." />
              </GlassCard>
            ) : (
              <GlassCard hover={false} className="sticky top-20">
                <div className="pb-4 mb-5 border-b border-dark-border">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-semibold text-white">{selected.assignmentTitle}</h3>
                    {selected.late && <Badge variant="warning">Late</Badge>}
                  </div>
                  <p className="text-xs text-slate-400">
                    {selected.studentName} · {selected.studentEmail}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selected.courseName} · submitted {selected.submittedAt || '—'}
                    {selected.fileName ? ` · ${selected.fileName}` : ''}
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Mark (out of {selected.points})
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min={0} max={selected.points} value={mark}
                        onChange={e => setMark(e.target.value)}
                        className="w-28 px-3 py-2.5 rounded-xl bg-dark-bg border border-dark-border text-lg font-bold text-white text-center focus:outline-none focus:border-brand-500/50"
                      />
                      <span className="text-slate-500 text-sm">/ {selected.points}</span>
                      <div className="flex gap-1.5 ml-auto">
                        {[0.5, 0.7, 0.85, 1].map(f => (
                          <button
                            key={f}
                            onClick={() => setMark(String(Math.round(selected.points * f)))}
                            className="px-2.5 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-[11px] text-slate-400 hover:text-white hover:border-dark-borderHover transition-colors"
                          >
                            {Math.round(f * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Feedback to the student</label>
                    <textarea
                      value={feedback} onChange={e => setFeedback(e.target.value)} rows={6}
                      placeholder="What was strong, and what should they do differently next time?"
                      className="w-full p-3 rounded-xl bg-dark-bg border border-dark-border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/50 leading-relaxed"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/15">
                    <p className="text-[11px] text-brand-300 leading-relaxed">
                      Saving notifies {selected.studentName.split(' ')[0]} immediately and recomputes their GPA,
                      assignment completion and engagement score.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={save} disabled={saving} className="flex items-center gap-2">
                      {saving ? 'Saving…' : 'Save mark'} <CheckCircle2 size={16} />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GradingPage;