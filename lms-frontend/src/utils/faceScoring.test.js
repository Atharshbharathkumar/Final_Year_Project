import { describe, it, expect } from 'vitest';
import {
  LEFT_EYE_EAR, THRESHOLDS,
  computeEAR, eulerFromMatrix, blendshape, gazeDeviation, dominantExpression,
  classifyEyeStatus, computeAttentionScore, createSmoother, landmarkBounds, buildReading,
} from './faceScoring';

/** Builds a sparse landmark array with specific indices populated. */
const landmarksWith = (points) => {
  const array = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  Object.entries(points).forEach(([index, point]) => { array[Number(index)] = point; });
  return array;
};

/** A 4x4 column-major identity matrix, as MediaPipe returns it. */
const identityMatrix = () => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

describe('computeEAR', () => {
  it('is high for an open eye', () => {
    // Corners 0.2 apart horizontally, lids 0.1 apart vertically.
    const landmarks = landmarksWith({
      33: { x: 0.40, y: 0.50 }, 133: { x: 0.60, y: 0.50 },
      160: { x: 0.45, y: 0.45 }, 144: { x: 0.45, y: 0.55 },
      158: { x: 0.55, y: 0.45 }, 153: { x: 0.55, y: 0.55 },
    });

    const ear = computeEAR(landmarks, LEFT_EYE_EAR);
    expect(ear).toBeCloseTo(0.5, 2);
    expect(ear).toBeGreaterThan(THRESHOLDS.eyesClosedEar);
  });

  it('collapses towards zero for a closed eye', () => {
    const landmarks = landmarksWith({
      33: { x: 0.40, y: 0.50 }, 133: { x: 0.60, y: 0.50 },
      160: { x: 0.45, y: 0.499 }, 144: { x: 0.45, y: 0.501 },
      158: { x: 0.55, y: 0.499 }, 153: { x: 0.55, y: 0.501 },
    });

    expect(computeEAR(landmarks, LEFT_EYE_EAR)).toBeLessThan(THRESHOLDS.eyesClosedEar);
  });

  it('returns zero rather than NaN when landmarks are missing', () => {
    expect(computeEAR([], LEFT_EYE_EAR)).toBe(0);
    expect(computeEAR(null, LEFT_EYE_EAR)).toBe(0);
    expect(computeEAR(landmarksWith({ 33: null }), LEFT_EYE_EAR)).toBe(0);
  });

  it('does not divide by zero when the eye corners coincide', () => {
    const landmarks = landmarksWith({
      33: { x: 0.5, y: 0.5 }, 133: { x: 0.5, y: 0.5 },
      160: { x: 0.5, y: 0.4 }, 144: { x: 0.5, y: 0.6 },
      158: { x: 0.5, y: 0.4 }, 153: { x: 0.5, y: 0.6 },
    });

    expect(computeEAR(landmarks, LEFT_EYE_EAR)).toBe(0);
  });
});

