import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { vec } from '../src/core/math';
import { sweepCapsule, sweepStumps, type Capsule } from '../src/physics/collision';

const pad: Capsule = { a: vec(0.25, 0.1, 0.2), b: vec(0.25, 0.6, 0.2), radius: 0.085 };

describe('moving pad collision', () => {
  it('finds a fast ball crossing a pad between frame endpoints', () => {
    const hit = sweepCapsule(vec(0.25, 0.3, 0.8), vec(0.25, 0.3, -0.3), pad, pad, CONFIG.ballRadius);
    expect(hit).not.toBeNull();
    expect(hit!.point.z).toBeCloseTo(0.2 + 0.085 + CONFIG.ballRadius, 5);
    expect(hit!.point.y).toBeCloseTo(0.3);
    expect(hit!.t).toBeGreaterThan(0);
    expect(hit!.t).toBeLessThan(1);
  });

  it('detects a pad moving across a stationary ball', () => {
    const from = { a: vec(-0.3, 0.1, 0), b: vec(-0.3, 0.6, 0), radius: 0.085 };
    const to = { a: vec(0.3, 0.1, 0), b: vec(0.3, 0.6, 0), radius: 0.085 };
    const hit = sweepCapsule(vec(0, 0.3, 0), vec(0, 0.3, 0), from, to, CONFIG.ballRadius);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeCloseTo((0.3 - 0.085 - CONFIG.ballRadius) / 0.6, 5);
  });

  it('does not dismiss a ball passing outside the actual pad capsule', () => {
    expect(sweepCapsule(vec(-0.2, 0.3, 0.8), vec(-0.2, 0.3, -0.3), pad, pad, CONFIG.ballRadius)).toBeNull();
    expect(sweepCapsule(vec(0.25, 0.9, 0.8), vec(0.25, 0.9, -0.3), pad, pad, CONFIG.ballRadius)).toBeNull();
  });

  it('includes the rounded knee endpoint and a pre-existing overlap', () => {
    expect(sweepCapsule(vec(0.25, 0.65, 0.8), vec(0.25, 0.65, -0.3), pad, pad, CONFIG.ballRadius)).not.toBeNull();
    expect(sweepCapsule(vec(0.25, 0.3, 0.2), vec(0.25, 0.3, -0.3), pad, pad, CONFIG.ballRadius)?.t).toBe(0);
  });

  it('handles a zero-length capsule as a sphere', () => {
    const sphere = { a: vec(), b: vec(), radius: 0.1 };
    expect(sweepCapsule(vec(0, 0, 1), vec(0, 0, -1), sphere, sphere, 0.036)?.point.z).toBeCloseTo(0.136, 5);
  });
});

describe('physical wicket envelope', () => {
  it('detects the first contact with a stump rather than waiting for the center plane', () => {
    const hit = sweepStumps(vec(0, 0.4, 0), vec(0, 0.4, -1.2));
    expect(hit).not.toBeNull();
    expect(hit!.point.z).toBeCloseTo(CONFIG.stump.z + CONFIG.ballRadius, 8);
    expect(hit!.t).toBeCloseTo((CONFIG.stump.z + CONFIG.ballRadius) / -1.2, 8);
  });

  it('allows balls outside off and balls clearing the bails to pass', () => {
    expect(sweepStumps(vec(-0.25, 0.4, 0), vec(-0.25, 0.4, -1.2))).toBeNull();
    expect(sweepStumps(vec(0, 1.1, 0), vec(0, 1.1, -1.2))).toBeNull();
  });

  it('includes a grazing radius at the wicket edge', () => {
    const x = CONFIG.stump.halfWidth + CONFIG.ballRadius;
    expect(sweepStumps(vec(x, 0.4, 0), vec(x, 0.4, -1.2))).not.toBeNull();
    expect(sweepStumps(vec(x + 0.001, 0.4, 0), vec(x + 0.001, 0.4, -1.2))).toBeNull();
  });

  it('rejects a segment that has not reached the stumps', () => {
    expect(sweepStumps(vec(0, 0.4, 1), vec(0, 0.4, 0))).toBeNull();
    expect(sweepStumps(vec(0, 0.4, -1), vec(0, 0.4, -2))).toBeNull();
  });

  it('gives event times that allow an earlier pad strike to beat a later stump hit', () => {
    const a = vec(0.1, 0.4, 0.8), b = vec(0.1, 0.4, -1.2);
    const alignedPad = { a: vec(0.1, 0.1, 0.2), b: vec(0.1, 0.6, 0.2), radius: 0.085 };
    const padHit = sweepCapsule(a, b, alignedPad, alignedPad, CONFIG.ballRadius);
    const stumpHit = sweepStumps(a, b);
    expect(padHit).not.toBeNull();
    expect(stumpHit).not.toBeNull();
    expect(padHit!.t).toBeLessThan(stumpHit!.t);
  });
});
