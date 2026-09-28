import React, { useState, useRef, useEffect } from 'react';
import { GlassCard, Button, Badge } from '../ui/Components';
import {
  MonitorUp, Camera, CameraOff, ShieldCheck, CheckCircle2, AlertTriangle,
  Loader2, ArrowRight, Users, Clock, Info,
} from 'lucide-react';

/**
 * Pre-join gate for a live class.
 *
 * Nothing starts automatically: the student sees what the session is, what will
 * be monitored, and has to grant screen sharing before the Join button unlocks.
 *
 * The browser always shows its own picker for screen sharing and never lets a
 * page capture silently. It also lets the student share a single tab instead of
 * the whole screen — which would defeat the point — so the share is rejected
 * unless `displaySurface` is `monitor`.
 *
 * @param {object} classInfo    session details from /classroom/live
 * @param {function} onJoin     called with { screenStream, cameraEnabled }
 * @param {function} onCancel   leave without joining
 */
const ClassroomLobby = ({ classInfo, onJoin, onCancel }) => {
  const [screenStream, setScreenStream] = useState(null);
  const [screenError, setScreenError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const previewRef = useRef(null);

  useEffect(() => {
    if (previewRef.current && screenStream) {
      previewRef.current.srcObject = screenStream;
      previewRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  // Release the preview if the student backs out of the lobby.
  useEffect(() => () => {
    screenStream?.getTracks().forEach(t => t.stop());
  }, [screenStream]);

  const requestScreen = async () => {
    setRequesting(true);
    setScreenError(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError('This browser does not support screen sharing. Use Chrome, Edge or Firefox on a desktop.');
      setRequesting(false);
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });
    } catch (err) {
      setScreenError(err?.name === 'NotAllowedError'
        ? 'Screen sharing was declined. It is required to join this class.'
        : `Screen sharing could not start (${err?.name || 'unknown error'}).`);
      setRequesting(false);
      return;
    }

    // The picker lets them choose a single tab or window; only a full screen
    // share gives the invigilator any real coverage.
    const surface = stream.getVideoTracks()[0]?.getSettings?.().displaySurface;
    if (surface && surface !== 'monitor') {
      stream.getTracks().forEach(t => t.stop());
      setScreenError(
        `You shared a single ${surface === 'browser' ? 'tab' : 'window'}. ` +
        'This class requires your entire screen — choose the "Entire Screen" tab in the picker.'
      );
      setRequesting(false);
      return;
    }

    setScreenStream(stream);
    setRequesting(false);
  };

  const dropScreen = () => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
  };

  const ready = !!screenStream;

  return (
    <div className="max-w-4xl mx-auto py-6 page-enter">
      <div className="text-center mb-6">
        <Badge variant={classInfo?.active ? 'success' : 'warning'} className="mb-3">
          {classInfo?.active ? 'Session is live' : 'Session has ended'}
        </Badge>
        <h1 className="text-2xl font-bold text-white mb-1">{classInfo?.subject || 'Live class'}</h1>
        <p className="text-sm text-slate-400">{classInfo?.topic}</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Screen preview */}
        <GlassCard hover={false} className="lg:col-span-3 p-0 overflow-hidden flex flex-col">
          <div className="relative bg-black flex-1" style={{ aspectRatio: '16 / 10' }}>
            <video ref={previewRef} muted playsInline
              className={`absolute inset-0 w-full h-full object-contain ${screenStream ? '' : 'hidden'}`} />

            {!screenStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center mb-4">
                  <MonitorUp size={26} className="text-slate-500" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Your screen is not being shared</p>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  This class requires you to share your entire screen so your teacher can see
                  you are working on course material.
                </p>
              </div>
            )}

            {screenStream && (
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 backdrop-blur flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-300">Entire screen shared</span>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-dark-border flex items-center justify-between gap-3">
            {screenStream ? (
              <>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Ready to join
                </span>
                <button onClick={dropScreen}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors">
                  Change what I share
                </button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={requestScreen} disabled={requesting}
                className="w-full flex items-center justify-center gap-2">
                {requesting
                  ? <><Loader2 size={14} className="animate-spin" /> Waiting for you to choose…</>
                  : <><MonitorUp size={14} /> Share my entire screen</>}
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard hover={false}>
            <h3 className="text-sm font-semibold text-white mb-3">Before you join</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  screenStream ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-bg border border-dark-border text-slate-500'
                }`}>
                  {screenStream ? <CheckCircle2 size={13} /> : <MonitorUp size={13} />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Screen sharing</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Required. Your entire screen, not a single tab.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  cameraEnabled ? 'bg-brand-500/20 text-brand-400' : 'bg-dark-bg border border-dark-border text-slate-500'
                }`}>
                  {cameraEnabled ? <Camera size={13} /> : <CameraOff size={13} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">Engagement camera</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    Optional. Runs on your device; no video is uploaded.
                  </p>
                  <button
                    onClick={() => setCameraEnabled(v => !v)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                      cameraEnabled
                        ? 'bg-brand-500/10 border-brand-500/30 text-brand-300'
                        : 'bg-dark-bg border-dark-border text-slate-400'
                    }`}
                  >
                    {cameraEnabled ? 'Camera on' : 'Camera off'}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false} className="border-amber-500/20">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-200 mb-1.5">While you are in class</p>
                <ul className="text-[11px] text-amber-100/70 space-y-1 leading-relaxed">
                  <li>• Leaving this window is recorded and reported to your teacher.</li>
                  <li>• Stopping the screen share counts the same way.</li>
                  <li>• Three off-task events remove you from the session.</li>
                </ul>
              </div>
            </div>
          </GlassCard>

          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Users size={12} /> {classInfo?.attendees ?? 0}/{classInfo?.total ?? 0} present
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> {classInfo?.duration || '00:00'}
            </span>
          </div>
        </div>
      </div>

      {screenError && (
        <div className="mt-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 max-w-2xl mx-auto">
          <AlertTriangle size={17} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-200 leading-relaxed">{screenError}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="ghost" onClick={onCancel}>Not now</Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!ready}
          onClick={() => onJoin({ screenStream, cameraEnabled })}
          className="flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Join class <ArrowRight size={17} />
        </Button>
      </div>

      {!ready && (
        <p className="mt-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Info size={11} /> Share your screen to unlock the Join button.
        </p>
      )}
    </div>
  );
};

export default ClassroomLobby;
