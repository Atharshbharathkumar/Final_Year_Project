import React, { useEffect, useState } from 'react';
import { assignmentApi, courseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Plus, Clock, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

const fmtDate = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const Assignments = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState('');
  const [draftLink, setDraftLink] = useState('');
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', description: '', dueDate: '', maxMarks: 50 });

  const load = () => {
    setLoading(true);
    const calls = isTeacher
      ? [courseApi.getAll()]
      : [assignmentApi.getMine(), assignmentApi.getMySubmissions()];

    Promise.all(calls)
      .then((res) => {
        if (isTeacher) {
          setCourses(res[0].data || []);
          const all = (res[0].data || []).map((c) => assignmentApi.getByCourse(c.id));
          return Promise.all(all).then((lists) => {
            setAssignments(lists.flatMap((l) => l.data || []));
          });
        }
        setAssignments(res[0].data || []);
        setSubmissions(res[1].data || []);
      })
      .then(() => { setError(null); setLoading(false); })
      .catch(() => { setError('Could not load assignments from the server.'); setLoading(false); });
  };

  useEffect(load, [isTeacher]);

  const submissionFor = (assignmentId) =>
    submissions.find((s) => s.assignment?.id === assignmentId);

  const handleSubmit = async (assignmentId) => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await assignmentApi.submit(assignmentId, { content: draft, linkUrl: draftLink || null });
      setOpenId(null); setDraft(''); setDraftLink('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.courseId || !form.title.trim()) return;
    setBusy(true);
    try {
      await assignmentApi.create(form.courseId, {
        title: form.title,
        description: form.description,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 19) : null,
        maxMarks: Number(form.maxMarks) || 50,
      });
      setShowCreate(false);
      setForm({ courseId: '', title: '', description: '', dueDate: '', maxMarks: 50 });
      load();
    } catch (err) {
      setError('Could not create the assignment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-400" /> Assignments
          </h1>
          <p className="text-xs text-slate-400">
            {isTeacher ? 'Set work and grade submissions' : 'Work set across your enrolled courses'}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New assignment
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="p-5 rounded-2xl glass-card border border-indigo-500/30 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
              required
            >
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>)}
            </select>
            <input
              type="number" min="1" max="1000" value={form.maxMarks}
              onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
              placeholder="Max marks"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
            />
          </div>
          <input
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title" required
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          <textarea
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description / brief" rows={3}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          <input
            type="datetime-local" value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          <button disabled={busy} type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create assignment'}
          </button>
        </form>
      )}

      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}

      {!loading && assignments.length === 0 && (
        <div className="p-12 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
          <ClipboardList className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No assignments yet</p>
          <p className="text-xs text-slate-500">
            {isTeacher ? 'Create one above.' : 'Nothing has been set for your courses.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((a) => {
          const sub = submissionFor(a.id);
          const overdue = a.dueDate && new Date(a.dueDate) < new Date() && !sub;

          return (
            <div key={a.id} className="p-5 rounded-2xl glass-card border border-dark-border space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {a.course?.courseCode} · {a.maxMarks} marks · due {fmtDate(a.dueDate)}
                  </p>
                </div>
                <div className="shrink-0">
                  {sub?.marksAwarded != null ? (
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {sub.marksAwarded} / {a.maxMarks}
                    </span>
                  ) : sub ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      SUBMITTED
                    </span>
                  ) : overdue ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      OVERDUE
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-700/40 text-slate-300 border border-slate-600/40">
                      NOT SUBMITTED
                    </span>
                  )}
                </div>
              </div>

              {a.description && <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>}

              {sub?.feedback && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Feedback
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">{sub.feedback}</p>
                </div>
              )}

              {sub?.late && (
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Submitted after the deadline
                </p>
              )}

              {!isTeacher && !sub && (
                openId === a.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft} onChange={(e) => setDraft(e.target.value)}
                      rows={4} placeholder="Your answer…"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
                    />
                    <input
                      value={draftLink} onChange={(e) => setDraftLink(e.target.value)}
                      placeholder="Optional link (repo, document)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSubmit(a.id)} disabled={busy || !draft.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" /> {busy ? 'Submitting…' : 'Submit'}
                      </button>
                      <button
                        onClick={() => setOpenId(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setOpenId(a.id); setDraft(''); setDraftLink(''); }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5" /> Start submission
                  </button>
                )
              )}

              {isTeacher && <TeacherSubmissions assignment={a} onGraded={load} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeacherSubmissions = ({ assignment, onGraded }) => {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState([]);
  const [marks, setMarks] = useState({});
  const [feedback, setFeedback] = useState({});
  const [error, setError] = useState(null);

  const load = () => {
    assignmentApi.getSubmissions(assignment.id)
      .then((res) => { setSubs(res.data || []); setError(null); })
      .catch(() => setError('Could not load submissions.'));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const grade = async (submissionId) => {
    try {
      await assignmentApi.grade(submissionId, {
        marksAwarded: Number(marks[submissionId]),
        feedback: feedback[submissionId] || '',
      });
      load();
      onGraded?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Grading failed.');
    }
  };

  return (
    <div className="pt-3 border-t border-slate-800">
      <button onClick={toggle} className="text-xs font-bold text-indigo-400 hover:underline">
        {open ? 'Hide submissions' : 'View submissions'}
      </button>

      {error && <p className="mt-2 text-[11px] text-rose-300 font-semibold">{error}</p>}

      {open && (
        <div className="mt-3 space-y-3">
          {subs.length === 0 && <p className="text-xs text-slate-500">No submissions yet.</p>}
          {subs.map((s) => (
            <div key={s.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{s.student?.fullName}</span>
                <span className="text-[10px] font-mono text-slate-500">{fmtDate(s.submittedAt)}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{s.content}</p>
              {s.linkUrl && (
                <a href={s.linkUrl} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-400 hover:underline break-all">
                  {s.linkUrl}
                </a>
              )}

              {s.marksAwarded != null ? (
                <p className="text-[11px] font-bold text-emerald-400">
                  Graded {s.marksAwarded} / {assignment.maxMarks}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number" min="0" max={assignment.maxMarks}
                    value={marks[s.id] ?? ''} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
                    placeholder={`/ ${assignment.maxMarks}`}
                    className="w-24 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <input
                    value={feedback[s.id] ?? ''} onChange={(e) => setFeedback({ ...feedback, [s.id]: e.target.value })}
                    placeholder="Feedback"
                    className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <button
                    onClick={() => grade(s.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Grade
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
