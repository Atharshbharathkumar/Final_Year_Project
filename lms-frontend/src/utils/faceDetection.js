import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let frameBuffer = [];
const BUFFER_SIZE = 10;

/**
 * Single source of truth for which detection path is live.
 *   CNN      - face-api.js neural nets loaded, real landmark detection running
 *   DEGRADED - weights missing/unloadable, brightness+skin-tone heuristic only
 *   LOADING  - load not yet attempted or still in flight
 * Anything reading detection output must branch on this. A silent fallback
 * between the two paths is what made the earlier telemetry meaningless.
 */
const engineState = { mode: 'LOADING', reason: null };
export const getEngineState = () => ({ ...engineState });

let loadPromise = null;

export const loadFaceModels = async () => {
  if (modelsLoaded) return getEngineState();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      // ageGenderNet was loaded here previously but nothing ever read its output.
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      engineState.mode = 'CNN';
      engineState.reason = null;
    } catch (err) {
      modelsLoaded = false;
      engineState.mode = 'DEGRADED';
      engineState.reason = `Face model load failed (${err.message}). Landmark, head-pose, expression and multi-face detection are unavailable.`;
      console.error('[Vision] DEGRADED —', engineState.reason);
    }
    return getEngineState();
  })();

  return loadPromise;
};

/**
 * Per-frame attention analysis.
 *
 * On the CNN path (engineState.mode === 'CNN') this runs:
 * - Tiny Face Detector CNN for face bounding boxes and face count
 * - 68-point facial landmark CNN
 * - Head orientation approximated from landmark geometry (see estimateHeadPose)
 * - Eye Aspect Ratio (EAR) from the eye landmark polygons
 * - Expression classification via faceExpressionNet
 *
 * On the DEGRADED path none of the above is available; see advancedCanvasFallback.
 * The returned `engine` field says which path produced the result — callers must
 * not present DEGRADED output as measurement.
 */
export const detectAttention = async (videoElement, canvasElement) => {
  if (!videoElement || videoElement.readyState < 2) {
    // Video not ready yet. Report unknown rather than inventing a high score.
    return buildResult({
      faceDetected: null,
      faceCount: null,
      eyeStatus: 'UNKNOWN',
      attentionScore: null,
      engine: 'LOADING',
    });
  }

  if (modelsLoaded) {
    try {
      const detections = await faceapi
        .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
        .withFaceLandmarks()
        .withFaceExpressions();

      const displaySize = { width: videoElement.videoWidth || 480, height: videoElement.videoHeight || 360 };

      if (canvasElement) {
        faceapi.matchDimensions(canvasElement, displaySize);
        const resized = faceapi.resizeResults(detections, displaySize);
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, displaySize.width, displaySize.height);

        resized.forEach(det => {
          const box = det.detection.box;
          const score = Math.round(det.detection.score * 100);

          // Draw futuristic bounding box
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#6366f1';
          ctx.shadowBlur = 12;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          ctx.shadowBlur = 0;

          // Corner brackets
          const cornerLen = 16;
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          [[box.x, box.y], [box.x + box.width, box.y],
           [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].forEach(([cx, cy]) => {
            const sx = cx === box.x ? 1 : -1;
            const sy = cy === box.y ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sy * cornerLen);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + sx * cornerLen, cy);
            ctx.stroke();
          });

          // Score label
          ctx.fillStyle = 'rgba(11,15,25,0.75)';
          ctx.fillRect(box.x, box.y - 22, 160, 20);
          ctx.fillStyle = '#a5b4fc';
          ctx.font = '11px monospace';
          ctx.fillText(`AI Vision: ${score}% Conf`, box.x + 4, box.y - 6);

          // Draw refined landmarks
          if (det.landmarks) {
            const pts = det.landmarks.positions;
            ctx.fillStyle = 'rgba(99,102,241,0.7)';
            pts.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 1.2, 0, 2 * Math.PI);
              ctx.fill();
            });

            // Draw eye contour polygons
            drawEyeContour(ctx, det.landmarks.getLeftEye(), '#10b981');
            drawEyeContour(ctx, det.landmarks.getRightEye(), '#10b981');

            // Draw gaze direction arrow
            drawGazeArrow(ctx, det.landmarks, displaySize);
          }

          // Emotion label
          if (det.expressions) {
            const topEmotion = Object.entries(det.expressions)
              .sort((a, b) => b[1] - a[1])[0];
            const emotionLabel = `${emotionEmoji(topEmotion[0])} ${topEmotion[0].toUpperCase()} (${Math.round(topEmotion[1] * 100)}%)`;
            ctx.fillStyle = 'rgba(11,15,25,0.8)';
            ctx.fillRect(box.x, box.y + box.height + 2, 180, 20);
            ctx.fillStyle = '#a78bfa';
            ctx.font = '11px monospace';
            ctx.fillText(emotionLabel, box.x + 4, box.y + box.height + 16);
          }
        });
      }

      const faceCount = detections.length;

      if (faceCount === 0) {
        return buildResult({ faceDetected: false, faceCount: 0, eyeStatus: 'NO_FACE', attentionScore: 0 });
      }

      if (faceCount > 1) {
        return buildResult({ faceDetected: true, faceCount, eyeStatus: 'MULTIPLE_FACES', attentionScore: 15 });
      }

      const det = detections[0];
      const landmarks = det.landmarks;

      // Head orientation approximated from landmark geometry (not PnP solving).
      const headPose = estimateHeadPose(landmarks.positions, videoElement.videoWidth, videoElement.videoHeight);

      // === Eye Aspect Ratio (EAR) for drowsiness detection ===
      const leftEAR = computeEAR(landmarks.getLeftEye());
      const rightEAR = computeEAR(landmarks.getRightEye());
      const avgEAR = (leftEAR + rightEAR) / 2;
      const eyesClosed = avgEAR < 0.2;

      // === Gaze direction ===
      let eyeStatus = 'CENTER';
      if (eyesClosed) {
        eyeStatus = 'EYES_CLOSED';
      } else if (Math.abs(headPose.yaw) > 18) {
        eyeStatus = 'LOOKING_AWAY';
      } else if (Math.abs(headPose.pitch) > 15) {
        eyeStatus = 'LOOKING_DOWN';
      }

      // === Dominant emotion ===
      let dominantEmotion = 'neutral';
      if (det.expressions) {
        dominantEmotion = Object.entries(det.expressions).sort((a, b) => b[1] - a[1])[0][0];
      }

      // === Temporal smoothing via Exponential Moving Average ===
      const rawScore = computeAttentionScore(headPose, avgEAR, eyeStatus, faceCount);
      const smoothedScore = applyEMA(rawScore);

      return buildResult({
        faceDetected: true,
        faceCount: 1,
        eyeStatus,
        attentionScore: smoothedScore,
        headPose,
        earScore: avgEAR,
        dominantEmotion,
        eyesClosed,
      });

    } catch (e) {
      // A throw here means the nets loaded but inference failed. That is a real
      // degradation, so record it rather than quietly switching engines.
      engineState.mode = 'DEGRADED';
      engineState.reason = `Inference error: ${e.message}`;
      console.error('[Vision] DEGRADED —', engineState.reason);
    }
  }

  return presenceOnlyFallback(videoElement, canvasElement);
};

const drawEyeContour = (ctx, eyePoints, color) => {
  if (!eyePoints || eyePoints.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  eyePoints.forEach((pt, i) => {
    i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
  });
  ctx.closePath();
  ctx.stroke();
};

const drawGazeArrow = (ctx, landmarks, displaySize) => {
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  if (!nose || !leftEye || !rightEye) return;

  const eyeMidX = (leftEye[0].x + rightEye[3].x) / 2;
  const eyeMidY = (leftEye[0].y + rightEye[3].y) / 2;
  const noseX = nose[3].x;
  const noseY = nose[6].y;

  const dx = noseX - eyeMidX;
  const dy = noseY - eyeMidY;

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(eyeMidX, eyeMidY);
  ctx.lineTo(eyeMidX + dx * 2, eyeMidY + dy * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
};

const estimateHeadPose = (positions, imgWidth, imgHeight) => {
  try {
    // Simplified Euler angle estimation from facial landmark geometry
    const leftEyeCenter = positions[36];
    const rightEyeCenter = positions[45];
    const noseTip = positions[30];
    const chinTip = positions[8];

    const dx = rightEyeCenter.x - leftEyeCenter.x;
    const dy = rightEyeCenter.y - leftEyeCenter.y;

    const roll = Math.atan2(dy, dx) * (180 / Math.PI);
    const yaw = ((noseTip.x - (leftEyeCenter.x + rightEyeCenter.x) / 2) / (imgWidth * 0.5)) * 50;
    const pitch = ((noseTip.y - (leftEyeCenter.y + rightEyeCenter.y) / 2) / (imgHeight * 0.5)) * 40;

    return {
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: Math.round(roll * 10) / 10,
    };
  } catch {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
};

const computeEAR = (eyePoints) => {
  if (!eyePoints || eyePoints.length < 6) return 0.3;
  const A = dist(eyePoints[1], eyePoints[5]);
  const B = dist(eyePoints[2], eyePoints[4]);
  const C = dist(eyePoints[0], eyePoints[3]);
  return (A + B) / (2.0 * C);
};

const dist = (p1, p2) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const computeAttentionScore = (headPose, ear, eyeStatus, faceCount) => {
  let score = 100;
  score -= Math.min(30, Math.abs(headPose.yaw) * 1.2);
  score -= Math.min(20, Math.abs(headPose.pitch) * 1.0);
  score -= Math.min(15, Math.abs(headPose.roll) * 0.6);
  if (eyeStatus === 'EYES_CLOSED') score -= 30;
  if (eyeStatus === 'LOOKING_AWAY') score -= 25;
  if (eyeStatus === 'LOOKING_DOWN') score -= 10;
  if (ear < 0.2) score -= 15;
  if (faceCount === 0) score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const applyEMA = (newScore, alpha = 0.35) => {
  frameBuffer.push(newScore);
  if (frameBuffer.length > BUFFER_SIZE) frameBuffer.shift();
  return Math.round(
    frameBuffer.reduce((acc, s, i) => {
      const weight = Math.pow(1 - alpha, frameBuffer.length - 1 - i);
      return acc + s * weight;
    }, 0) / frameBuffer.reduce((acc, _, i) => acc + Math.pow(1 - alpha, frameBuffer.length - 1 - i), 0)
  );
};

/**
 * Missing values are null, never a plausible-looking default. A caller that
 * receives null must render "unavailable", not a number. The previous defaults
 * (score 90, pose {0,0,0}, EAR 0.3, 'neutral') were indistinguishable from real
 * readings and are the reason the HUD appeared to work while measuring nothing.
 */
const buildResult = (data) => ({
  faceDetected: data.faceDetected ?? null,
  faceCount: data.faceCount ?? null,
  eyeStatus: data.eyeStatus ?? 'UNKNOWN',
  attentionScore: data.attentionScore ?? null,
  headPose: data.headPose ?? null,
  earScore: data.earScore ?? null,
  dominantEmotion: data.dominantEmotion ?? null,
  eyesClosed: data.eyesClosed ?? null,
  presenceHint: data.presenceHint ?? null,
  engine: data.engine ?? engineState.mode,
  timestamp: Date.now(),
});

const emotionEmoji = (emotion) => {
  const map = { happy: '😊', sad: '😔', surprised: '😲', fearful: '😨', disgusted: '🤢', angry: '😠', neutral: '😐' };
  return map[emotion] || '😐';
};

/**
 * DEGRADED path — used only when the face models are unavailable.
 *
 * This is a skin-tone and brightness pixel count. It is not face detection and
 * it is not attention measurement: it cannot locate a face, count faces, tell
 * where someone is looking, or tell whether their eyes are open. A bare arm or
 * a warm-toned wall will satisfy it.
 *
 * It therefore returns a presence HINT and nothing else. Every measured field is
 * null so that no caller can accidentally render heuristic output as telemetry.
 */
const presenceOnlyFallback = (videoElement, canvasElement) => {
  try {
    const width = videoElement.videoWidth || 480;
    const height = videoElement.videoHeight || 360;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let skinPixels = 0;
    let totalBrightness = 0;
    let motionPixels = 0;
    const totalPixels = (width * height) / 4;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      // Skin tone detection: YCbCr color space approximation
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (Y > 80 && Cb >= 77 && Cb <= 127 && Cr >= 133 && Cr <= 173) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / totalPixels;
    const avgBrightness = totalBrightness / totalPixels;

    // Presence hint only. Deliberately NOT called faceDetected — this cannot
    // distinguish a face from any other skin-toned region in frame.
    const presenceHint = skinRatio > 0.06 && avgBrightness > 30;

    // No bounding box is drawn: there is no detection to draw a box around.
    // Drawing one previously made the degraded path look identical to the CNN path.
    if (canvasElement) {
      const oc = canvasElement.getContext('2d');
      oc.clearRect(0, 0, width, height);
      oc.fillStyle = 'rgba(180,83,9,0.85)';
      oc.fillRect(0, 0, width, 26);
      oc.fillStyle = '#fef3c7';
      oc.font = 'bold 12px monospace';
      oc.fillText('DEGRADED - no face model. Not measuring attention.', 8, 17);
    }

    return buildResult({
      faceDetected: null,
      faceCount: null,
      eyeStatus: 'UNAVAILABLE',
      attentionScore: null,
      headPose: null,
      presenceHint,
      engine: 'DEGRADED',
    });
  } catch (err) {
    return buildResult({ eyeStatus: 'UNAVAILABLE', engine: 'DEGRADED' });
  }
};
