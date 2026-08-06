import React, { useEffect, useState } from 'react';
import { achievementApi, courseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Trophy, Plus, Trash2, Medal } from 'lucide-react';

const CATEGORY_STYLE = {
  ACADEMIC: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  SPORTS: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  PROJECT: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  EXTRACURRICULAR: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  OTHER: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
};

const CATEGORIES = Object.keys(CATEGORY_STYLE);

export const Achievements = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    studentId: '', title: '', description: '',
    category: 'ACADEMIC', level: '', points: 10,
  });

  const load = () => {
    setLoading(true);
    const call = isTeacher ? achievementApi.getAll() : achievementApi.getMine();
    call
      .then((res) => { setItems(res.data || []); setError(null); setLoading(false); })
      .catch(() => { setError('Could not load achievements.'); setLoading(false); });

    if (!isTeacher && user?.id) {
      achievementApi.getSummary(user.id).then((res) => setSummary(res.data)).catch(() => {});
    }
  };

  useEffect(() => {
    load();
    if (isTeacher) {
      // Students come from course enrolments rather than a directory listing,
      // so a teacher only ever sees students they actually teach.
      courseApi.getAll()
        .then((res) => Promise.all((res.data || []).map((c) => courseApi.getStudents(c.id))))
        .then((lists) => {
          const seen = new Map();
          lists.forEach((l) => (l.data || []).forEach((s) => seen.set(s.id, s)));
          setStudents(Array.from(seen.values()));
        })
        .catch(() => {});
    }
  }, [isTeacher, user?.id]);

  const handleAward = async (e) => {
    e.preventDefault();
    if (!form.studentId || !form.title.trim()) return;
    try {
      await achievementApi.award(form.studentId, {
        title: form.title,
        description: form.description,
        category: form.category,
        level: form.level,
        points: Number(form.points) || 0,
      });
      setShowForm(false);
      setForm({ studentId: '', title: '', description: '', category: 'ACADEMIC', level: '', points: 10 });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record that achievement.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await achievementApi.remove(id);
      load();
    } catch {
      setError('Could not remove that record.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" /> Achievements
          </h1>
          <p className="text-xs text-slate-400">
            Academic, sporting, project and extracurricular recognition in one record
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Record achievement
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {error}
        </div>
      )}

      {!isTeacher && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl glass-card border border-dark-border">
            <p className="text-xs font-semibold text-slate-400">Total recorded</p>
            <p className="text-2xl font-extrabold font-mono text-slate-100">{summary.total}</p>
          </div>
          <div className="p-4 rounded-2xl glass-card border border-dark-border">
            <p className="text-xs font-semibold text-slate-400">Points</p>
            <p className="text-2xl font-extrabold font-mono text-amber-400">{summary.totalPoints}</p>
          </div>
          {['ACADEMIC', 'SPORTS'].map((c) => (
            <div key={c} className="p-4 rounded-2xl glass-card border border-dark-border">
              <p className="text-xs font-semibold text-slate-400 capitalize">{c.toLowerCase()}</p>
              <p className="text-2xl font-extrabold font-mono text-slate-100">
                {summary.countByCategory?.[c] ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAward} className="p-5 rounded-2xl glass-card border border-amber-500/30 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100" required
            >
              <option value="">Select student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <select
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number" min="0" max="100" value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              placeholder="Points (0-100)"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
            />
          </div>
          <input
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title" required
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          <input
            value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
            placeholder="Level (e.g. First place, Certificate of merit)"
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          <textarea
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description" rows={2}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
          />
          {students.length === 0 && (
            <p className="text-[11px] text-amber-300">
              No students found — they appear here once enrolled on one of your courses.
            </p>
          )}
          <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
            Record
          </button>
        </form>
      )}

      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="p-12 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
          <Medal className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Nothing recorded yet</p>
          <p className="text-xs text-slate-500">
            Achievements are recorded by teachers, so this stays empty until one is awarded.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((a) => (
          <div key={a.id} className="p-4 rounded-2xl glass-card border border-dark-border space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${CATEGORY_STYLE[a.category]}`}>
                {a.category}
              </span>
              <div className="flex items-center gap-2">
                {a.points > 0 && (
                  <span className="text-[10px] font-mono font-bold text-amber-400">+{a.points}</span>
                )}
                {isTeacher && (
                  <button onClick={() => handleDelete(a.id)} className="text-slate-600 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-100 leading-tight">{a.title}</h3>
            {a.level && <p className="text-[11px] font-semibold text-amber-300">{a.level}</p>}
            {a.description && <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
              {isTeacher && <span className="font-semibold text-slate-400">{a.student?.fullName}</span>}
              <span className="font-mono">{a.awardedOn}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
