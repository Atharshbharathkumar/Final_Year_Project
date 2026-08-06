import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ProctorOverlay } from '../components/exam/ProctorOverlay';
import { QuestionCard } from '../components/exam/QuestionCard';
import { CameraMonitor } from '../components/monitoring/CameraMonitor';
import { Clock, ShieldAlert, CheckCircle2, ArrowRight, ArrowLeft, Send } from 'lucide-react';

export const ExamRoom = () => {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [result, setResult] = useState(null);

  // The countdown is created once on mount, so the handler it closes over would
  // otherwise be the mount-time one — submitting empty answers on timeout.
  // This ref always points at the current handler.
  const submitRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    examApi
      .getById(examId || 1)
      .then((res) => { if (!cancelled) setExam(res.data); })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this exam. Check that the backend is running.');
      });

    examApi
      .startAttempt(examId || 1)
      .then((res) => { if (!cancelled) setAttempt(res.data); })
      .catch(() => {
        if (!cancelled) setLoadError('Could not start an attempt. Nothing you submit will be recorded.');
      });

    // Countdown Timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Track Fullscreen state
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [examId]);

  const maxTabSwitches = exam?.maxTabSwitches ?? 3;

  const requestFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleSelectAnswer = (ans) => {
    const currentQ = exam?.questions?.[currentIndex];
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: ans,
    }));
  };

  const handleAlertTriggered = (alertObj) => {
    if (alertObj.type === 'TAB_SWITCH') {
      setTabSwitchCount((prev) => {
        const nextCount = prev + 1;
        if (nextCount >= maxTabSwitches) {
          submitRef.current?.();
        }
        return nextCount;
      });
    }
  };

  const handleSnapshotCaptured = (base64Image, reason) => {
    if (attempt?.id) {
      examApi
        .sendSnapshot({
          attemptId: attempt.id,
          base64Image,
          reason,
        })
        .catch(() => {});
    }
  };

  const handleSubmitExam = async () => {
    if (submitting || submitted) return;
    if (!attempt?.id) {
      setLoadError('No attempt is registered on the server — this submission cannot be saved.');
      return;
    }
    setSubmitting(true);
    try {
      // averageAttentionScore is deliberately not sent. The server computes it
      // from the attention logs it recorded during this exam.
      const res = await examApi.submitAttempt({
        attemptId: attempt.id,
        answers,
        tabSwitchCount,
      });
      setResult(res.data);
      setSubmitted(true);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err) {
      setLoadError('Submission failed. Your answers were NOT saved — do not close this tab.');
    } finally {
      setSubmitting(false);
    }
  };

  // Keep the ref pointed at the current closure so the countdown and the
  // tab-switch limit both submit the answers as they stand right now.
  submitRef.current = handleSubmitExam;

  const currentQuestions = exam?.questions ?? [];
  const currentQ = currentQuestions[currentIndex];

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Exam Submitted Successfully</h1>
        <p className="text-sm text-slate-300">
          Your response and proctoring audit snapshots have been saved. Teacher evaluation in progress.
        </p>

        {/* Figures below come from the server's record of this attempt, not from
            this browser. A null average means no attention sample was ever
            measured (camera denied, or face model unavailable). */}
        <div className="p-4 rounded-2xl glass-card border border-dark-border max-w-sm mx-auto text-xs space-y-2 text-slate-300">
          <div className="flex justify-between">
            <span>Tab switches recorded:</span>
            <span className="font-mono font-bold text-amber-400">
              {result?.tabSwitchCount ?? tabSwitchCount} / {maxTabSwitches}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Average attention:</span>
            {typeof result?.averageAttentionScore === 'number' ? (
              <span className="font-mono font-bold text-emerald-400">
                {result.averageAttentionScore}%
              </span>
            ) : (
              <span className="font-mono font-bold text-slate-500">not measured</span>
            )}
          </div>
          {typeof result?.score === 'number' && (
            <div className="flex justify-between">
              <span>Score:</span>
              <span className="font-mono font-bold text-indigo-400">
                {result.score} / {result.maxScore ?? '—'}
              </span>
            </div>
          )}
          {result?.status === 'AUTO_SUBMITTED_VIOLATION' && (
            <p className="text-[11px] text-rose-400 font-bold pt-1 border-t border-slate-800">
              Auto-submitted: tab switch limit exceeded.
            </p>
          )}
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (loadError && !exam) {
    return (
      <div className="max-w-lg mx-auto py-20 px-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Exam unavailable</h1>
        <p className="text-sm text-slate-400">{loadError}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!exam) {
    return <div className="py-20 text-center text-sm text-slate-400">Loading exam…</div>;
  }

  return (
    <div className="-mt-6 space-y-4">
      {/* Proctor Lockdown Overlay Banner */}
      <ProctorOverlay
        tabSwitchCount={tabSwitchCount}
        maxTabSwitches={maxTabSwitches}
        isFullscreen={isFullscreen}
        onFullscreenRequest={requestFullscreen}
      />

      {loadError && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-semibold text-rose-200">
            {loadError}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Questions Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between glass-card p-4 rounded-2xl border border-dark-border">
            <h2 className="text-lg font-bold text-white">{exam.title}</h2>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 font-mono font-bold text-sm">
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          </div>

          {currentQ ? (
            <QuestionCard
              question={currentQ}
              index={currentIndex}
              total={currentQuestions.length}
              selectedAnswer={answers[currentQ.id]}
              onSelectAnswer={handleSelectAnswer}
            />
          ) : (
            <div className="p-8 rounded-2xl glass-card border border-dark-border text-center text-sm text-slate-400">
              This exam has no questions yet.
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 text-xs font-bold flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            {currentIndex < currentQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                Next Question <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <Send className="w-4 h-4" /> Submit Exam Now
              </button>
            )}
          </div>
        </div>

        {/* Live Proctor Camera Feed Panel */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Proctor Camera Stream
            </h3>
            <CameraMonitor
              studentId={user?.id}
              studentName={user?.fullName}
              sessionId={Number(examId) || exam.id}
              contextType="EXAM"
              onAlert={handleAlertTriggered}
              onSnapshot={handleSnapshotCaptured}
            />
          </div>

          <div className="p-4 rounded-2xl glass-card border border-dark-border text-xs space-y-2 text-slate-300">
            <span className="font-bold text-slate-200 block mb-1">Exam Proctoring Rules:</span>
            <ul className="space-y-1 text-[11px] text-slate-400 list-disc pl-4">
              <li>Keep your face centered in camera view.</li>
              <li>Multiple faces will trigger an alert.</li>
              <li>Switching tabs {maxTabSwitches} times auto-submits the exam.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
