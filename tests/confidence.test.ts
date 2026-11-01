import { describe, expect, it } from 'vitest';
import { catchProbability, confidenceFromHistory, confidenceModifiers } from '../src/confidence/confidence';
import { CONFIG } from '../src/core/config';

describe('individual three-delivery confidence', () => {
  it('starts at 50 and treats missing entries as neutral', () => {
    expect(confidenceFromHistory([])).toBe(50);
    expect(confidenceFromHistory([50])).toBeCloseTo(66.6666667);
    expect(confidenceFromHistory([50, 50])).toBeCloseTo(83.3333333);
    expect(confidenceFromHistory([0, 0, 0])).toBe(50);
  });

  it('reaches the specified perfect, miss, and defense anchors', () => {
    expect(confidenceFromHistory([50, 50, 50])).toBe(100);
    expect(confidenceFromHistory([-50, -50, -50])).toBe(0);
    expect(confidenceFromHistory([25, 25, 25])).toBe(75);
    expect(confidenceFromHistory([-35, -35, -35])).toBe(15);
    expect(confidenceFromHistory([10, 10, 10])).toBe(60);
  });

  it('uses only the latest three contributions and never mutates history', () => {
    const history = [50, 50, 50, -50, -50, -50];
    expect(confidenceFromHistory(history)).toBe(0);
    expect(history).toEqual([50, 50, 50, -50, -50, -50]);
    expect(confidenceFromHistory([50, 50, -50])).toBeCloseTo(66.6666667);
  });
});

describe('confidence modifiers', () => {
  it.each([[0, 1], [25, .95], [50, .9], [75, .85], [100, .8]])(
    'confidence %s gives catching probability %s', (confidence, probability) => {
      expect(catchProbability(confidence)).toBeCloseTo(probability);
    },
  );

  it('keeps catch probability bounded for out-of-range inputs', () => {
    expect(catchProbability(-10)).toBe(1);
    expect(catchProbability(150)).toBe(.8);
  });

  it('preserves a perfect hit at zero confidence and a miss at full confidence', () => {
    expect(confidenceModifiers(0, 1).quality).toBe(1);
    expect(confidenceModifiers(100, 0).quality).toBe(0);
  });

  it('changes marginal contact and precision with only modest power influence', () => {
    const low = confidenceModifiers(0, .5);
    const neutral = confidenceModifiers(50, .5);
    const high = confidenceModifiers(100, .5);
    expect(low.quality).toBeLessThan(neutral.quality);
    expect(neutral.quality).toBeLessThan(high.quality);
    expect(low.deviation).toBeGreaterThan(high.deviation);
    expect(low.power).toBeCloseTo(1 - CONFIG.confidence.powerCap);
    expect(high.power).toBeCloseTo(1 + CONFIG.confidence.powerCap);
    expect(neutral).toEqual({ quality: .5, power: 1, deviation: 1 });
  });

  it('does not alter any timing window', () => {
    const before = JSON.stringify(CONFIG.timing);
    for (let confidence = 0; confidence <= 100; confidence++) confidenceModifiers(confidence, .4);
    expect(JSON.stringify(CONFIG.timing)).toBe(before);
  });
});
