import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { CricketGame } from '../src/core/game';
import { selectStroke } from '../src/batting/batting';
import type { Delivery, Direction, Difficulty, ShotType } from '../src/core/types';

function advanceUntil(game: CricketGame, predicate: () => boolean, seconds = 400): void {
  for (let tick = 0; tick < seconds / CONFIG.step; tick++) {
    if (predicate()) return;
    game.advance(CONFIG.step);
  }
  throw new Error(`Game failed to reach condition; phase=${game.phase}, balls=${game.match?.balls}, time=${game.time}`);
}

function autoplay(seed: number, type: ShotType, difficulty: Difficulty = 'pro', direction: (delivery: Delivery) => Direction = () => 'straight') {
  const game = new CricketGame();
  game.start('blue', difficulty, seed);
  const contacts: Record<string, unknown>[] = [];
  let wasOutgoing = false;
  for (let tick = 0; tick < 600 / CONFIG.step; tick++) {
    if (game.phase === 'complete') return { game, contacts };
    if (game.phase === 'delivery' && !game.shot && game.delivery) {
      const intended = direction(game.delivery);
      const lead = CONFIG.lead[selectStroke(game.delivery, type, intended)];
      if (game.deliveryTime + 1e-10 >= game.delivery.arrival - lead) game.commit(type, intended);
    }
    game.advance(CONFIG.step);
    if (game.phase === 'outgoing' && !wasOutgoing && game.contactDebug) contacts.push({ ...game.contactDebug });
    wasOutgoing = game.phase === 'outgoing';
  }
  throw new Error(`Autoplay did not finish: phase=${game.phase}, balls=${game.match?.balls}`);
}

describe('headless delivery lifecycle', () => {
  it('resolves no-input deliveries naturally and completes a legal match', () => {
    const game = new CricketGame();
    game.start('yellow', 'club', 37);
    advanceUntil(game, () => game.phase === 'complete');
    expect(game.match!.complete).toBe(true);
    expect(game.match!.runs).toBe(0);
    expect(game.match!.won).toBe(false);
    expect(game.match!.balls === 12 || game.match!.wickets === 3).toBe(true);
    expect(game.match!.outcomes).toHaveLength(game.match!.balls);
    expect(game.match!.outcomes.every(outcome => outcome.quality === 'miss' && outcome.contribution === -50)).toBe(true);
    expect(game.match!.outcomes.every(outcome => !outcome.wicket || ['bowled', 'lbw'].includes(outcome.wicket))).toBe(true);
  });

  it('locks one commitment and rejects input outside the delivery phase', () => {
    const game = new CricketGame();
    expect(game.commit('loft', 'straight')).toBe(false);
    game.start('blue', 'club', 1);
    expect(game.commit('ground', 'cover')).toBe(false);
    advanceUntil(game, () => game.phase === 'delivery');
    expect(game.commit('ground', 'cover')).toBe(true);
    const locked = game.shot;
    expect(game.commit('loft', 'leg')).toBe(false);
    expect(game.shot).toBe(locked);
    expect(game.shot!.direction).toBe('cover');
    expect(game.shot!.type).toBe('ground');
    expect(game.inputLog).toHaveLength(1);
  });

  it('pauses simulation and clears accumulated hidden-tab time on resume', () => {
    const game = new CricketGame();
    game.start('blue', 'club', 1);
    game.advance(.5);
    const time = game.time;
    const phaseTime = game.phaseTime;
    game.togglePause();
    game.advance(60);
    expect(game.time).toBe(time);
    expect(game.phaseTime).toBe(phaseTime);
    game.togglePause();
    game.advance(CONFIG.step);
    expect(game.time).toBeCloseTo(time + CONFIG.step);
  });

  it('Space advancement cannot skip unresolved flight or change its result', () => {
    const game = new CricketGame();
    game.start('blue', 'club', 17);
    advanceUntil(game, () => game.phase === 'delivery');
    const before = JSON.stringify(game.ball);
    game.advancePresentation();
    expect(game.phase).toBe('delivery');
    expect(JSON.stringify(game.ball)).toBe(before);
    advanceUntil(game, () => game.phase === 'feedback');
    const result = JSON.stringify(game.outcome);
    game.advancePresentation();
    expect(JSON.stringify(game.outcome)).toBe(result);
    game.advance(CONFIG.step);
    expect(game.match!.balls).toBe(1);
  });

  it('starts a clean match after completion with no leaked score or confidence', () => {
    const game = new CricketGame();
    game.start('blue', 'beginner', 13);
    advanceUntil(game, () => game.phase === 'complete');
    game.start('yellow', 'pro', 13);
    expect(game.phase).toBe('runup');
    expect(game.match!.team).toBe('yellow');
    expect(game.match!.runs).toBe(0);
    expect(game.match!.balls).toBe(0);
    expect(game.match!.outcomes).toEqual([]);
    expect(game.match!.batters.every(batter => batter.confidence === 50 && batter.history.length === 0)).toBe(true);
    expect(game.inputLog).toEqual([]);
    expect(game.shot).toBeNull();
    expect(game.outcome).toBeNull();
  });
});

