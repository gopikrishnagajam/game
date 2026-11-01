import { describe, expect, it } from 'vitest';
import { RNG, vec } from '../src/core/math';
import type { Fielder } from '../src/core/types';
import { groundEvent, groundRuns, loftOutcome, segmentCircle } from '../src/fielding/fielding';

const fielder = (x: number, z: number, radius = 3): Fielder => ({ id: 'f', x, z, catchRadius: radius, groundRadius: radius });

describe('continuous invisible fielding', () => {
  it('intercepts a fast ball even when both frame endpoints are outside a zone', () => {
    expect(segmentCircle(vec(0, 0, 0), vec(0, 0, 50), 0, 25, 5)).toBeCloseTo(0.4);
    expect(groundEvent(vec(), vec(0, 0, 50), [fielder(0, 25, 5)])).toMatchObject({
      kind: 'intercept', position: { x: 0, z: 20 },
    });
  });

  it('chooses the first zone along travel, independent of array order', () => {
    const result = groundEvent(vec(), vec(0, 0, 80), [fielder(0, 50), fielder(0, 20)]);
    expect(result?.kind).toBe('intercept');
    expect(result?.position.z).toBeCloseTo(17);
  });

  it('awards a boundary before any interception beyond the field', () => {
    expect(groundEvent(vec(), vec(0, 0, 80), [fielder(0, 72)])).toMatchObject({
      kind: 'boundary', position: { z: 65 },
    });
  });

  it('includes tangencies, starts inside, and zero-length points inside circles', () => {
    expect(segmentCircle(vec(-5, 0, 3), vec(5, 0, 3), 0, 0, 3)).toBeCloseTo(0.5);
    expect(segmentCircle(vec(), vec(), 0, 0, 3)).toBe(0);
    expect(segmentCircle(vec(5, 0, 0), vec(5, 0, 0), 0, 0, 3)).toBeNull();
  });

  it('makes inclusive interception win an exact boundary tie', () => {
    expect(groundEvent(vec(), vec(0, 0, 80), [fielder(0, 68)])?.kind).toBe('intercept');
    expect(groundEvent(vec(), vec(0, 0, 65), [])?.kind).toBe('boundary');
  });
});

describe('landing and stopping scores', () => {
  it.each([[0, 0], [11.99, 0], [12, 1], [24.99, 1], [25, 2], [40, 3], [64, 3]])(
    'ground stop at %sm scores %s', (distance, expected) => expect(groundRuns(distance)).toBe(expected),
  );

  it('uses first aerial landing rings including the intentional interior four', () => {
    for (const [distance, expected] of [[0, 0], [12, 1], [25, 2], [40, 3], [55, 4], [65, 4], [66, 6]]) {
      expect(loftOutcome(vec(distance, 0, 0), [], 50, new RNG(1)).runs).toBe(expected);
    }
  });

  it('clears the actual boundary before attempting an out-of-bounds catch', () => {
    const rng = { next: () => { throw new Error('Unexpected catch draw'); } } as unknown as RNG;
    expect(loftOutcome(vec(70, 0, 0), [fielder(70, 0)], 0, rng)).toEqual({ runs: 6 });
    expect(loftOutcome(vec(20, 0, 0), [], 0, rng)).toEqual({ runs: 1 });
  });

  it('catches at zero confidence and still catches at full confidence', () => {
    const draw = { next: () => 0.79 } as unknown as RNG;
    expect(loftOutcome(vec(25, 0, 0), [fielder(25, 0)], 100, draw)).toEqual({ runs: 0, wicket: 'caught' });
    const highDraw = { next: () => 0.999 } as unknown as RNG;
    expect(loftOutcome(vec(25, 0, 0), [fielder(25, 0)], 0, highDraw).wicket).toBe('caught');
    expect(loftOutcome(vec(25, 0, 0), [fielder(25, 0)], 100, highDraw)).toEqual({ runs: 2, dropped: true });
  });

  it('draws only once for overlapping eligible circles and includes their edges', () => {
    let calls = 0;
    const draw = { next: () => { calls++; return 0.99; } } as unknown as RNG;
    expect(loftOutcome(vec(28, 0, 0), [fielder(25, 0), fielder(28, 0)], 50, draw).dropped).toBe(true);
    expect(calls).toBe(1);
  });
});
