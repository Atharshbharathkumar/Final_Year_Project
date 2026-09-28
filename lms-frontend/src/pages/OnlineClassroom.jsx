import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, Button, Badge, LoadingState, ErrorState } from '../components/ui/Components';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, Hand, MessageSquare,
  Settings, Users, Hash, Send, Brain
} from 'lucide-react';
import { classroomApi, errorMessage } from '../services/api';
import { usePolledApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import websocket from '../services/websocket';
import ProctoringCamera from '../components/proctoring/ProctoringCamera';
import ClassroomLobby from '../components/classroom/ClassroomLobby';
import OffTaskOverlay from '../components/classroom/OffTaskOverlay';
import FocusStandings from '../components/classroom/FocusStandings';
import { useClassGuard } from '../hooks/useClassGuard';

const OnlineClassroom = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [micState, setMicState] = useState(false);
  const [camState, setCamState] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const chatEndRef = useRef(null);

  // Nobody enters the room implicitly — the lobby gates entry.
  const [joined, setJoined] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [cameraOptIn, setCameraOptIn] = useState(true);

  const fetchLive = useCallback(() => classroomApi.live(), []);
  const { data: live, loading, error, refetch } = usePolledApi(fetchLive, 15000, []);

  const sessionId = live?.classInfo?.sessionId;

  // Load history, then keep the room live over STOMP.
  useEffect(() => {
    if (!sessionId) return undefined;

    classroomApi.getChatHistory(sessionId)
      .then(({ data }) => setMessages(data || []))
      .catch(() => addToast('Could not load chat history.', 'error'));

    const topic = `/topic/chat/${sessionId}`;
    websocket.connect(() => {
      websocket.subscribe(topic, (incoming) => {
        setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
      });
    });

    return () => websocket.unsubscribe(topic);
  }, [sessionId, addToast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Only the teacher hosting this session may close it.
  const isHost = user?.role === 'teacher' && live?.classInfo?.teacher === user?.name;
  const isStudent = user?.role === 'student';

  const leaveClass = useCallback(() => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setJoined(false);
    navigate('/student/dashboard');
  }, [screenStream, navigate]);

  const guard = useClassGuard({
    sessionId,
    active: joined && isStudent,
    screenTrack: screenStream?.getVideoTracks?.()[0] || null,
    studentId: user?.id,
    onRemoved: () => {
      screenStream?.getTracks().forEach(t => t.stop());
      addToast('You have been removed from this class.', 'error', 9000);
    },
    onReadmitted: (event) => {
      addToast(event?.message || 'Your teacher has readmitted you.', 'success', 7000);
    },
  });

  // Release the screen share if the student navigates away.
  useEffect(() => () => {
    screenStream?.getTracks().forEach(t => t.stop());
  }, [screenStream]);

  const endSession = async () => {
    if (!sessionId) return;
    setEndingSession(true);
    try {
      await classroomApi.end(sessionId);
      await refetch();
      addToast('Session ended. The engagement report is now available.', 'success');
      navigate('/ai-reports');
    } catch (err) {
      addToast(errorMessage(err, 'Could not end the session.'), 'error');
    } finally {
      setEndingSession(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msg.trim() || !sessionId) return;
    setSending(true);
    try {
      await classroomApi.sendChatMessage(sessionId, msg.trim());
      setMsg('');
    } catch (err) {
      addToast(errorMessage(err, 'Message could not be sent.'), 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading && !live) return <LoadingState label="Loading the classroom…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // Students pass through the lobby; staff go straight in, since the screen
  // share requirement is a student obligation.
  if (isStudent && !joined) {
    return (
      <ClassroomLobby
        classInfo={live?.classInfo}
        onCancel={() => navigate('/student/dashboard')}
        onJoin={({ screenStream: stream, cameraEnabled }) => {
          setScreenStream(stream);
          setCameraOptIn(cameraEnabled);
          setJoined(true);
          addToast('You have joined the class. Stay in this window.', 'success');
        }}
      />
    );
  }

  const info = live?.classInfo;
  const participants = live?.participants || [];
  const strip = participants.slice(0, 5);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Blocks the room while the student is off-task, and after removal. */}
      {isStudent && (guard.offTask || guard.removed) && (
        <OffTaskOverlay
          action={guard.removed ? 'REMOVED' : guard.action}
          violations={guard.violations}
          limit={guard.limit}
          message={guard.message || 'Return to the class window to continue.'}
          onAcknowledge={guard.acknowledge}
          onLeave={leaveClass}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white leading-tight">{info?.subject}</h1>
            {info?.active
              ? <Badge variant="danger" className="animate-pulse">LIVE</Badge>
              : <Badge variant="warning">Ended</Badge>}
          </div>
          <p className="text-[11px] text-slate-400">{info?.teacher} • {info?.topic}</p>
        </div>
        <div className="flex bg-dark-card border border-dark-border rounded-xl p-1">
          <button onClick={() => setChatOpen(!chatOpen)} className={`p-2 rounded-lg transition-colors ${chatOpen ? 'bg-brand-500/10 text-brand-400' : 'text-slate-400 hover:bg-dark-borderHover hover:text-white'}`}>
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Stage */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex-1 rounded-2xl bg-black border border-dark-border relative overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <MonitorUp size={48} className="text-slate-700 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-500">{info?.teacher} is presenting</p>
              <div className="mt-4 px-4 py-2 bg-dark-bg/80 backdrop-blur rounded-lg inline-flex items-center gap-2 border border-dark-border">
                <span className={`w-2 h-2 rounded-full ${info?.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs text-slate-300">{info?.active ? 'Session Active' : 'Session Ended'}</span>
              </div>
            </div>

            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/50 text-[10px] text-white backdrop-blur border border-white/10">
              {info?.courseCode} · {info?.attendees}/{info?.total} present
            </div>
          </div>

          {/* Participant strip */}
          <div className="h-32 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {strip.map((p) => (
              <div key={p.id} className={`min-w-[160px] h-full rounded-xl border relative flex items-center justify-center ${
                p.status === 'away' || p.status === 'not-detected'
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : p.status === 'attention-shift'
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-dark-bg border-dark-border'
              }`}>
                <Users size={24} className="text-slate-700" />
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white backdrop-blur flex items-center gap-1">
                  {p.name}
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-brand-300 backdrop-blur">
                  {p.attentionScore}%
                </div>
              </div>
            ))}

            {participants.length > 5 && (
              <div className="min-w-[160px] h-full rounded-xl bg-dark-card border border-dark-border flex items-center justify-center cursor-pointer hover:bg-dark-cardHover transition-colors">
                <span className="text-xs font-semibold text-slate-400">+{participants.length - 5} More</span>
              </div>
            )}
          </div>
        </div>

        {/* Right rail: monitoring for students, chat for everyone */}
        {chatOpen && (
          <div className="w-80 flex flex-col gap-4 min-h-0">
            {isStudent && info?.active && cameraOptIn && (
              <ProctoringCamera
                sessionId={sessionId}
                contextType="CLASSROOM"
                compact
                reportEveryMs={5000}
              />
            )}

            {/* Host teacher: who is off task, and the control to readmit them. */}
            {isHost && <FocusStandings sessionId={sessionId} />}
            <GlassCard hover={false} className="flex-1 flex flex-col p-4 min-h-0">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-border">
              <Hash size={16} className="text-brand-400" />
              <h3 className="text-sm font-semibold text-white">Class Chat</h3>
              <span className="ml-auto text-[10px] text-slate-500">{messages.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">No messages yet. Say hello.</p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`p-3 text-xs rounded-xl ${
                    mine ? 'bg-brand-500/10 border border-brand-500/20'
                      : m.role === 'teacher' ? 'bg-violet-500/5 border border-violet-500/15'
                        : 'bg-dark-bg border border-dark-border'
                  }`}>
                    <div className="flex items-center justify-between font-medium mb-1">
                      <span className={mine ? 'text-brand-300' : m.role === 'teacher' ? 'text-violet-300' : 'text-white'}>
                        {m.sender}{mine ? ' (You)' : ''}
                      </span>
                      <span className="text-[9px] text-slate-500">{m.time}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{m.content}</p>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="mt-4 pt-3 border-t border-dark-border relative">
              <input
                type="text"
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="Type a message..."
                disabled={sending || !sessionId}
                className="w-full px-3 py-2.5 pr-10 rounded-xl bg-dark-bg border border-dark-border text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/50"
              />
              <button type="submit" disabled={sending || !msg.trim()}
                className="absolute right-2 top-[calc(50%+6px)] -translate-y-1/2 p-1.5 text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-40">
                <Send size={14} />
              </button>
            </form>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Controls */}
      <GlassCard hover={false} className="mt-4 p-3 flex items-center justify-between py-2">
        <div className="text-xs text-slate-400 hidden sm:block">
          {info?.duration} • EduVerse Video
        </div>
        <div className="flex items-center gap-3 mx-auto">
          <button onClick={() => setMicState(!micState)}
            className={`p-3 rounded-full transition-shadow ${micState ? 'bg-dark-card hover:bg-dark-border border border-dark-border text-white' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
            {micState ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={() => setCamState(!camState)}
            className={`p-3 rounded-full transition-shadow ${camState ? 'bg-dark-card hover:bg-dark-border border border-dark-border text-white' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
            {camState ? <VideoIcon size={18} /> : <VideoOff size={18} />}
          </button>
          <button className="p-3 rounded-full bg-dark-card hover:bg-dark-border border border-dark-border text-white transition-colors">
            <MonitorUp size={18} />
          </button>
          <button onClick={() => addToast('Hand raised — your teacher has been notified.', 'info')}
            className="p-3 rounded-full bg-dark-card hover:bg-dark-border border border-dark-border text-white transition-colors">
            <Hand size={18} />
          </button>
          <button className="p-3 rounded-full bg-dark-card hover:bg-dark-border border border-dark-border text-white transition-colors">
            <Settings size={18} />
          </button>
          {isHost && info?.active ? (
            <Button variant="danger" size="md" className="ml-4 rounded-full px-6 font-bold"
              disabled={endingSession} onClick={endSession}>
              {endingSession ? 'Ending…' : 'End Session'}
            </Button>
          ) : (
            <Button variant="danger" size="md" className="ml-4 rounded-full px-6 font-bold"
              onClick={() => navigate(-1)}>
              Leave
            </Button>
          )}
        </div>
        <div className="items-center gap-2 hidden sm:flex">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
            <Brain size={12} /> AI Active
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default OnlineClassroom;