import { describe, expect, it } from 'vitest';
import { applyOutcome, createMatch } from '../src/match/match';
import type { Match, Outcome } from '../src/core/types';

const ball = (runs = 0, contribution = 0): Outcome => ({ runs, contribution, quality: 'good' });
const wicket = (): Outcome => ({ runs: 0, contribution: -50, quality: 'miss', wicket: 'bowled' });
function play(match: Match, outcomes: Outcome[]): Match {
  return outcomes.reduce((state, result) => applyOutcome(state, result).match, match);
}

describe('Quick Chase setup', () => {
  it.each([['beginner', 16], ['club', 24], ['pro', 32]] as const)('sets the %s target to %s', (level, target) => {
    const match = createMatch('blue', level, 1234);
    expect(match.target).toBe(target);
    expect(match.batters).toHaveLength(4);
    expect(match.batters.map(batter => batter.confidence)).toEqual([50, 50, 50, 50]);
    expect(match.striker).toBe(0);
    expect(match.nonStriker).toBe(1);
    expect(match.nextBatter).toBe(2);
    expect(match.complete).toBe(false);
  });

  it('supports both teams and seeded pace/spin bowler allocations', () => {
    expect(createMatch('yellow', 'club', 42).team).toBe('yellow');
    expect(createMatch('blue', 'club', 42)).toEqual(createMatch('blue', 'club', 42));
    const allocations = Array.from({ length: 80 }, (_, seed) => createMatch('blue', 'club', seed));
    expect(new Set(allocations.map(match => match.paceStyle))).toEqual(new Set(['fast', 'medium']));
    expect(new Set(allocations.map(match => match.spinStyle))).toEqual(new Set(['offSpin', 'legSpin']));
  });
});

describe('score and strike updates', () => {
  it.each([0, 2, 4, 6])('retains strike for %s runs', runs => {
    const { match } = applyOutcome(createMatch('blue', 'club', 1), ball(runs));
    expect(match.striker).toBe(0);
    expect(match.runs).toBe(runs);
    expect(match.batters[0].runs).toBe(runs);
    expect(match.batters[0].balls).toBe(1);
    expect(match.balls).toBe(1);
  });

  it.each([1, 3])('swaps strike for %s runs', runs => {
    const { match } = applyOutcome(createMatch('blue', 'club', 1), ball(runs));
    expect(match.striker).toBe(1);
    expect(match.nonStriker).toBe(0);
    expect(match.batters[0].runs).toBe(runs);
    expect(match.batters[1].balls).toBe(0);
  });

  it('swaps strike at the end of an over', () => {
    const beforeSix = play(createMatch('blue', 'club', 1), Array.from({ length: 5 }, () => ball()));
    const update = applyOutcome(beforeSix, ball());
    expect(update.overChanged).toBe(true);
    expect(update.match.balls).toBe(6);
    expect(update.match.striker).toBe(1);
    expect(update.match.nonStriker).toBe(0);
  });

  it('applies the odd-run swap before the sixth-ball over swap', () => {
    const beforeSix = play(createMatch('blue', 'club', 1), Array.from({ length: 5 }, () => ball()));
    const update = applyOutcome(beforeSix, ball(1, 50));
    expect(update.overChanged).toBe(true);
    expect(update.match.striker).toBe(0);
    expect(update.match.nonStriker).toBe(1);
    expect(update.match.batters[0].runs).toBe(1);
    expect(update.match.batters[0].balls).toBe(6);
  });

  it('keeps personal confidence and history while off strike', () => {
    const first = applyOutcome(createMatch('blue', 'club', 1), ball(1, 50)).match;
    const after = applyOutcome(first, ball(1, -50)).match;
    expect(after.striker).toBe(0);
    expect(after.batters[0].confidence).toBeCloseTo(66.6666667);
    expect(after.batters[0].history).toEqual([50]);
    expect(after.batters[1].confidence).toBeCloseTo(33.3333333);
    expect(after.batters[1].history).toEqual([-50]);
  });

  it('rolls the faced batter history without confidence feeding itself', () => {
    const match = play(createMatch('blue', 'club', 1), [ball(0, 50), ball(0, 50), ball(0, 50), ball(0, -50)]);
    expect(match.batters[0].history).toEqual([50, 50, -50]);
    expect(match.batters[0].confidence).toBeCloseTo(66.6666667);
  });

  it('does not mutate a previous match or the caller outcome', () => {
    const before = createMatch('blue', 'club', 1);
    const snapshot = JSON.stringify(before);
    const result = ball(1, 50);
    const next = applyOutcome(before, result).match;
    expect(JSON.stringify(before)).toBe(snapshot);
    next.batters[0].history.push(10);
    expect(before.batters[0].history).toEqual([]);
    result.runs = 6;
    expect(next.outcomes[0].runs).toBe(1);
  });
});

