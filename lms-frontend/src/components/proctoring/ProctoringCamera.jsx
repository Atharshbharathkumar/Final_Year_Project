import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, ShieldCheck, AlertTriangle, Loader2, Eye, Users } from 'lucide-react';
import { Button, Badge } from '../ui/Components';
import { loadFaceModels, detectAttention, disposeFaceModels, loadError } from '../../utils/faceDetection';
import { monitoringApi } from '../../services/api';

/**
 * Camera-based engagement monitoring.
 *
 * Three rules govern this component:
 *   1. The camera never opens without an explicit click. Consent is revocable
 *      at any time with one control.
 *   2. No image ever leaves the browser. Inference runs locally and only the
 *      derived numbers are posted.
 *   3. When the model or the camera is unavailable it says so and posts
 *      nothing. It never invents a reading.
 *
 * @param {number} sessionId    classroom session id, or exam attempt id
 * @param {'CLASSROOM'|'EXAM'} contextType
 * @param {number} [reportEveryMs=5000] how often a reading is posted
 * @param {boolean} [compact]   render the small in-corner variant
 * @param {function} [onReading] called with each local reading
 */
const ProctoringCamera = ({
  sessionId,
  contextType = 'CLASSROOM',
  reportEveryMs = 5000,
  compact = false,
  onReading,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const readingRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | starting | active | denied | error | stopped
  const [message, setMessage] = useState(null);
  const [reading, setReading] = useState(null);
  const [reported, setReported] = useState(0);

  const stop = useCallback(({ keepStatus } = {}) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

    readingRef.current = null;
    setReading(null);
    if (!keepStatus) setStatus('stopped');
  }, []);

  // Tear the camera down if the component unmounts while running.
  useEffect(() => () => {
    stop({ keepStatus: true });
    disposeFaceModels();
  }, [stop]);

  const start = async () => {
    setStatus('starting');
    setMessage('Loading the on-device vision model…');

    const ready = await loadFaceModels();
    if (!ready) {
      setStatus('error');
      setMessage(loadError || 'The vision model could not be loaded on this device.');
      return;
    }

    let stream;
    try {
      setMessage('Waiting for camera permission…');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      // Distinguish "user said no" from "there is no camera".
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setStatus(denied ? 'denied' : 'error');
      setMessage(denied
        ? 'Camera access was declined. Monitoring is off and nothing is being recorded.'
        : `No camera is available on this device (${err?.name || 'unknown error'}).`);
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    await video.play().catch(() => {});

    setStatus('active');
    setMessage(null);
    loop();
  };

  const loop = useCallback(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      const next = detectAttention(video, canvasRef.current);
      if (next) {
        readingRef.current = next;
        setReading(next);
        onReading?.(next);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [onReading]);

  // Post readings on a fixed cadence rather than every frame.
  useEffect(() => {
    if (status !== 'active' || !sessionId) return undefined;

    const timer = setInterval(async () => {
      const current = readingRef.current;
      if (!current) return; // nothing measured — report nothing

      try {
        await monitoringApi.logAttention({
          sessionId,
          contextType,
          score: current.attentionScore,
          faceDetected: current.faceDetected,
          faceCount: current.faceCount,
          eyeStatus: current.eyeStatus,
          isTabActive: document.visibilityState === 'visible',
          timestamp: Date.now(),
        });
        setReported(count => count + 1);
      } catch {
        // A dropped reading is not worth interrupting an exam over.
      }
    }, reportEveryMs);

    return () => clearInterval(timer);
  }, [status, sessionId, contextType, reportEveryMs]);

  const statusTone = () => {
    if (status !== 'active') return 'slate';
    if (!reading) return 'brand';
    if (reading.faceCount > 1) return 'danger';
    if (!reading.faceDetected) return 'danger';
    if (reading.attentionScore < 60) return 'warning';
    return 'success';
  };

  const statusLabel = () => {
    if (status === 'starting') return 'Starting…';
    if (status === 'denied') return 'Declined';
    if (status === 'error') return 'Unavailable';
    if (status !== 'active') return 'Off';
    if (!reading) return 'Measuring…';
    if (reading.faceCount > 1) return 'Multiple faces';
    if (!reading.faceDetected) return 'No face';
    return `${reading.attentionScore}% attention`;
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      status === 'active' ? 'border-emerald-500/30 bg-dark-card' : 'border-dark-border bg-dark-card'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-dark-border">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck size={14} className={status === 'active' ? 'text-emerald-400' : 'text-slate-500'} />
          <span className="text-xs font-semibold text-white truncate">Engagement Monitoring</span>
        </div>
        <Badge variant={statusTone()}>{statusLabel()}</Badge>
      </div>

      {/* Video stage. The 4:3 box applies only while a stream is playing —
          the consent and error states size to their own content so nothing is
          clipped in a narrow sidebar. */}
      <div
        className="relative bg-black"
        style={status === 'active' ? { aspectRatio: '4 / 3' } : { minHeight: '9rem' }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${status === 'active' ? '' : 'opacity-0'}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${status === 'active' ? '' : 'hidden'}`}
        />

        {status !== 'active' && (
          <div className="flex flex-col items-center justify-center text-center p-5">
            {status === 'starting' ? (
              <>
                <Loader2 size={28} className="text-brand-400 animate-spin mb-3" />
                <p className="text-xs text-slate-400">{message}</p>
              </>
            ) : status === 'denied' || status === 'error' ? (
              <>
                <AlertTriangle size={28} className="text-amber-400 mb-3" />
                <p className="text-xs text-amber-200 max-w-[260px] leading-relaxed">{message}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={start}>Try again</Button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center mb-3">
                  <CameraOff size={22} className="text-slate-500" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Camera is off</p>
                <p className="text-[11px] text-slate-400 max-w-[280px] leading-relaxed mb-4">
                  Turning this on measures your engagement locally in this browser.
                  Video is never uploaded — only attention scores are sent to your teacher.
                </p>
                <Button variant="primary" size="sm" onClick={start} className="flex items-center gap-2">
                  <Camera size={14} /> Turn on monitoring
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Live readout */}
      {status === 'active' && (
        <div className="px-3 py-2 border-t border-dark-border space-y-2">
          {!compact && reading && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Gaze</p>
                <p className="text-[11px] font-bold text-white truncate">
                  {reading.eyeStatus.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Head yaw</p>
                <p className="text-[11px] font-bold text-white tabular-nums">{reading.headPose.yaw}°</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Faces</p>
                <p className={`text-[11px] font-bold tabular-nums ${
                  reading.faceCount > 1 ? 'text-rose-400' : 'text-white'
                }`}>
                  {reading.faceCount}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Eye size={10} /> {reported} reading{reported === 1 ? '' : 's'} sent
            </span>
            <button
              onClick={() => stop()}
              className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <CameraOff size={11} /> Turn off
            </button>
          </div>
        </div>
      )}

      {/* Standing privacy notice */}
      <div className="px-3 py-2 bg-dark-bg/60 border-t border-dark-border">
        <p className="text-[9px] text-slate-500 leading-relaxed flex items-start gap-1.5">
          <Users size={10} className="mt-0.5 shrink-0" />
          Processed on this device with MediaPipe. No video or image is transmitted or stored.
        </p>
      </div>
    </div>
  );
};

export default ProctoringCamera;