describe('animation/contact/physics integration', () => {
  it('wins early from correctly timed lofts through actual contact and boundary landings', () => {
    const { game, contacts } = autoplay(0, 'loft', 'beginner', d => d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight');
    expect(game.match!.won).toBe(true);
    expect(game.match!.complete).toBe(true);
    expect(game.match!.runs).toBeGreaterThanOrEqual(16);
    expect(game.match!.balls).toBeLessThan(12);
    expect(contacts).toHaveLength(game.match!.balls);
    expect(contacts.every(contact => contact.aerial === true)).toBe(true);
    expect(game.match!.outcomes.every(outcome => outcome.runs === 6 && !outcome.wicket)).toBe(true);
    expect(Math.hypot(game.ball!.position.x, game.ball!.position.z)).toBeGreaterThan(CONFIG.boundary);
    expect(game.ball!.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('completes the twelfth ball without requiring a shot or a third wicket', () => {
    const game = new CricketGame();
    game.start('blue', 'club', 12);
    advanceUntil(game, () => game.phase === 'complete');
    expect(game.match!.balls).toBe(12);
    expect(game.match!.wickets).toBeLessThan(3);
    expect(game.match!.outcomes).toHaveLength(12);
    expect(game.match!.won).toBe(false);
    expect(game.delivery!.style).toBe(game.match!.spinStyle);
  });

  it('stops on the third physical dismissal with no fifth-batter access', () => {
    const game = new CricketGame();
    game.start('blue', 'club', 14);
    advanceUntil(game, () => game.phase === 'complete');
    expect(game.match!.wickets).toBe(3);
    expect(game.match!.balls).toBe(3);
    expect(game.match!.batters).toHaveLength(4);
    expect(game.match!.nextBatter).toBe(4);
    expect(game.match!.outcomes.every(outcome => ['bowled', 'lbw'].includes(outcome.wicket ?? ''))).toBe(true);
    const snapshot = JSON.stringify(game.match);
    game.advance(60);
    expect(JSON.stringify(game.match)).toBe(snapshot);
    expect(game.commit('loft', 'straight')).toBe(false);
  });
  it('produces real contact and grounded results without catches', () => {
    const { game, contacts } = autoplay(4, 'ground', 'pro', d => d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight');
    expect(contacts.length).toBeGreaterThan(0);
    expect(game.match!.outcomes.every(outcome => outcome.wicket !== 'caught' && outcome.runs <= 4)).toBe(true);
    expect(game.match!.outcomes.some(outcome => outcome.runs > 0)).toBe(true);
    expect(game.match!.balls).toBeLessThanOrEqual(12);
    for (const contact of contacts) {
      expect(Math.abs(contact.timingError as number)).toBeLessThan(CONFIG.step + 1e-9);
      expect(contact.aerial).toBe(false);
      expect(Number.isFinite(contact.batSpeed)).toBe(true);
      expect((contact.point as { y: number }).y).toBeGreaterThanOrEqual(CONFIG.ballRadius);
    }
  });

  it('reproduces the full seeded match with the same simulation-time inputs', () => {
    const first = autoplay(23, 'loft', 'club');
    const second = autoplay(23, 'loft', 'club');
    expect(second.game.match).toEqual(first.game.match);
    expect(second.game.inputLog).toEqual(first.game.inputLog);
    expect(second.contacts).toEqual(first.contacts);
  });

  it('keeps timestamped shot outcomes identical at 30, 60, and 144 render FPS', () => {
    const baseline = new CricketGame();
    baseline.start('blue', 'pro', 4);
    const schedule: { tick: number; direction: Direction }[] = [];
    for (let tick = 0; tick < 600 / CONFIG.step && baseline.phase !== 'complete'; tick++) {
      if (baseline.phase === 'delivery' && !baseline.shot && baseline.delivery) {
        const d = baseline.delivery;
        const direction: Direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
        const inputAt = d.arrival - CONFIG.lead[selectStroke(d, 'ground', direction)];
        if (baseline.deliveryTime + 1e-10 >= inputAt) {
          schedule.push({ tick: Math.round(baseline.time / CONFIG.step), direction });
          baseline.commit('ground', direction);
        }
      }
      baseline.advance(CONFIG.step);
    }
    expect(baseline.phase).toBe('complete');
    expect(schedule.length).toBeGreaterThan(0);

    for (const fps of [30, 60, 144]) {
      const game = new CricketGame();
      game.start('blue', 'pro', 4);
      let elapsed = 0;
      let next = 0;
      for (let frame = 0; frame < fps * 600 && game.phase !== 'complete'; frame++) {
        let remaining = 1 / fps;
        // Deliver the same timestamped event even when it falls inside a render frame.
        while (remaining > 1e-10) {
          const eventTime = next < schedule.length ? schedule[next].tick * CONFIG.step : Infinity;
          const segment = Math.min(remaining, Math.max(0, eventTime - elapsed));
          if (segment > 1e-10) {
            game.advance(segment);
            elapsed += segment;
            remaining -= segment;
          }
          if (elapsed >= eventTime - 1e-10) {
            expect(game.commit('ground', schedule[next].direction)).toBe(true);
            next += 1;
          } else if (segment <= 1e-10) {
            game.advance(remaining);
            elapsed += remaining;
            remaining = 0;
          }
        }
      }
      expect(game.phase).toBe('complete');
      expect(game.match).toEqual(baseline.match);
      expect(game.inputLog).toEqual(baseline.inputLog);
    }
  });

  it('releases the struck ball at the actual collision point and uses pre-delivery confidence', () => {
    const game = new CricketGame();
    game.start('blue', 'beginner', 0);
    advanceUntil(game, () => game.phase === 'delivery');
    const d = game.delivery!;
    const direction: Direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
    const inputAt = d.arrival - CONFIG.lead[selectStroke(d, 'loft', direction)];
    advanceUntil(game, () => game.deliveryTime >= inputAt);
    const confidence = game.match!.batters[game.match!.striker].confidence;
    expect(game.ball!.velocity.z).toBeLessThan(0);
    expect(game.commit('loft', direction)).toBe(true);
    advanceUntil(game, () => game.phase === 'outgoing');
    expect(game.contactDebug).not.toBeNull();
    expect(game.contactDebug!.point).toEqual(game.ball!.position);
    expect(game.contactDebug!.confidence).toBe(confidence);
    expect(game.match!.balls).toBe(0);
    expect(game.ball!.velocity.z).toBeGreaterThan(0);
    expect(game.ball!.velocity.y).toBeGreaterThan(0);
    const atContact = { ...game.ball!.position };
    game.advance(CONFIG.step);
    expect(game.ball!.position.z).toBeGreaterThan(atContact.z);
    expect(game.ball!.position.y).toBeGreaterThan(atContact.y);
    advanceUntil(game, () => game.phase === 'feedback');
    expect(game.match!.balls).toBe(1);
    expect(game.outcome!.runs).toBe(6);
    expect(game.match!.batters[0].confidence).toBeGreaterThan(confidence);
  });

  it('keeps no-input outcomes identical across render frequencies', () => {
    const run = (elapsed: number) => {
      const game = new CricketGame();
      game.start('blue', 'club', 7);
      for (let frame = 0; frame < 100000 && game.phase !== 'complete'; frame++) game.advance(elapsed);
      expect(game.phase).toBe('complete');
      return game.match;
    };
    expect(run(1 / 30)).toEqual(run(1 / 144));
    expect(run(.17)).toEqual(run(1 / 60));
  });

  it('handles a large render delay without dropping the unresolved delivery', () => {
    const slow = new CricketGame();
    const regular = new CricketGame();
    slow.start('blue', 'club', 11);
    regular.start('blue', 'club', 11);
    slow.advance(3);
    // The per-frame step budget keeps its remaining time for future frames.
    slow.advance(0);
    slow.advance(0);
    for (let i = 0; i < 360; i++) regular.advance(CONFIG.step);
    expect(slow.time).toBeCloseTo(regular.time);
    expect(slow.phase).toBe(regular.phase);
    expect(slow.match).toEqual(regular.match);
    expect(slow.ball).toEqual(regular.ball);
  });

  it('keeps the marker truthful and unavailable before its configured reveal time', () => {
    const game = new CricketGame();
    game.start('blue', 'club', 19);
    advanceUntil(game, () => game.phase === 'delivery');
    expect(game.frame().marker).toBe(0);
    const d = game.delivery!;
    const bounce = { ...d.bounce };
    advanceUntil(game, () => game.deliveryTime > d.arrival * CONFIG.difficulty.club.marker);
    expect(game.frame().marker).toBeGreaterThan(0);
    expect(game.delivery!.bounce).toEqual(bounce);
    advanceUntil(game, () => Boolean(game.ball?.bounced));
    expect(game.frame().marker).toBe(0);
  });
});
