/**
 * Pure scoring functions for the proctoring pipeline.
 *
 * These are deliberately separated from the MediaPipe wiring in
 * `faceDetection.js` so the maths can be unit-tested without a browser, a
 * camera or a WebGL context.
 *
 * Landmark indices refer to the MediaPipe Face Mesh topology (478 points).
 */

/** Six-point eye rings used for the eye aspect ratio, in EAR order. */
export const LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380];

/** Thresholds, kept in one place so the tests and the UI agree. */
export const THRESHOLDS = {
  eyesClosedEar: 0.18,
  eyesClosedBlendshape: 0.5,
  yawAway: 20,
  pitchDown: 15,
  gazeAway: 0.45,
  deepAttention: 85,
};

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Eye aspect ratio: the two vertical eyelid distances over twice the
 * horizontal corner-to-corner distance. Falls towards zero as the lid closes.
 */
export const computeEAR = (landmarks, ring) => {
  if (!landmarks || landmarks.length === 0) return 0;
  const p = ring.map(i => landmarks[i]);
  if (p.some(point => !point)) return 0;

  const vertical = distance(p[1], p[5]) + distance(p[2], p[4]);
  const horizontal = distance(p[0], p[3]);
  if (horizontal === 0) return 0;
  return vertical / (2 * horizontal);
};

/**
 * Euler angles in degrees from MediaPipe's 4x4 facial transformation matrix.
 * The matrix arrives column-major, so the rotation submatrix is read as
 * r[row][col] = data[col * 4 + row].
 */
export const eulerFromMatrix = (matrix) => {
  if (!matrix || matrix.length < 16) return { yaw: 0, pitch: 0, roll: 0 };

  const r00 = matrix[0], r10 = matrix[1], r20 = matrix[2];
  const r21 = matrix[6], r22 = matrix[10];

  // `+ 0` collapses the negative zero that atan2 produces for a head facing
  // straight ahead, so a level head reads as 0 rather than -0.
  const toDegrees = (radians) => Math.round((radians * 180 / Math.PI) * 10) / 10 + 0;

  return {
    pitch: toDegrees(Math.atan2(r21, r22)),
    yaw: toDegrees(Math.atan2(-r20, Math.hypot(r21, r22))),
    roll: toDegrees(Math.atan2(r10, r00)),
  };
};

/** Reads a named blendshape score, or 0 when the model did not report it. */
export const blendshape = (categories, name) => {
  if (!categories) return 0;
  const match = categories.find(c => c.categoryName === name);
  return match ? match.score : 0;
};

/**
 * Horizontal gaze deviation in the range 0..1, from the eye-look blendshapes.
 * Looking sharply left or right pushes this towards 1 even when the head is
 * still, which is what catches a candidate reading from a second screen.
 */
export const gazeDeviation = (categories) => {
  if (!categories) return 0;
  const left = Math.max(blendshape(categories, 'eyeLookOutLeft'), blendshape(categories, 'eyeLookInRight'));
  const right = Math.max(blendshape(categories, 'eyeLookOutRight'), blendshape(categories, 'eyeLookInLeft'));
  return Math.min(1, Math.max(left, right));
};

/** Coarse expression label from the blendshape set. */
export const dominantExpression = (categories) => {
  if (!categories || categories.length === 0) return 'neutral';

  const smile = Math.max(blendshape(categories, 'mouthSmileLeft'), blendshape(categories, 'mouthSmileRight'));
  const frown = Math.max(blendshape(categories, 'browDownLeft'), blendshape(categories, 'browDownRight'));
  const surprise = Math.max(blendshape(categories, 'browInnerUp'), blendshape(categories, 'jawOpen'));

  if (smile > 0.4) return 'happy';
  if (surprise > 0.45) return 'surprised';
  if (frown > 0.4) return 'focused';
  return 'neutral';
};

/**
 * Decides the eye-status token the backend's alert rules key off.
 * Order matters: presence beats gaze, and closed eyes beat direction.
 */
export const classifyEyeStatus = ({ faceCount, eyesClosed, headPose, gaze }) => {
  if (!faceCount) return 'NO_FACE';
  if (faceCount > 1) return 'MULTIPLE_FACES';
  if (eyesClosed) return 'EYES_CLOSED';

  const { yaw = 0, pitch = 0 } = headPose || {};
  if (Math.abs(yaw) > THRESHOLDS.yawAway || (gaze ?? 0) > THRESHOLDS.gazeAway) return 'LOOKING_AWAY';
  if (pitch > THRESHOLDS.pitchDown) return 'LOOKING_DOWN';
  return 'CENTER';
};

/**
 * Attention as a 0-100 figure. Head rotation away from the screen costs the
 * most, then eye state, then gaze drift.
 */
export const computeAttentionScore = ({ faceCount, eyeStatus, headPose, gaze }) => {
  if (!faceCount) return 0;
  if (faceCount > 1) return 15;

  const { yaw = 0, pitch = 0, roll = 0 } = headPose || {};
  let score = 100;

  score -= Math.min(30, Math.abs(yaw) * 1.2);
  score -= Math.min(20, Math.abs(pitch) * 1.0);
  score -= Math.min(15, Math.abs(roll) * 0.6);
  score -= Math.min(20, (gaze ?? 0) * 25);

  if (eyeStatus === 'EYES_CLOSED') score -= 30;
  else if (eyeStatus === 'LOOKING_AWAY') score -= 25;
  else if (eyeStatus === 'LOOKING_DOWN') score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Exponential moving average over a rolling window. Single frames are noisy —
 * a blink should not read as disengagement — so every score the backend sees is
 * smoothed.
 */
export const createSmoother = (alpha = 0.35, windowSize = 10) => {
  let buffer = [];

  return {
    push(value) {
      buffer.push(value);
      if (buffer.length > windowSize) buffer.shift();

      let weightedSum = 0;
      let weightTotal = 0;
      buffer.forEach((sample, index) => {
        const weight = Math.pow(1 - alpha, buffer.length - 1 - index);
        weightedSum += sample * weight;
        weightTotal += weight;
      });
      return Math.round(weightedSum / weightTotal);
    },
    reset() {
      buffer = [];
    },
    get size() {
      return buffer.length;
    },
  };
};

/** Axis-aligned bounds of a normalised landmark set, in pixels. */
export const landmarkBounds = (landmarks, width, height) => {
  if (!landmarks || landmarks.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    x: minX * width,
    y: minY * height,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  };
};

/** The reading shape posted to the backend and rendered by the UI. */
export const buildReading = (data = {}) => ({
  faceDetected: data.faceDetected ?? false,
  faceCount: data.faceCount ?? 0,
  eyeStatus: data.eyeStatus ?? 'NO_FACE',
  attentionScore: data.attentionScore ?? 0,
  headPose: data.headPose ?? { yaw: 0, pitch: 0, roll: 0 },
  earScore: data.earScore ?? 0,
  gaze: data.gaze ?? 0,
  dominantEmotion: data.dominantEmotion ?? 'neutral',
  eyesClosed: data.eyesClosed ?? false,
  timestamp: data.timestamp ?? Date.now(),
});
