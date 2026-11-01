import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/math';
import { createMatch } from '../src/match/match';
import { generateDelivery } from '../src/bowling/bowling';
import type { Delivery, Outcome } from '../src/core/types';

describe('fair seeded bowling', () => {
  it('reproduces the whole committed delivery and field for identical seeds', () => {
    const match = createMatch('blue', 'club', 56);
    expect(generateDelivery(match, new RNG(989))).toEqual(generateDelivery(match, new RNG(989)));
  });

  it('chooses pace then spin and locks all trajectory and field parameters', () => {
    const match = createMatch('yellow', 'pro', 89);
    const first = generateDelivery(match, new RNG(3));
    expect(['fast', 'medium']).toContain(first.style);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.field)).toBe(true);
    expect(Object.isFrozen(first.velocity)).toBe(true);
    expect(Object.isFrozen(first.field[0])).toBe(true);
    match.balls = 6;
    expect(['offSpin', 'legSpin']).toContain(generateDelivery(match, new RNG(3)).style);
  });

  it('uses a distribution of strategies consistent with configured difficulty', () => {
    for (const [difficulty, normalWeight] of [['beginner', 0.80], ['club', 0.60], ['pro', 0.45]] as const) {
      const match = createMatch('blue', difficulty, 1);
      const counts = { normal: 0, tactical: 0, surprise: 0 };
      for (let seed = 1; seed <= 600; seed++) counts[generateDelivery(match, new RNG(seed)).strategy]++;
      expect(counts.normal / 600).toBeCloseTo(normalWeight, 1);
      expect(counts.tactical).toBeGreaterThan(0);
      expect(counts.surprise).toBeGreaterThan(0);
    }
  });

  it('responds to completed repeated leg lofts by preferring a legal off-side line', () => {
    const match = createMatch('blue', 'club', 5);
    const past: Outcome = { runs: 6, quality: 'perfect', contribution: 50, direction: 'leg', shotType: 'loft' };
    match.outcomes = [past, past, past];
    let tactical: Delivery | undefined;
    for (let seed = 1; seed < 100; seed++) {
      const d = generateDelivery(match, new RNG(seed));
      if (d.strategy === 'tactical' && d.fieldName === 'offSide') { tactical = d; break; }
    }
    expect(tactical).toBeDefined();
    expect(tactical!.contact.x).toBeLessThan(-0.3);
    expect(tactical!.length).toBe('yorker');
    // Later modifications to the past cannot alter this already committed delivery.
    const saved = JSON.stringify(tactical);
    match.outcomes = [];
    expect(JSON.stringify(tactical)).toBe(saved);
  });
});
