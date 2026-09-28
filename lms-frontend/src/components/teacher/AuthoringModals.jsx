import React, { useState, useCallback } from 'react';
import { Modal, Button } from '../ui/Components';
import { courseApi, assignmentApi, classroomApi, errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';

const field = 'w-full px-3 py-2.5 rounded-xl bg-dark-bg border border-dark-border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/50';
const label = 'block text-xs font-medium text-slate-400 mb-1.5';

const Field = ({ children, label: text, hint }) => (
  <div>
    <label className={label}>{text}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
  </div>
);

/** Course palette offered to the teacher; matches the course card accents. */
const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
const ICONS = ['📘', '📊', '🤖', '🗄️', '🌐', '💻', '🧠', '🔬', '⚙️'];

export const CreateCourseModal = ({ isOpen, onClose, onCreated }) => {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    title: '', courseCode: '', description: '',
    color: PALETTE[0], icon: ICONS[0], creditHours: 3, totalSessions: 16,
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim() || !form.courseCode.trim()) {
      addToast('A course needs a title and a code.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await courseApi.create({
        ...form,
        creditHours: Number(form.creditHours),
        totalSessions: Number(form.totalSessions),
      });
      addToast(`${data.code} created.`, 'success');
      onCreated?.(data);
      onClose();
      setForm({ title: '', courseCode: '', description: '', color: PALETTE[0], icon: ICONS[0], creditHours: 3, totalSessions: 16 });
    } catch (err) {
      addToast(errorMessage(err, 'Could not create the course.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Create a course">
      <div className="space-y-4">
        <Field label="Course title">
          <input className={field} value={form.title} onChange={set('title')} placeholder="Advanced Computer Vision" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Course code">
            <input className={field} value={form.courseCode} onChange={set('courseCode')} placeholder="CS405" />
          </Field>
          <Field label="Credit hours">
            <input type="number" min={1} max={10} className={field} value={form.creditHours} onChange={set('creditHours')} />
          </Field>
        </div>

        <Field label="Description">
          <textarea className={field} rows={3} value={form.description} onChange={set('description')}
            placeholder="What this course covers…" />
        </Field>

        <Field label="Planned sessions" hint="Used to compute syllabus coverage on the course cards.">
          <input type="number" min={1} max={100} className={field} value={form.totalSessions} onChange={set('totalSessions')} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Accent colour</label>
            <div className="flex gap-2">
              {PALETTE.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-lg transition-transform ${form.color === c ? 'ring-2 ring-white/60 scale-110' : ''}`}
                  style={{ backgroundColor: c }} aria-label={`Colour ${c}`} />
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Icon</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(i => (
                <button key={i} onClick={() => setForm(f => ({ ...f, icon: i }))}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition-colors ${
                    form.icon === i ? 'bg-brand-500/20 border-brand-500/40' : 'bg-dark-bg border-dark-border'
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create course'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const CreateAssignmentModal = ({ isOpen, onClose, onCreated }) => {
  const { addToast } = useToast();
  const fetchCourses = useCallback(() => courseApi.my(), []);
  const { data: courses } = useApi(fetchCourses, [], { initialData: [] });

  const [form, setForm] = useState({
    courseId: '', title: '', description: '', dueDate: '', points: 100, priority: 'MEDIUM',
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.courseId) { addToast('Pick the course this belongs to.', 'error'); return; }
    if (!form.title.trim()) { addToast('An assignment needs a title.', 'error'); return; }
    if (!form.dueDate) { addToast('An assignment needs a due date.', 'error'); return; }

    setSaving(true);
    try {
      const { data } = await assignmentApi.create({
        ...form,
        courseId: Number(form.courseId),
        points: Number(form.points),
      });
      addToast(`"${data.title}" published. Enrolled students have been notified.`, 'success');
      onCreated?.(data);
      onClose();
      setForm({ courseId: '', title: '', description: '', dueDate: '', points: 100, priority: 'MEDIUM' });
    } catch (err) {
      addToast(errorMessage(err, 'Could not create the assignment.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Publish an assignment">
      <div className="space-y-4">
        <Field label="Course">
          <select className={field} value={form.courseId} onChange={set('courseId')}>
            <option value="">Select a course…</option>
            {(courses || []).map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Title">
          <input className={field} value={form.title} onChange={set('title')} placeholder="Convolution Kernels Lab" />
        </Field>

        <Field label="Brief">
          <textarea className={field} rows={3} value={form.description} onChange={set('description')}
            placeholder="What students need to do…" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Due date">
            <input type="date" className={field} value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Points">
            <input type="number" min={1} max={500} className={field} value={form.points} onChange={set('points')} />
          </Field>
          <Field label="Priority">
            <select className={field} value={form.priority} onChange={set('priority')}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </Field>
        </div>

        <div className="p-3 rounded-xl bg-brand-500/5 border border-brand-500/15">
          <p className="text-[11px] text-brand-300">
            Every enrolled student is notified as soon as this is published.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Publishing…' : 'Publish assignment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const StartSessionModal = ({ isOpen, onClose, onCreated }) => {
  const { addToast } = useToast();
  const fetchCourses = useCallback(() => courseApi.my(), []);
  const { data: courses } = useApi(fetchCourses, [], { initialData: [] });

  const [form, setForm] = useState({ courseId: '', title: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.courseId) { addToast('Pick the course for this session.', 'error'); return; }
    if (!form.title.trim()) { addToast('Give the session a topic.', 'error'); return; }

    setSaving(true);
    try {
      const { data } = await classroomApi.create({ title: form.title, courseId: Number(form.courseId) });
      addToast('Live session started.', 'success');
      onCreated?.(data);
      onClose();
      setForm({ courseId: '', title: '' });
    } catch (err) {
      addToast(errorMessage(err, 'Could not start the session.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Start a live class">
      <div className="space-y-4">
        <Field label="Course">
          <select className={field} value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}>
            <option value="">Select a course…</option>
            {(courses || []).map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Today's topic">
          <input className={field} value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Neural Networks — Regularisation" />
        </Field>

        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <p className="text-[11px] text-emerald-300">
            Starting a session opens the room for enrolled students and begins engagement monitoring.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Starting…' : 'Go live'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};