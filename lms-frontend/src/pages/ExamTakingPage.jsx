import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { GlassCard, Badge, Button, ProgressBar, LoadingState, ErrorState, Modal } from '../components/ui/Components';
import {
  ShieldAlert, Clock, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight,
  Lock, Camera, FileText, ListChecks, Send
} from 'lucide-react';
import { examApi, errorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import ProctoringCamera from '../components/proctoring/ProctoringCamera';

const mmss = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const ExamTakingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [phase, setPhase] = useState('loading');      // loading | brief | active | result
  const [paper, setPaper] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [warning, setWarning] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Refs keep the visibility listener and timer reading current state without
  // being torn down and re-registered on every keystroke.
  const attemptRef = useRef(null);
  const phaseRef = useRef(phase);
  const answersRef = useRef(answers);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ─────────────────────────── load paper / prior attempt ───────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ data: paperData }, attemptResponse] = await Promise.all([
          examApi.paper(id),
          examApi.myAttempt(id).catch(() => ({ status: 204, data: null })),
        ]);
        if (cancelled) return;
        setPaper(paperData);

        const prior = attemptResponse?.data;

        // Already finished: one sitting per candidate, so show the result.
        if (prior && prior.status !== 'IN_PROGRESS') {
          const { data: resultData } = await examApi.result(prior.attemptId);
          if (cancelled) return;
          setResult(resultData);
          setPhase('result');
          return;
        }

        // Still running: resume exactly where they left off. A refresh must not
        // cost the candidate their answers or reset the clock.
        if (prior && prior.status === 'IN_PROGRESS') {
          attemptRef.current = prior;
          setAttempt(prior);
          setAnswers(prior.savedAnswers || {});
          setRemaining(prior.secondsRemaining);
          setTabSwitches(prior.tabSwitchCount ?? 0);
          setPhase('active');
          return;
        }

        setPhase('brief');
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'This exam could not be opened.'));
          setPhase('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  // ─────────────────────────────── submission ───────────────────────────────

  const finish = useCallback(async (reason) => {
    const live = attemptRef.current;
    if (!live || submitting) return;
    setSubmitting(true);

    try {
      const { data } = await examApi.submitAttempt({
        attemptId: live.attemptId,
        answers: answersRef.current,
      });
      setResult(data);
      setPhase('result');
      if (reason === 'timeout') addToast('Time is up — your exam was submitted automatically.', 'warning', 8000);
      else if (reason === 'violation') addToast('Tab switch limit reached — exam submitted.', 'error', 8000);
      else addToast('Exam submitted successfully.', 'success');
    } catch (err) {
      addToast(errorMessage(err, 'Submission failed.'), 'error');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [submitting, addToast]);

  // ─────────────────────────────── the clock ────────────────────────────────

  useEffect(() => {
    if (phase !== 'active') return undefined;

    const tick = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(tick);
          finish('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Re-sync against the server clock so a paused or throttled tab cannot
    // silently gain time.
    const resync = setInterval(async () => {
      const live = attemptRef.current;
      if (!live) return;
      try {
        const { data } = await examApi.attemptState(live.attemptId);
        setRemaining(data.secondsRemaining);
        setTabSwitches(data.tabSwitchCount ?? 0);
        if (data.status !== 'IN_PROGRESS') finish('violation');
      } catch {
        /* a dropped poll is not fatal; the local timer keeps running */
      }
    }, 30000);

    return () => { clearInterval(tick); clearInterval(resync); };
  }, [phase, finish]);

  // ──────────────────────────── lockdown monitoring ─────────────────────────

  useEffect(() => {
    if (phase !== 'active' || !paper?.lockdownEnabled) return undefined;

    const onHidden = async () => {
      if (document.visibilityState !== 'hidden') return;
      if (phaseRef.current !== 'active') return;

      const live = attemptRef.current;
      if (!live) return;

      try {
        // The server owns the count — the client only reports the event.
        const { data } = await examApi.reportTabSwitch(live.attemptId);
        setTabSwitches(data.tabSwitchCount);
        if (data.terminated) {
          await finish('violation');
        } else {
          setWarning({
            count: data.tabSwitchCount,
            max: data.maxTabSwitches,
            message: data.message,
          });
        }
      } catch {
        /* reporting failed; the attempt continues */
      }
    };

    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [phase, paper, finish]);

  // Warn on accidental navigation away mid-exam.
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [phase]);

  // ──────────────────────────────── actions ─────────────────────────────────

  const begin = async () => {
    try {
      const { data } = await examApi.startAttempt(id);
      attemptRef.current = data;
      setAttempt(data);
      setAnswers(data.savedAnswers || {});
      setRemaining(data.secondsRemaining);
      setTabSwitches(data.tabSwitchCount ?? 0);

      if (data.status !== 'IN_PROGRESS') {
        const { data: resultData } = await examApi.result(data.attemptId);
        setResult(resultData);
        setPhase('result');
        return;
      }
      setPhase('active');
    } catch (err) {
      addToast(errorMessage(err, 'This exam could not be started.'), 'error');
      setError(errorMessage(err));
    }
  };

  const answerQuestion = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    const live = attemptRef.current;
    if (!live) return;
    // Autosave so a refresh or crash never costs the candidate their paper.
    examApi.saveAnswer(live.attemptId, questionId, value).catch(() => {});
  };

  // ──────────────────────────────── rendering ───────────────────────────────

  if (phase === 'loading') return <LoadingState label="Opening the exam paper…" />;
  if (phase === 'error') return <ErrorState message={error} onRetry={() => navigate('/exams')} />;

  // ── Result ──
  if (phase === 'result' && result) {
    const violation = result.status === 'AUTO_SUBMITTED_VIOLATION';
    const pass = result.percentage >= 50;

    return (
      <div className="max-w-3xl mx-auto space-y-6 page-enter">
        <GlassCard hover={false} className="p-8 text-center">
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
            violation ? 'bg-rose-500/15' : pass ? 'bg-emerald-500/15' : 'bg-amber-500/15'
          }`}>
            {violation ? <ShieldAlert size={30} className="text-rose-400" />
              : <CheckCircle2 size={30} className={pass ? 'text-emerald-400' : 'text-amber-400'} />}
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">{result.examTitle}</h1>
          <p className="text-sm text-slate-400 mb-6">{result.courseName}</p>

          <p className={`text-6xl font-black mb-2 ${pass ? 'text-emerald-400' : 'text-amber-400'}`}>
            {result.percentage}%
          </p>
          <p className="text-sm text-slate-400 mb-6">{result.score} of {result.maxScore} marks</p>

          <div className="max-w-sm mx-auto mb-8">
            <ProgressBar value={result.percentage} color={pass ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'} showValue={false} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-xl bg-dark-bg border border-dark-border">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Answered</p>
              <p className="text-lg font-bold text-white">{result.questionsAnswered}/{result.questionCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-dark-bg border border-dark-border">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Tab Switches</p>
              <p className={`text-lg font-bold ${result.tabSwitchCount > 0 ? 'text-rose-400' : 'text-white'}`}>
                {result.tabSwitchCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-dark-bg border border-dark-border">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Submitted</p>
              <p className="text-sm font-bold text-white mt-1">{result.submittedAt}</p>
            </div>
          </div>
        </GlassCard>

        {/* Integrity verdict from the proctoring model */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-violet-400" /> Integrity Report
            </h3>
            <Badge variant={
              result.integrityScore >= 80 ? 'success' : result.integrityScore >= 50 ? 'warning' : 'danger'
            }>
              {result.integrityScore}% confidence
            </Badge>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Status: <span className="text-white font-semibold">{result.integrityStatus?.replace(/_/g, ' ')}</span>
          </p>

          <ul className="space-y-2">
            {(result.integrityFlags || []).map((flag, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" /> {flag}
              </li>
            ))}
          </ul>
        </GlassCard>

        <div className="flex justify-center gap-3">
          <Link to="/exams"><Button variant="secondary">Back to Exams</Button></Link>
          <Link to="/student/dashboard"><Button variant="primary">Go to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  // ── Pre-flight briefing ──
  if (phase === 'brief' && paper) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 page-enter">
        <Link to="/exams" className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to exams
        </Link>

        <GlassCard hover={false} className="p-8">
          <Badge variant="brand" className="mb-4">{paper.courseCode} · {paper.courseName}</Badge>
          <h1 className="text-2xl font-bold text-white mb-2">{paper.title}</h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-8">{paper.description}</p>

          <div className="grid sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Duration', value: `${paper.durationMinutes} min`, icon: Clock },
              { label: 'Questions', value: paper.questionCount, icon: ListChecks },
              { label: 'Total Marks', value: paper.totalMarks, icon: FileText },
              { label: 'Tab Limit', value: paper.maxTabSwitches ?? '—', icon: ShieldAlert },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-dark-bg border border-dark-border text-center">
                <s.icon size={16} className="text-brand-400 mx-auto mb-2" />
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-8">
            <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
              <Lock size={15} /> Examination rules
            </h3>
            <ul className="space-y-2 text-xs text-amber-100/80">
              <li>• The timer starts the moment you begin and runs on the server. Closing this page will not pause it.</li>
              {paper.lockdownEnabled && (
                <li>
                  • Leaving this tab or window is recorded and reported to your invigilator.
                  {paper.maxTabSwitches != null && ` After ${paper.maxTabSwitches} switches your exam is submitted automatically.`}
                </li>
              )}
              <li>• Your answers save as you type, so a refresh will not lose your work.</li>
              <li>• You get one attempt. Once submitted, the paper cannot be reopened.</li>
              {paper.cameraRequired && (
                <li className="flex items-start gap-1.5">
                  <Camera size={13} className="mt-0.5 shrink-0" />
                  This exam is camera-proctored. You will be asked for camera permission once you begin;
                  analysis runs on your own device and no video is uploaded.
                </li>
              )}
            </ul>
          </div>

          <Button variant="primary" size="lg" onClick={begin} className="w-full flex items-center justify-center gap-2">
            Begin Examination <ArrowRight size={18} />
          </Button>
        </GlassCard>
      </div>
    );
  }

  // ── Active paper ──
  if (phase !== 'active' || !paper) return <LoadingState />;

  const questions = paper.questions || [];
  const question = questions[current];
  const answeredCount = questions.filter(q => answers[q.id]?.trim?.()).length;
  const critical = remaining <= 60;

  return (
    <div className="max-w-5xl mx-auto space-y-4 page-enter">
      {/* Sticky exam bar */}
      <div className="sticky top-16 z-30 -mx-1">
        <GlassCard hover={false} padding="p-3" className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant="danger" className="animate-pulse shrink-0">EXAM IN PROGRESS</Badge>
            <p className="text-sm font-semibold text-white truncate">{paper.title}</p>
          </div>

          <div className="flex items-center gap-3">
            {paper.lockdownEnabled && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${
                tabSwitches > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-dark-bg border-dark-border text-slate-400'
              }`}>
                <ShieldAlert size={12} />
                {tabSwitches}{paper.maxTabSwitches != null ? `/${paper.maxTabSwitches}` : ''} switches
              </div>
            )}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-base font-bold tabular-nums ${
              critical ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 animate-pulse'
                : 'bg-dark-bg border-dark-border text-white'
            }`}>
              <Clock size={15} /> {mmss(remaining)}
            </div>
            <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
              Submit
            </Button>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Question */}
        <div className="lg:col-span-3">
          <GlassCard hover={false} className="min-h-[420px] flex flex-col">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Question {current + 1} of {questions.length}
                </span>
                <Badge variant="info">{question?.type === 'MCQ' ? 'Multiple choice' : 'Short answer'}</Badge>
              </div>
              <span className="text-xs font-bold text-brand-400">{question?.marks} marks</span>
            </div>

            <p className="text-base text-white leading-relaxed mb-6">{question?.questionText}</p>

            {question?.type === 'MCQ' ? (
              <div className="space-y-3">
                {['A', 'B', 'C', 'D'].map(letter => {
                  const text = question[`option${letter}`];
                  if (!text) return null;
                  const selected = answers[question.id] === letter;
                  return (
                    <button
                      key={letter}
                      onClick={() => answerQuestion(question.id, letter)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${
                        selected
                          ? 'bg-brand-500/10 border-brand-500/40 ring-1 ring-brand-500/20'
                          : 'bg-dark-bg/50 border-dark-border hover:border-dark-borderHover'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        selected ? 'bg-brand-500 text-white' : 'bg-dark-card text-slate-400 border border-dark-border'
                      }`}>
                        {letter}
                      </span>
                      <span className={`text-sm ${selected ? 'text-white font-medium' : 'text-slate-300'}`}>{text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={answers[question?.id] || ''}
                onChange={e => answerQuestion(question.id, e.target.value)}
                rows={8}
                placeholder="Type your answer here…"
                className="w-full p-4 rounded-xl bg-dark-bg border border-dark-border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/50 leading-relaxed"
              />
            )}

            <div className="mt-auto pt-6 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={current === 0}
                onClick={() => setCurrent(c => c - 1)} className="flex items-center gap-1.5">
                <ArrowLeft size={14} /> Previous
              </Button>
              <span className="text-[11px] text-slate-500">Answers save automatically</span>
              {current < questions.length - 1 ? (
                <Button variant="secondary" size="sm" onClick={() => setCurrent(c => c + 1)} className="flex items-center gap-1.5">
                  Next <ArrowRight size={14} />
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} className="flex items-center gap-1.5">
                  Finish <Send size={14} />
                </Button>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Navigator */}
        <div>
          <GlassCard hover={false} className="sticky top-36">
            <h3 className="text-sm font-semibold text-white mb-1">Progress</h3>
            <p className="text-[11px] text-slate-500 mb-4">{answeredCount} of {questions.length} answered</p>
            <ProgressBar value={(answeredCount / Math.max(1, questions.length)) * 100} showValue={false} height="h-1.5" />

            <div className="grid grid-cols-5 gap-2 mt-5">
              {questions.map((q, i) => {
                const done = !!answers[q.id]?.trim?.();
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrent(i)}
                    title={done ? 'Answered' : 'Not answered'}
                    className={`aspect-square rounded-lg text-xs font-bold transition-all ${
                      i === current ? 'bg-brand-500 text-white ring-2 ring-brand-400/40'
                        : done ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-dark-bg text-slate-500 border border-dark-border hover:border-dark-borderHover'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {paper.lockdownEnabled && (
              <div className="mt-5 p-3 rounded-xl bg-dark-bg border border-dark-border">
                <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
                  <Lock size={11} className="mt-0.5 shrink-0 text-amber-400" />
                  Lockdown is active. Switching tabs is recorded by the server.
                </p>
              </div>
            )}
          </GlassCard>

          {/* Camera proctoring, opt-in, running against the live attempt. */}
          {paper.cameraRequired && attempt?.attemptId && (
            <div className="mt-4">
              <ProctoringCamera
                sessionId={attempt.attemptId}
                contextType="EXAM"
                compact
                reportEveryMs={5000}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tab-switch warning */}
      <Modal isOpen={!!warning} onClose={() => setWarning(null)} title="Exam window left">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-rose-200 font-medium mb-1">{warning?.message}</p>
              {warning?.max != null && (
                <p className="text-xs text-rose-300/80">
                  Recorded switch {warning.count} of {warning.max}. Your exam is submitted automatically at {warning.max}.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setWarning(null)}>Return to exam</Button>
          </div>
        </div>
      </Modal>

      {/* Submit confirmation */}
      <Modal isOpen={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} title="Submit your exam?">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            You have answered <strong className="text-white">{answeredCount} of {questions.length}</strong> questions
            with <strong className="text-white">{mmss(remaining)}</strong> remaining.
          </p>
          {answeredCount < questions.length && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              {questions.length - answeredCount} question(s) are still unanswered. They will score zero.
            </div>
          )}
          <p className="text-xs text-slate-500">This cannot be undone — you have one attempt.</p>
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-border">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Keep working</Button>
            <Button variant="primary" onClick={() => finish('manual')} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit final answers'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExamTakingPage;