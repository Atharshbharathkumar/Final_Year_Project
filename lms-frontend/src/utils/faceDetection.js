import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  LEFT_EYE_EAR, RIGHT_EYE_EAR, THRESHOLDS,
  computeEAR, eulerFromMatrix, blendshape, gazeDeviation, dominantExpression,
  classifyEyeStatus, computeAttentionScore, createSmoother, landmarkBounds, buildReading,
} from './faceScoring';

/**
 * Proctoring vision pipeline, built on MediaPipe FaceLandmarker.
 *
 * The model produces 478 3D landmarks, 52 blendshapes and a facial
 * transformation matrix per face. Head pose comes from that matrix rather than
 * from a hand-rolled approximation, and eye state comes from the blendshapes
 * cross-checked against a geometric eye aspect ratio.
 *
 * Everything runs in the browser. Frames never leave the device — only the
 * derived numbers in {@link buildReading} are sent anywhere.
 *
 * The WASM runtime and the model are served from `public/`, so this works with
 * no internet connection at demo time.
 */

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/face_landmarker.task';

let landmarker = null;
let loadPromise = null;
let lastVideoTime = -1;
let lastResult = null;

const smoother = createSmoother(0.35, 10);

/** Why the pipeline is unavailable, surfaced to the UI instead of a silent fallback. */
export let loadError = null;

export const isModelLoaded = () => landmarker !== null;

/**
 * Loads the WASM runtime and the landmark model. Safe to call repeatedly — the
 * work happens once and subsequent callers await the same promise.
 */
export const loadFaceModels = async () => {
  if (landmarker) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        // Two faces is enough to detect "someone else is in frame" without
        // paying for a crowd.
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      loadError = null;
      console.info('[Proctoring] MediaPipe FaceLandmarker ready');
      return true;
    } catch (gpuError) {
      // Machines without a usable WebGL context still need to work.
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        loadError = null;
        console.info('[Proctoring] MediaPipe FaceLandmarker ready (CPU)');
        return true;
      } catch (cpuError) {
        loadError = cpuError?.message || gpuError?.message || 'The vision model could not be loaded.';
        landmarker = null;
        loadPromise = null;
        console.error('[Proctoring] model load failed:', loadError);
        return false;
      }
    }
  })();

  return loadPromise;
};

/** Releases the model and its GPU resources. */
export const disposeFaceModels = () => {
  try {
    landmarker?.close();
  } catch {
    /* already torn down */
  }
  landmarker = null;
  loadPromise = null;
  lastVideoTime = -1;
  lastResult = null;
  smoother.reset();
};

/**
 * Runs one inference against the current video frame.
 *
 * Returns null when the pipeline cannot produce a reading — there is no
 * fabricated score and no fallback that invents a face. Callers must handle
 * null by reporting nothing.
 */
export const detectAttention = (videoElement, canvasElement) => {
  if (!landmarker || !videoElement || videoElement.readyState < 2) return null;
  if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

  // detectForVideo requires a strictly increasing timestamp; re-running on the
  // same frame throws, so reuse the previous result instead.
  const now = performance.now();
  if (videoElement.currentTime === lastVideoTime) return lastResult;
  lastVideoTime = videoElement.currentTime;

  let result;
  try {
    result = landmarker.detectForVideo(videoElement, now);
  } catch (err) {
    console.warn('[Proctoring] inference failed:', err?.message);
    return null;
  }

  const faces = result.faceLandmarks || [];
  const faceCount = faces.length;

  if (faceCount === 0) {
    lastResult = buildReading({
      faceDetected: false,
      faceCount: 0,
      eyeStatus: 'NO_FACE',
      attentionScore: smoother.push(0),
    });
    drawOverlay(canvasElement, videoElement, null, lastResult);
    return lastResult;
  }

  const landmarks = faces[0];
  const blendshapes = result.faceBlendshapes?.[0]?.categories || null;
  const matrix = result.facialTransformationMatrixes?.[0]?.data || null;

  const headPose = eulerFromMatrix(matrix);

  const leftEar = computeEAR(landmarks, LEFT_EYE_EAR);
  const rightEar = computeEAR(landmarks, RIGHT_EYE_EAR);
  const earScore = (leftEar + rightEar) / 2;

  const blinkScore = Math.max(
    blendshape(blendshapes, 'eyeBlinkLeft'),
    blendshape(blendshapes, 'eyeBlinkRight')
  );
  const eyesClosed = blinkScore > THRESHOLDS.eyesClosedBlendshape
    || earScore < THRESHOLDS.eyesClosedEar;

  const gaze = gazeDeviation(blendshapes);
  const eyeStatus = classifyEyeStatus({ faceCount, eyesClosed, headPose, gaze });
  const rawScore = computeAttentionScore({ faceCount, eyeStatus, headPose, gaze });

  lastResult = buildReading({
    faceDetected: true,
    faceCount,
    eyeStatus,
    attentionScore: smoother.push(rawScore),
    headPose,
    earScore: Math.round(earScore * 1000) / 1000,
    gaze: Math.round(gaze * 100) / 100,
    dominantEmotion: dominantExpression(blendshapes),
    eyesClosed,
  });

  drawOverlay(canvasElement, videoElement, { landmarks, faces }, lastResult);
  return lastResult;
};

// ────────────────────────────── overlay drawing ─────────────────────────────

const COLOURS = {
  box: '#6366f1',
  corner: '#10b981',
  eye: '#10b981',
  gaze: '#f59e0b',
  warn: '#f43f5e',
};

/**
 * Draws the box, eye contours and gaze vector. Kept lightweight: the full 478
 * point tessellation is drawn as a sparse cloud rather than a mesh so this
 * stays cheap enough to run every frame.
 */
const drawOverlay = (canvas, video, detection, reading) => {
  if (!canvas) return;

  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  if (!detection) {
    ctx.fillStyle = 'rgba(244,63,94,0.12)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = COLOURS.warn;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No face detected', width / 2, height / 2);
    ctx.textAlign = 'left';
    return;
  }

  const { landmarks, faces } = detection;
  const multiple = faces.length > 1;
  const box = landmarkBounds(landmarks, width, height);
  if (!box) return;

  // Bounding box with corner brackets.
  const accent = multiple ? COLOURS.warn : COLOURS.box;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.shadowBlur = 0;

  const cornerLength = Math.min(18, box.width / 4);
  ctx.strokeStyle = multiple ? COLOURS.warn : COLOURS.corner;
  ctx.lineWidth = 3;
  [
    [box.x, box.y, 1, 1],
    [box.x + box.width, box.y, -1, 1],
    [box.x, box.y + box.height, 1, -1],
    [box.x + box.width, box.y + box.height, -1, -1],
  ].forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * cornerLength);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * cornerLength, cy);
    ctx.stroke();
  });

  // Sparse landmark cloud.
  ctx.fillStyle = 'rgba(99,102,241,0.45)';
  for (let i = 0; i < landmarks.length; i += 6) {
    const point = landmarks[i];
    ctx.fillRect(point.x * width, point.y * height, 1.4, 1.4);
  }

  // Eye rings.
  ctx.strokeStyle = reading.eyesClosed ? COLOURS.warn : COLOURS.eye;
  ctx.lineWidth = 1.5;
  [LEFT_EYE_EAR, RIGHT_EYE_EAR].forEach(ring => {
    ctx.beginPath();
    ring.forEach((index, position) => {
      const point = landmarks[index];
      if (!point) return;
      const x = point.x * width;
      const y = point.y * height;
      if (position === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  });

  // Gaze vector projected from the nose tip using the head rotation.
  const nose = landmarks[1];
  if (nose) {
    const originX = nose.x * width;
    const originY = nose.y * height;
    const length = box.width * 0.6;
    const dx = Math.sin((reading.headPose.yaw * Math.PI) / 180) * length;
    const dy = Math.sin((reading.headPose.pitch * Math.PI) / 180) * length;

    ctx.strokeStyle = COLOURS.gaze;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLOURS.gaze;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX - dx, originY + dy);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Readout.
  const label = multiple
    ? `${faces.length} FACES IN FRAME`
    : `${reading.attentionScore}% attention · ${reading.eyeStatus.replace(/_/g, ' ').toLowerCase()}`;

  ctx.fillStyle = 'rgba(11,15,25,0.8)';
  ctx.fillRect(box.x, Math.max(0, box.y - 24), Math.max(180, ctx.measureText(label).width + 16), 22);
  ctx.fillStyle = multiple ? COLOURS.warn : '#a5b4fc';
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(label, box.x + 6, Math.max(14, box.y - 8));
};

export { THRESHOLDS };