describe('wickets and innings termination', () => {
  it('replaces only the dismissed striker with a neutral new batter', () => {
    let match = applyOutcome(createMatch('yellow', 'pro', 1), ball(1, 50)).match;
    match = applyOutcome(match, wicket()).match;
    expect(match.wickets).toBe(1);
    expect(match.batters[1].out).toBe(true);
    expect(match.batters[1].history).toEqual([-50]);
    expect(match.striker).toBe(2);
    expect(match.nonStriker).toBe(0);
    expect(match.batters[2].confidence).toBe(50);
    expect(match.batters[2].history).toEqual([]);
    expect(match.batters[0].history).toEqual([50]);
  });

  it('replaces the sixth-ball wicket before changing ends', () => {
    const beforeSix = play(createMatch('blue', 'club', 1), Array.from({ length: 5 }, () => ball()));
    const { match, overChanged } = applyOutcome(beforeSix, wicket());
    expect(overChanged).toBe(true);
    expect(match.striker).toBe(1);
    expect(match.nonStriker).toBe(2);
    expect(match.batters[0].out).toBe(true);
    expect(match.nextBatter).toBe(3);
  });

  it('ends immediately at the third wicket without looking for a fifth batter', () => {
    const match = play(createMatch('blue', 'club', 1), [wicket(), wicket(), wicket()]);
    expect(match.complete).toBe(true);
    expect(match.won).toBe(false);
    expect(match.wickets).toBe(3);
    expect(match.balls).toBe(3);
    expect(match.nextBatter).toBe(4);
    expect(match.batters).toHaveLength(4);
    expect(applyOutcome(match, ball(6)).match).toBe(match);
  });

  it('ends at twelve legal deliveries below target', () => {
    const match = play(createMatch('blue', 'club', 1), Array.from({ length: 12 }, () => ball()));
    expect(match.complete).toBe(true);
    expect(match.won).toBe(false);
    expect(match.balls).toBe(12);
    expect(match.batters.reduce((sum, batter) => sum + batter.balls, 0)).toBe(12);
  });

  it('wins as soon as the target is reached, including an overshoot', () => {
    const match = play(createMatch('blue', 'beginner', 1), [ball(6), ball(6), ball(6)]);
    expect(match.complete).toBe(true);
    expect(match.won).toBe(true);
    expect(match.runs).toBe(18);
    expect(match.balls).toBe(3);
  });

  it('wins on the final legal ball when reaching the exact target', () => {
    const base = createMatch('blue', 'beginner', 1);
    const before = play(base, [ball(4), ball(4), ball(4), ...Array.from({ length: 8 }, () => ball())]);
    const { match } = applyOutcome(before, ball(4));
    expect(match.balls).toBe(12);
    expect(match.runs).toBe(16);
    expect(match.complete).toBe(true);
    expect(match.won).toBe(true);
  });

  it('flags each individual milestone once even across deliveries', () => {
    let match = { ...createMatch('blue', 'pro', 1), target: 100 };
    match = play(match, [ball(6), ball(6), ball(6), ball(6)]);
    const crossing = applyOutcome(match, ball(4));
    expect(crossing.milestone).toBe(true);
    expect(crossing.match.batters[0].milestones).toEqual([25]);
    const next = applyOutcome(crossing.match, ball(4));
    expect(next.milestone).toBe(false);
    expect(next.match.batters[0].milestones).toEqual([25]);
  });

  it('rejects contradictory outcomes instead of corrupting the score', () => {
    const match = createMatch('blue', 'club', 1);
    expect(() => applyOutcome(match, { ...wicket(), runs: 4 })).toThrow();
    expect(() => applyOutcome(match, ball(5))).toThrow();
    expect(() => applyOutcome(match, { ...wicket(), wicket: 'caught', shotType: 'ground' })).toThrow();
    expect(() => applyOutcome(match, ball(0, Number.NaN))).toThrow();
  });
});