describe('eulerFromMatrix', () => {
  it('reads a head facing the camera as zero on every axis', () => {
    expect(eulerFromMatrix(identityMatrix())).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it('reads a yaw rotation of thirty degrees', () => {
    const angle = Math.PI / 6; // 30 degrees about Y
    const matrix = [
      Math.cos(angle), 0, -Math.sin(angle), 0,
      0, 1, 0, 0,
      Math.sin(angle), 0, Math.cos(angle), 0,
      0, 0, 0, 1,
    ];

    const { yaw, pitch, roll } = eulerFromMatrix(matrix);
    expect(yaw).toBeCloseTo(30, 0);
    expect(pitch).toBeCloseTo(0, 0);
    expect(roll).toBeCloseTo(0, 0);
  });

  it('reads a roll rotation of forty-five degrees', () => {
    const angle = Math.PI / 4; // 45 degrees about Z
    const matrix = [
      Math.cos(angle), Math.sin(angle), 0, 0,
      -Math.sin(angle), Math.cos(angle), 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];

    expect(eulerFromMatrix(matrix).roll).toBeCloseTo(45, 0);
  });

  it('degrades to zeroes when the model reported no matrix', () => {
    expect(eulerFromMatrix(null)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    expect(eulerFromMatrix([1, 0, 0])).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });
});

describe('blendshape helpers', () => {
  const categories = [
    { categoryName: 'eyeBlinkLeft', score: 0.9 },
    { categoryName: 'eyeLookOutLeft', score: 0.7 },
    { categoryName: 'mouthSmileLeft', score: 0.6 },
    { categoryName: 'mouthSmileRight', score: 0.55 },
  ];

  it('reads a named score', () => {
    expect(blendshape(categories, 'eyeBlinkLeft')).toBe(0.9);
  });

  it('returns zero for a shape the model did not report', () => {
    expect(blendshape(categories, 'jawOpen')).toBe(0);
    expect(blendshape(null, 'jawOpen')).toBe(0);
  });

  it('derives gaze deviation from the eye-look shapes', () => {
    expect(gazeDeviation(categories)).toBeCloseTo(0.7, 2);
    expect(gazeDeviation(null)).toBe(0);
  });

  it('labels a clear smile as happy', () => {
    expect(dominantExpression(categories)).toBe('happy');
  });

  it('labels an open jaw as surprised', () => {
    expect(dominantExpression([{ categoryName: 'jawOpen', score: 0.8 }])).toBe('surprised');
  });

  it('labels a lowered brow as focused', () => {
    expect(dominantExpression([{ categoryName: 'browDownLeft', score: 0.7 }])).toBe('focused');
  });

  it('defaults to neutral', () => {
    expect(dominantExpression([])).toBe('neutral');
    expect(dominantExpression(null)).toBe('neutral');
  });
});

describe('classifyEyeStatus', () => {
  const base = { faceCount: 1, eyesClosed: false, headPose: { yaw: 0, pitch: 0, roll: 0 }, gaze: 0 };

  it('reports NO_FACE when the frame is empty', () => {
    expect(classifyEyeStatus({ ...base, faceCount: 0 })).toBe('NO_FACE');
  });

  it('reports MULTIPLE_FACES when someone else is in shot', () => {
    expect(classifyEyeStatus({ ...base, faceCount: 2 })).toBe('MULTIPLE_FACES');
  });

  it('prefers MULTIPLE_FACES over eye state, because presence matters more', () => {
    expect(classifyEyeStatus({ ...base, faceCount: 3, eyesClosed: true })).toBe('MULTIPLE_FACES');
  });

  it('reports EYES_CLOSED ahead of head direction', () => {
    expect(classifyEyeStatus({ ...base, eyesClosed: true, headPose: { yaw: 40, pitch: 0 } }))
      .toBe('EYES_CLOSED');
  });

  it('reports LOOKING_AWAY past the yaw threshold, in either direction', () => {
    expect(classifyEyeStatus({ ...base, headPose: { yaw: 25, pitch: 0 } })).toBe('LOOKING_AWAY');
    expect(classifyEyeStatus({ ...base, headPose: { yaw: -25, pitch: 0 } })).toBe('LOOKING_AWAY');
  });

  it('catches eyes drifting off screen even when the head is still', () => {
    expect(classifyEyeStatus({ ...base, gaze: 0.6 })).toBe('LOOKING_AWAY');
  });

  it('reports LOOKING_DOWN for a downward pitch', () => {
    expect(classifyEyeStatus({ ...base, headPose: { yaw: 0, pitch: 20 } })).toBe('LOOKING_DOWN');
  });

  it('reports CENTER when facing the screen', () => {
    expect(classifyEyeStatus(base)).toBe('CENTER');
    expect(classifyEyeStatus({ ...base, headPose: { yaw: 19, pitch: 14 } })).toBe('CENTER');
  });
});

describe('computeAttentionScore', () => {
  const facing = { faceCount: 1, eyeStatus: 'CENTER', headPose: { yaw: 0, pitch: 0, roll: 0 }, gaze: 0 };

  it('is a perfect hundred for a candidate looking straight at the screen', () => {
    expect(computeAttentionScore(facing)).toBe(100);
  });

  it('is zero when no face is present', () => {
    expect(computeAttentionScore({ ...facing, faceCount: 0 })).toBe(0);
  });

  it('collapses when a second person appears', () => {
    expect(computeAttentionScore({ ...facing, faceCount: 2 })).toBe(15);
  });

  it('falls as the head turns away', () => {
    const slight = computeAttentionScore({ ...facing, headPose: { yaw: 10, pitch: 0, roll: 0 } });
    const heavy = computeAttentionScore({ ...facing, headPose: { yaw: 35, pitch: 0, roll: 0 } });

    expect(slight).toBeLessThan(100);
    expect(heavy).toBeLessThan(slight);
  });

  it('caps the yaw penalty so one axis cannot dominate', () => {
    const extreme = computeAttentionScore({ ...facing, headPose: { yaw: 180, pitch: 0, roll: 0 } });
    expect(extreme).toBe(70); // 100 - the 30-point cap
  });

  it('penalises closed eyes more than looking down', () => {
    const closed = computeAttentionScore({ ...facing, eyeStatus: 'EYES_CLOSED' });
    const down = computeAttentionScore({ ...facing, eyeStatus: 'LOOKING_DOWN' });

    expect(closed).toBeLessThan(down);
  });

  it('never leaves the nought to hundred range', () => {
    const worst = computeAttentionScore({
      faceCount: 1, eyeStatus: 'EYES_CLOSED',
      headPose: { yaw: 90, pitch: 90, roll: 90 }, gaze: 1,
    });

    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
  });
});

describe('createSmoother', () => {
  it('returns the first value unchanged', () => {
    expect(createSmoother().push(80)).toBe(80);
  });

  it('damps a single outlier so a blink does not read as disengagement', () => {
    const smoother = createSmoother();
    [95, 95, 95, 95].forEach(v => smoother.push(v));

    const afterBlink = smoother.push(0);

    expect(afterBlink).toBeGreaterThan(40);
    expect(afterBlink).toBeLessThan(95);
  });

  it('converges towards a sustained new level', () => {
    const smoother = createSmoother();
    for (let i = 0; i < 10; i++) smoother.push(90);
    for (let i = 0; i < 10; i++) smoother.push(20);

    expect(smoother.push(20)).toBeLessThan(30);
  });

  it('keeps only the configured window', () => {
    const smoother = createSmoother(0.35, 3);
    [1, 2, 3, 4, 5].forEach(v => smoother.push(v));

    expect(smoother.size).toBe(3);
  });

  it('can be reset between sessions', () => {
    const smoother = createSmoother();
    smoother.push(90);
    smoother.reset();

    expect(smoother.size).toBe(0);
    expect(smoother.push(10)).toBe(10);
  });
});

describe('landmarkBounds', () => {
  it('returns the pixel bounds of a normalised landmark set', () => {
    const points = [
      { x: 0.25, y: 0.10 },
      { x: 0.75, y: 0.60 },
      { x: 0.50, y: 0.35 },
    ];

    expect(landmarkBounds(points, 640, 480)).toEqual({ x: 160, y: 48, width: 320, height: 240 });
  });

  it('returns null for an empty set', () => {
    expect(landmarkBounds([], 640, 480)).toBeNull();
    expect(landmarkBounds(null, 640, 480)).toBeNull();
  });
});

describe('buildReading', () => {
  it('defaults to an explicit no-detection reading rather than inventing a score', () => {
    const reading = buildReading();

    expect(reading.faceDetected).toBe(false);
    expect(reading.faceCount).toBe(0);
    expect(reading.attentionScore).toBe(0);
    expect(reading.eyeStatus).toBe('NO_FACE');
  });

  it('carries the fields the backend contract expects', () => {
    const reading = buildReading({ faceDetected: true, faceCount: 1, attentionScore: 88 });

    expect(reading).toHaveProperty('headPose.yaw');
    expect(reading).toHaveProperty('earScore');
    expect(reading).toHaveProperty('eyeStatus');
    expect(reading).toHaveProperty('timestamp');
    expect(reading.attentionScore).toBe(88);
  });
});
