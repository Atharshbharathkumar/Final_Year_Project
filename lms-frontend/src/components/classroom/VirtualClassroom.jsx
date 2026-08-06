import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Hand, Send, Users, MessageSquare,
  CheckCircle2, Sparkles, WifiOff
} from 'lucide-react';
import { classroomApi } from '../../services/api';
import websocketService from '../../services/websocket';
import peerMesh from '../../services/webrtc';
import { useAuth } from '../../context/AuthContext';
import { CameraMonitor } from '../monitoring/CameraMonitor';

/** Attaches a MediaStream to a <video>; src cannot be set declaratively. */
const RemoteTile = ({ participant }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && participant.stream) {
      ref.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const connecting = participant.connectionState !== 'connected';

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      {participant.stream ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
          no media
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold text-white bg-slate-900/80 px-1.5 py-0.5 rounded backdrop-blur truncate">
          {participant.name}{participant.isTeacher ? ' (teacher)' : ''}
        </span>
        {connecting && (
          <span className="text-[9px] font-bold text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded">
            {participant.connectionState}
          </span>
        )}
      </div>
    </div>
  );
};

export const VirtualClassroom = ({ sessionId = 1, sessionTitle = 'Live class' }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [activePoll, setActivePoll] = useState(null);
  const [pollVoted, setPollVoted] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [chatError, setChatError] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [participants, setParticipants] = useState([]);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // --- Media capture + peer mesh -------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        // Joining without a camera is valid — you can still receive others.
        if (!cancelled) setMediaError('Camera/microphone unavailable. You can see and hear others, but cannot send.');
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      peerMesh.join({
        sessionId,
        localStream: stream,
        displayName: user?.fullName || 'Participant',
        isTeacher,
        onChange: (next) => setParticipants(next),
      });
    };

    start();

    return () => {
      cancelled = true;
      peerMesh.leave();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [sessionId, user?.fullName, isTeacher]);

  // --- Chat, hand raises and polls -----------------------------------------
  useEffect(() => {
    let cancelled = false;

    classroomApi
      .getChatHistory(sessionId)
      .then((res) => {
        if (cancelled) return;
        setMessages(res.data || []);
        setChatError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setChatError('Chat history unavailable — could not reach the server.');
      });

    const topic = `/topic/classroom/${sessionId}`;
    const off = websocketService.subscribe(topic, (data) => {
      if (data?.type === 'CHAT') {
        setMessages((prev) => [...prev, data]);
      } else if (data?.type === 'HAND_RAISE' && data.raised) {
        setMessages((prev) => [...prev, {
          id: `hand-${Date.now()}`,
          system: true,
          sender: { fullName: 'System' },
          content: `${data.senderName} raised their hand`,
          timestamp: new Date().toISOString(),
        }]);
      } else if (data?.type === 'POLL') {
        setActivePoll(data.poll);
        setPollVoted(false);
      }
    });

    return () => { cancelled = true; off(); };
  }, [sessionId]);

  // --- Controls -------------------------------------------------------------
  const toggleTrack = useCallback((kind, next) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks()
      .filter((t) => t.kind === kind)
      .forEach((t) => { t.enabled = next; });
  }, []);

  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    toggleTrack('audio', next);
  };

  const toggleCam = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    toggleTrack('video', next);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText;
    setInputText('');

    classroomApi.sendChatMessage(sessionId, content).catch(() => {
      setChatError('Message could not be saved on the server.');
    });
    websocketService.send(`/app/signal/${sessionId}`, {
      type: 'CHAT',
      sessionId: Number(sessionId),
      senderName: user?.fullName || 'Student',
      sender: { fullName: user?.fullName || 'Student' },
      content,
      timestamp: new Date().toISOString(),
    });
  };

  const toggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    websocketService.send(`/app/signal/${sessionId}`, {
      type: 'HAND_RAISE',
      sessionId: Number(sessionId),
      senderName: user?.fullName,
      raised: next,
    });
  };

  const triggerReaction = (emoji) => {
    setReaction(emoji);
    setTimeout(() => setReaction(null), 2500);
  };

  const triggerPoll = () => {
    const poll = {
      question: 'Quick check: is everyone following so far?',
      options: ['Yes, clear', 'Please slow down', 'Lost me'],
    };
    setActivePoll(poll);
    setPollVoted(false);
    websocketService.send(`/app/signal/${sessionId}`, {
      type: 'POLL', sessionId: Number(sessionId), poll,
    });
  };

  const connectedCount = participants.filter((p) => p.connectionState === 'connected').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
      <div className="lg:col-span-3 flex flex-col space-y-4 min-h-0">
        {/* Own camera */}
        <div className="relative flex-1 bg-slate-950 rounded-2xl overflow-hidden border border-dark-border shadow-2xl min-h-0">
          <video ref={localVideoRef} muted autoPlay playsInline className="w-full h-full object-cover" />

          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60">
            <span className={`w-2.5 h-2.5 rounded-full ${localStream ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold text-slate-100">
              You{isTeacher ? ' (teacher)' : ''}
            </span>
            <span className="text-[10px] font-mono text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
              {connectedCount} peer{connectedCount === 1 ? '' : 's'} connected
            </span>
          </div>

          {mediaError && (
            <div className="absolute top-4 right-4 z-20 max-w-xs px-3 py-2 rounded-xl bg-amber-950/90 border border-amber-500/40 text-[11px] font-semibold text-amber-200 flex items-start gap-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{mediaError}</span>
            </div>
          )}

          {/* Mounted only once the shared stream has resolved (or failed), so it
              never races ahead and opens the camera a second time itself. */}
          {(localStream || mediaError) && (
            <div className="absolute bottom-4 right-4 w-48 sm:w-56 z-20">
              <CameraMonitor
                studentId={user?.id}
                studentName={user?.fullName}
                sessionId={Number(sessionId)}
                contextType="CLASSROOM"
                externalStream={localStream}
                compact
              />
            </div>
          )}

          {reaction && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce z-30">
              {reaction}
            </div>
          )}

          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-slate-700/60">
            <button
              onClick={toggleMic}
              disabled={!localStream}
              className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${isMicOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-rose-600 text-white'}`}
              title={isMicOn ? 'Mute' : 'Unmute'}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleCam}
              disabled={!localStream}
              className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${isCamOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-rose-600 text-white'}`}
              title={isCamOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {isCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleHandRaise}
              className={`p-2.5 rounded-xl transition-all ${handRaised ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              title="Raise hand"
            >
              <Hand className="w-4 h-4" />
            </button>

            <button onClick={() => triggerReaction('👏')} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700" title="Clap">👏</button>
            <button onClick={() => triggerReaction('💡')} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700" title="Idea">💡</button>

            {isTeacher && (
              <button
                onClick={triggerPoll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold ml-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch poll</span>
              </button>
            )}
          </div>
        </div>

        {/* Remote participants */}
        <div className="shrink-0">
          {participants.length === 0 ? (
            <div className="p-4 rounded-xl glass-card border border-dashed border-slate-700 text-center">
              <p className="text-xs text-slate-400">
                No one else has joined yet. Open this session in another browser or device to connect a peer.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {participants.map((p) => (
                <RemoteTile key={p.peerId} participant={p} />
              ))}
            </div>
          )}
        </div>

        {activePoll && (
          <div className="shrink-0 p-4 rounded-xl glass-card border border-indigo-500/40 bg-indigo-950/30 flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Poll
              </h4>
              <p className="text-sm font-semibold text-slate-100 truncate">{activePoll.question}</p>
            </div>

            {!pollVoted ? (
              <div className="flex items-center gap-2 shrink-0">
                {activePoll.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setPollVoted(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Recorded locally
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="glass-card rounded-2xl border border-dark-border p-4 flex flex-col min-h-0 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">Live chat</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" /> {connectedCount + 1} in call
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs min-h-0">
          {chatError && (
            <p className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 font-semibold">
              {chatError}
            </p>
          )}
          {!chatError && messages.length === 0 && (
            <p className="text-slate-500 text-center py-6">No messages yet.</p>
          )}
          {messages.map((msg, index) => (
            <div key={msg.id || index} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${msg.system ? 'text-amber-400' : 'text-indigo-300'}`}>
                  {msg.sender?.fullName || msg.senderName || 'Student'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
              <p className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-200 leading-relaxed">
                {msg.content}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="pt-2 border-t border-dark-border flex gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
