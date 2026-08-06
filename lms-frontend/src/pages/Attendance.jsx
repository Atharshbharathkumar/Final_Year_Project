import React, { useEffect, useState } from 'react';
import { attendanceApi, courseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CalendarCheck, Wand2, AlertTriangle } from 'lucide-react';

const STATUS_STYLE = {
  PRESENT: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  LATE: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ABSENT: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  EXCUSED: 'bg-slate-600/30 text-slate-300 border-slate-500/40',
};

const today = () => new Date().toISOString().slice(0, 10);

export const Attendance = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState(today());
  const [autoResult, setAutoResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isTeacher) {
      courseApi.getAll()
        .then((res) => {
          setCourses(res.data || []);
          if (res.data?.length) setCourseId(String(res.data[0].id));
          setLoading(false);
        })
        .catch(() => { setError('Could not load courses.'); setLoading(false); });
      return;
    }

    Promise.all([attendanceApi.getMine(), attendanceApi.getSummary(user.id)])
      .then(([recs, sum]) => {
        setRecords(recs.data || []);
        setSummary(sum.data);
        setLoading(false);
      })
      .catch(() => { setError('Could not load your attendance.'); setLoading(false); });
  }, [isTeacher, user?.id]);

  const loadRegister = () => {
    if (!courseId) return;
    attendanceApi.getRegister(courseId, date)
      .then((res) => { setRecords(res.data || []); setError(null); })
      .catch(() => setError('Could not load the register.'));
  };

  useEffect(() => { if (isTeacher && courseId) loadRegister(); }, [isTeacher, courseId, date]);

  const setStatus = async (studentId, status) => {
    try {
      await attendanceApi.mark({ studentId, courseId: Number(courseId), date, status });
      loadRegister();
    } catch {
      setError('Could not save that mark.');
    }
  };

  const runAutoMark = async () => {
    try {
      const res = await attendanceApi.autoMark({ courseId: Number(courseId), sessionId: 1, date });
      setAutoResult(res.data);
      loadRegister();
    } catch {
      setError('Auto-marking failed.');
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-indigo-400" /> Attendance
        </h1>
        <p className="text-xs text-slate-400">
          {isTeacher ? 'Mark the register, or derive it from recorded class attention' : 'Your recorded attendance'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
          {error}
        </div>
      )}

      {!isTeacher && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Attendance', value: summary.attendancePercentage != null ? `${summary.attendancePercentage}%` : 'no records' },
            { label: 'Present', value: summary.present },
            { label: 'Late', value: summary.late },
            { label: 'Absent', value: summary.absent },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 rounded-2xl glass-card border border-dark-border">
              <p className="text-xs font-semibold text-slate-400">{label}</p>
              <p className="text-2xl font-extrabold font-mono text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      )}

      {isTeacher && (
        <div className="p-4 rounded-2xl glass-card border border-dark-border flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Course</label>
            <select
              value={courseId} onChange={(e) => setCourseId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
            >
              {courses.map((c) => <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Date</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100"
            />
          </div>
          <button
            onClick={runAutoMark}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Derive from session attention
          </button>
        </div>
      )}

      {autoResult && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2">
          <p className="text-xs font-bold text-amber-200">
            Marked {autoResult.markedPresent} present, {autoResult.markedAbsent} absent
            {' '}(threshold: {autoResult.minSamplesRequired} measured samples)
          </p>
          <p className="text-[11px] text-amber-300/90 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {autoResult.caveat}
          </p>
        </div>
      )}

      {records.length === 0 ? (
        <div className="p-12 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-2">
          <CalendarCheck className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No attendance recorded</p>
          <p className="text-xs text-slate-500">
            {isTeacher ? 'Nothing marked for this course and date yet.' : 'Nothing has been recorded for you.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl glass-card border border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{isTeacher ? 'Student' : 'Course'}</th>
                  <th className="text-left px-4 py-3 font-bold">Date</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Source</th>
                  {isTeacher && <th className="text-left px-4 py-3 font-bold">Set</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800/70">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {isTeacher ? r.student?.fullName : r.course?.courseCode}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLE[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-slate-500">
                      {r.source === 'AUTO_SESSION'
                        ? `inferred (${r.sampleCount ?? 0} samples)`
                        : 'marked by teacher'}
                    </td>
                    {isTeacher && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {['PRESENT', 'LATE', 'ABSENT'].map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatus(r.student.id, s)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                r.status === s ? STATUS_STYLE[s] : 'border-slate-700 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {s[0]}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
