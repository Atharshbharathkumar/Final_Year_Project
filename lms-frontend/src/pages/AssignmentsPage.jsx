import React, { useState, useCallback } from 'react';
import { GlassCard, Badge, Button, Modal, LoadingState, ErrorState, EmptyState } from '../components/ui/Components';
import { FileText, Clock, AlertCircle, CheckCircle2, ChevronRight, UploadCloud, FileUp, Plus, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateAssignmentModal } from '../components/teacher/AuthoringModals';
import { assignmentApi, errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useCountdown } from '../hooks/useRealtime';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const statusBadge = (status) => {
  switch (status) {
    case 'pending': return <Badge variant="warning">Pending</Badge>;
    case 'submitted': return <Badge variant="info">Submitted</Badge>;
    case 'in-progress': return <Badge variant="brand">In Progress</Badge>;
    case 'graded': return <Badge variant="success">Graded</Badge>;
    default: return <Badge variant="brand">{status}</Badge>;
  }
};

const AssignmentCard = ({ a, onStart, onSubmit, busy }) => {
  const { label, status: countdownStatus } = useCountdown(a.dueDateTime || `${a.dueDate}T23:59:59`);

  const priorityIcon = {
    high: <AlertCircle size={16} className="text-rose-400" />,
    medium: <Clock size={16} className="text-amber-400" />,
    low: <CheckCircle2 size={16} className="text-emerald-400" />,
  }[a.priority];

  return (
    <GlassCard hover className="flex flex-col border border-dark-border/50 hover:border-brand-500/30 transition-all justify-between group h-full">
      <div>
        <div className="flex items-start justify-between mb-3">
          {statusBadge(a.status)}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-dark-bg/60 border border-dark-border text-[10px] uppercase font-bold tracking-wider text-slate-300">
            {priorityIcon} {a.priority}
          </div>
        </div>
        <h3 className="text-base font-semibold text-white leading-tight mb-1 group-hover:text-brand-300 transition-colors">{a.title}</h3>
        <p className="text-[11px] text-slate-400 mb-4">{a.course}</p>
      </div>

      <div className="mt-auto space-y-4">
        <div className={`flex flex-col p-2.5 rounded-lg border ${
          countdownStatus === 'overdue' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
          countdownStatus === 'urgent' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
          'bg-dark-bg/50 border-dark-border/50 text-slate-300'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold">Time Remaining</span>
            <span className="text-xs font-bold text-white">{a.points} pts</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-semibold">
            <Clock size={14} /> {label}
          </div>
        </div>
        <div className="flex gap-2">
          {a.status === 'in-progress' ? (
            <Button variant="primary" size="sm" disabled={busy} className="w-full flex justify-center gap-1 group/btn" onClick={() => onSubmit(a)}>
              Submit <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled={busy} className="w-full flex justify-center gap-1 group/btn hover:border-brand-500/50 hover:text-brand-300" onClick={() => onStart(a)}>
              Start <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

const AssignmentsPage = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const fetchAssignments = useCallback(() => assignmentApi.my(), []);
  const { data: assignments, loading, error, refetch } = useApi(fetchAssignments, [], { initialData: [] });

  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = assignments || [];
  const upcoming = list.filter(a => a.status === 'pending' || a.status === 'in-progress');
  const past = list.filter(a => a.status === 'submitted' || a.status === 'graded');

  const handleStart = async (assignment) => {
    setBusy(true);
    try {
      await assignmentApi.start(assignment.id);
      await refetch();
      addToast(`Started working on: ${assignment.title}`, 'info');
    } catch (err) {
      addToast(errorMessage(err, 'Could not start this assignment.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSubmit = (assignment) => {
    setSelectedAssignment(assignment);
    setIsSubmitModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!selectedAssignment) return;
    setBusy(true);
    try {
      await assignmentApi.submit(selectedAssignment.id, `${selectedAssignment.title.replace(/\s+/g, '_')}.pdf`);
      await refetch();
      addToast(`"${selectedAssignment.title}" submitted successfully! 🎉`, 'success');
      setIsSubmitModalOpen(false);
    } catch (err) {
      addToast(errorMessage(err, 'Submission failed.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading coursework…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={24} className="text-brand-400" /> {isTeacher ? 'Course Assignments' : 'My Assignments'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isTeacher ? 'Submission status across the courses you own.' : 'Live tracking of your coursework and deadlines.'}
          </p>
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/grading">
              <Button variant="secondary" className="flex items-center gap-2">
                <ClipboardCheck size={16} /> Grade Submissions
              </Button>
            </Link>
            <Button variant="primary" onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
              <Plus size={16} /> New Assignment
            </Button>
          </div>
        )}
      </div>

      <CreateAssignmentModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-white">{isTeacher ? 'Open Assignments' : 'Action Required'}</h2>
          </div>

          {upcoming.length === 0 ? (
            <GlassCard hover={false} className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 size={48} className="text-emerald-500/30 mb-4" />
              <p className="text-lg font-semibold text-white mb-2">You're all caught up!</p>
              <p className="text-sm text-slate-400 max-w-sm">No pending assignments. Take a break or explore upcoming course materials.</p>
            </GlassCard>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {upcoming.map((a) => (
                <div key={a.id} className="h-full">
                  <AssignmentCard a={a} onStart={handleStart} onSubmit={handleOpenSubmit} busy={busy} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white px-1">{isTeacher ? 'Completed' : 'Recent Submissions'}</h2>
          <div className="space-y-3">
            {past.map(a => (
              <div key={a.id} className="p-4 rounded-xl bg-dark-card border border-dark-border hover:border-dark-borderHover transition-colors flex flex-col cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  {statusBadge(a.status)}
                  {a.grade != null && <span className="text-sm font-bold text-emerald-400 tabular-nums">{a.grade}/{a.points}</span>}
                </div>
                <p className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition-colors">{a.title}</p>
                <p className="text-[10px] text-slate-500 truncate mb-3">{a.course}</p>

                {a.feedback && (
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3 line-clamp-2">{a.feedback}</p>
                )}

                <div className="mt-auto pt-3 border-t border-dark-border/50 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500/50" />
                    {a.submittedOn ? `Submitted ${a.submittedOn}` : `Due ${a.dueDate}`}
                  </div>
                </div>
              </div>
            ))}

            {past.length === 0 && (
              <EmptyState icon={UploadCloud} title="No submissions yet" description="Submitted work appears here." />
            )}
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      <Modal isOpen={isSubmitModalOpen} onClose={() => !busy && setIsSubmitModalOpen(false)} title="Submit Assignment">
        {selectedAssignment && (
          <div className="space-y-5">
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
              <p className="text-xs text-brand-300 font-semibold mb-1">Submitting for</p>
              <p className="text-sm text-white font-medium">{selectedAssignment.title}</p>
              <p className="text-[10px] text-brand-400">{selectedAssignment.course}</p>
            </div>

            <div className="border-2 border-dashed border-dark-border hover:border-brand-500/50 rounded-xl p-8 text-center transition-colors">
              <FileUp size={32} className="mx-auto text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-white mb-1">Attach your work</p>
              <p className="text-xs text-slate-400">The submission is recorded against your account on the server.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
              <Button variant="ghost" onClick={() => setIsSubmitModalOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant="primary" onClick={handleFinalSubmit} disabled={busy} className="flex items-center gap-2">
                {busy ? 'Submitting…' : 'Submit Now'} <CheckCircle2 size={16} />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AssignmentsPage;