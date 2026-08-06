import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ShieldAlert, AlertTriangle, BrainCircuit, Activity } from 'lucide-react';
import { loadFaceModels, detectAttention, getEngineState } from '../../utils/faceDetection';
import { monitoringApi } from '../../services/api';
import { AttentionMeter } from './AttentionMeter';

const emotionEmoji = (emotion) => {
  const map = { happy: '😊', sad: '😔', surprised: '😲', fearful: '😨', disgusted: '🤢', angry: '😠', neutral: '😐' };
  return map[emotion] || '😐';
};

// One sample every 2s. At 600ms this produced ~100 DB rows per student per
// minute; 2s gives ~30, which is ample for an engagement trend and keeps a
// 30-student class under ~900 inserts/min.
const SAMPLE_INTERVAL_MS = 2000;

export const CameraMonitor = ({
  studentId,
  studentName,
  sessionId = 1,
  contextType = 'CLASSROOM',
  onAlert,
  onSnapshot,
  // When the parent already holds a camera stream (the classroom does, for the
  // peer connection), reuse it. Opening the same device twice is wasteful and
  // fails outright on some platforms.
  externalStream = null,
  compact = false,
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [engine, setEngine] = useState(getEngineState());
  // null means "not measured yet" and must render as such, never as a number.
  const [attentionScore, setAttentionScore] = useState(null);
  const [detectionState, setDetectionState] = useState({
    faceDetected: null,
    faceCount: null,
    eyeStatus: 'UNKNOWN',
    isTabActive: true,
    headPose: null,
    earScore: null,
    dominantEmotion: null,
    eyesClosed: null,
  });

  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const ownsStreamRef = useRef(false);

  useEffect(() => {
    loadFaceModels().then(setEngine);
    startCamera(externalStream);

    // Tab visibility monitoring
    const handleVisibilityChange = () => {
      const isTabActive = !document.hidden;
      setDetectionState((prev) => ({ ...prev, isTabActive }));
      if (!isTabActive) {
        // A tab switch is directly observed, so it is reported regardless of
        // which vision engine is running. Vision fields are null because none
        // of them were measured at this moment.
        monitoringApi.logAttention({
          studentId, studentName, sessionId, contextType,
          score: null, faceDetected: null, faceCount: null,
          eyeStatus: 'TAB_SWITCH', isTabActive: false, timestamp: Date.now(),
        }).catch(() => {});
        if (onAlert) onAlert({ type: 'TAB_SWITCH', message: 'Tab switched / window lost focus' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopCamera();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [studentId, sessionId, contextType, externalStream]);

  const startCamera = async (provided) => {
    try {
      // A provided stream is owned by the parent, so it must not be stopped here.
      const stream = provided || await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      ownsStreamRef.current = !provided;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          startDetectionLoop();
        };
      }
    } catch (err) {
      // No camera means no monitoring. Previously this started a loop that
      // invented scores; now it reports the outage and stops.
      setPermissionError('Camera permission denied or unavailable — monitoring is off');
      setCameraActive(false);
      setAttentionScore(null);
    }
  };

  const stopCamera = () => {
    // Only tear down a stream this component opened. Stopping the classroom's
    // shared stream would kill the outgoing peer video too.
    if (streamRef.current && ownsStreamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  };

  const startDetectionLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const result = await detectAttention(videoRef.current, canvasRef.current);

      setEngine(getEngineState());
      setAttentionScore(result.attentionScore);
      setDetectionState((prev) => ({
        ...prev,
        faceDetected: result.faceDetected,
        faceCount: result.faceCount,
        eyeStatus: result.eyeStatus,
        headPose: result.headPose,
        earScore: result.earScore,
        dominantEmotion: result.dominantEmotion,
        eyesClosed: result.eyesClosed,
      }));

      // Only the CNN path can make these determinations. On the degraded path
      // faceDetected and faceCount are null, so no alert is raised — an absent
      // alert is correct here, a guessed one is not.
      if (result.engine === 'CNN') {
        if (result.faceDetected === false || result.faceCount > 1) {
          captureSnapshot(result.faceCount > 1 ? 'MULTI_FACE' : 'NO_FACE');
          if (onAlert) onAlert({
            type: result.faceCount > 1 ? 'MULTIPLE_FACES' : 'NO_FACE',
            message: result.faceCount > 1 ? 'Multiple faces detected in live camera feed!' : 'Student stepped away!',
          });
        }
      }

      // Telemetry is only sent when it was actually measured. Publishing a
      // degraded-path placeholder would put unmeasured numbers in the teacher's
      // dashboard and in the exam integrity record.
      if (studentId && result.attentionScore !== null) {
        monitoringApi.logAttention({
          studentId, studentName, sessionId, contextType,
          score: result.attentionScore,
          faceDetected: result.faceDetected,
          faceCount: result.faceCount,
          eyeStatus: result.eyeStatus,
          isTabActive: !document.hidden,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }, SAMPLE_INTERVAL_MS);
  };

  const captureSnapshot = (reason = 'INTERVAL') => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 360;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 480, 360);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      if (onSnapshot) onSnapshot(dataUrl, reason);
    } catch (e) {}
  };

  const { headPose, dominantEmotion, earScore, eyesClosed } = detectionState;
  const isCnn = engine.mode === 'CNN';
  const isDegraded = engine.mode === 'DEGRADED';

  return (
    <div className="relative rounded-2xl overflow-hidden glass-card border border-dark-border bg-slate-900/90 shadow-xl">
      <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!cameraActive && (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="p-4 rounded-full bg-slate-800/80 text-amber-400 border border-amber-500/20">
              <CameraOff className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{permissionError || 'Starting camera…'}</p>
              <p className="text-xs text-slate-400 mt-1">No attention data is being recorded.</p>
            </div>
          </div>
        )}

        {/* Status Badges Row */}
        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
          {/* Which engine is running is stated on screen, not just in console. */}
          <div
            className={`px-2 py-0.5 rounded-full backdrop-blur-md border flex items-center gap-1.5 text-[10px] font-bold ${
              isCnn
                ? 'bg-slate-900/80 border-emerald-500/40 text-emerald-300'
                : isDegraded
                ? 'bg-amber-600/90 border-amber-400 text-white'
                : 'bg-slate-900/80 border-slate-700/50 text-slate-300'
            }`}
            title={engine.reason || ''}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isCnn ? 'bg-emerald-400 animate-ping' : 'bg-amber-300'}`} />
            <BrainCircuit className="w-3 h-3" />
            <span>{isCnn ? 'CNN face detection' : isDegraded ? '⚠ DEGRADED — no face model' : 'Loading model…'}</span>
          </div>

          {detectionState.faceDetected === false && (
            <div className="px-2 py-0.5 rounded-full bg-rose-500/90 text-white flex items-center gap-1 text-[10px] font-bold animate-bounce shadow-lg shadow-rose-500/30">
              <ShieldAlert className="w-3 h-3" /> NO FACE
            </div>
          )}

          {detectionState.faceCount > 1 && (
            <div className="px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 text-[10px] font-bold animate-bounce">
              <AlertTriangle className="w-3 h-3" /> MULTI-FACE ({detectionState.faceCount})
            </div>
          )}

          {!detectionState.isTabActive && (
            <div className="px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" /> TAB SWITCH
            </div>
          )}

          {eyesClosed === true && (
            <div className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
              😴 DROWSY
            </div>
          )}
        </div>

        {/* Landmark telemetry HUD — CNN path only. Rendering this on the degraded
            path is what previously showed 0°/0.30/neutral as if measured. */}
        {cameraActive && isCnn && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="flex gap-2">
                <span className="text-slate-400">YAW <span className="text-indigo-300 font-bold">{headPose?.yaw ?? '—'}°</span></span>
                <span className="text-slate-400">PITCH <span className="text-indigo-300 font-bold">{headPose?.pitch ?? '—'}°</span></span>
                <span className="text-slate-400">ROLL <span className="text-indigo-300 font-bold">{headPose?.roll ?? '—'}°</span></span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-slate-400">EAR <span className={`font-bold ${earScore !== null && earScore < 0.22 ? 'text-rose-400' : 'text-emerald-400'}`}>{earScore !== null ? earScore.toFixed(2) : '—'}</span></span>
                {dominantEmotion && (
                  <span className="text-purple-300 font-bold">{emotionEmoji(dominantEmotion)} {dominantEmotion.toUpperCase()}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {cameraActive && isDegraded && (
          <div className="absolute bottom-0 left-0 right-0 bg-amber-950/90 border-t border-amber-500/40 px-2 py-1.5">
            <p className="text-[10px] font-bold text-amber-200 leading-tight">
              Landmark telemetry unavailable — face model not loaded.
            </p>
            <p className="text-[9px] text-amber-300/80 leading-tight mt-0.5">
              No attention score, head pose or face count is being recorded.
            </p>
          </div>
        )}
      </div>

      {!compact && (
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <AttentionMeter score={attentionScore} compact />
        </div>
      )}
    </div>
  );
};
