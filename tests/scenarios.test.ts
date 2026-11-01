import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { CricketGame } from '../src/core/game';
import { selectStroke } from '../src/batting/batting';
import type { Delivery, Direction, Difficulty, ShotType } from '../src/core/types';

/** Only sends real shot inputs. Earlier balls play naturally without input. */
function play(seed: number, type: ShotType, direction: Direction, offset: number, ball = 0, difficulty: Difficulty = 'club') {
  const game = new CricketGame();
  game.start('blue', difficulty, seed);
  let delivered: Delivery | null = null;
  let contacted: Record<string, unknown> | null = null;
  let faced = -1;
  let confidence = 0;
  let commitment = '';
  for (let tick = 0; tick < 120 * 90; tick++) {
    if (game.match!.balls > ball) return { game, delivery: delivered!, contact: contacted, outcome: game.outcome!, faced, confidence, commitment };
    if (game.phase === 'complete') throw new Error(`Seed ${seed} ended before scenario ball ${ball + 1}`);
    if (game.match!.balls === ball && game.phase === 'delivery' && !game.shot) {
      delivered = game.delivery!;
      const lead = CONFIG.lead[selectStroke(delivered, type, direction)];
      if (game.deliveryTime + 1e-10 >= delivered.arrival - lead + offset) {
        faced = game.match!.striker;
        confidence = game.match!.batters[faced].confidence;
        commitment = JSON.stringify(delivered);
        if (!game.commit(type, direction)) throw new Error('Scenario input was unexpectedly rejected');
      }
    }
    game.advance(CONFIG.step);
    if (game.phase === 'outgoing' && game.contactDebug) contacted = { ...game.contactDebug };
  }
  throw new Error(`Seed ${seed} did not resolve scenario ball ${ball + 1}`);
}

function landsInCatchCircle(scenario: ReturnType<typeof play>) {
  const landing = scenario.game.ball!.position;
  return scenario.delivery.field.some(fielder =>
    Math.hypot(landing.x - fielder.x, landing.z - fielder.z) <= fielder.catchRadius + CONFIG.fielding.epsilon,
  );
}

describe('physical seeded gameplay scenarios', () => {
  it('defends an actual turning off-break and earns raw execution confidence on a dot', () => {
    // Six naturally resolved balls reach the spin over; no state or delivery is injected.
    const scenario = play(23, 'defend', 'straight', 0, 6);
    expect(scenario.delivery.style).toBe('offSpin');
    expect(scenario.delivery.variation).toBe('Off-break');
    expect(scenario.delivery.turn).toBeGreaterThan(0);
    expect(scenario.contact).not.toBeNull();
    expect(scenario.contact!.aerial).toBe(false);
    expect(scenario.contact!.confidence).toBe(scenario.confidence);
    expect(Math.abs(scenario.outcome.timingError!)).toBeLessThan(CONFIG.step);
    expect(scenario.outcome).toMatchObject({ runs: 0, quality: 'perfect', contribution: 10 });
    expect(scenario.outcome.wicket).toBeUndefined();
    expect(scenario.confidence).toBe(50);
    expect(scenario.game.match!.batters[scenario.faced].confidence).toBeCloseTo(53.33333333);
    expect(scenario.game.match!.balls).toBe(7);
    expect(JSON.stringify(scenario.delivery)).toBe(scenario.commitment);
  });

  it('lets unsuitable defense miss a real off-break and hit stumps without an automatic direction rule', () => {
    const safe = play(66, 'defend', 'straight', 0, 6);
    const failed = play(66, 'defend', 'fineLeg', 0, 6);
    expect(failed.delivery).toEqual(safe.delivery);
    expect(failed.contact).toBeNull();
    expect(failed.game.shot!.suitability).toBeLessThan(safe.game.shot!.suitability);
    expect(failed.outcome).toMatchObject({ runs: 0, wicket: 'bowled', quality: 'miss', contribution: -50 });
    const position = failed.game.ball!.position;
    // A turning ball can enter the wicket envelope through a side edge.
    expect(Math.abs(position.z-CONFIG.stump.z)).toBeLessThanOrEqual(CONFIG.ballRadius+1e-9);
    expect(Math.abs(position.x)).toBeLessThanOrEqual(CONFIG.stump.halfWidth + CONFIG.ballRadius);
    expect(position.y).toBeLessThan(CONFIG.stump.height + CONFIG.ballRadius);
    expect(failed.game.match!.batters[failed.faced].out).toBe(true);
    // The same leg-side defensive direction can succeed against a different off-break.
    const other = play(1, 'defend', 'fineLeg', 0, 6);
    expect(other.delivery.style).toBe('offSpin');
    expect(other.delivery.turn).toBeGreaterThan(0);
    expect(other.contact).not.toBeNull();
    expect(other.outcome.wicket).toBeUndefined();
    expect(other.outcome.contribution).toBe(10);
  });

  it('catches a deliberately mistimed physical loft at its first landing inside a fixed catch circle', () => {
    const scenario = play(6, 'loft', 'cover', CONFIG.timing.loft.good + 0.035);
    expect(scenario.contact).not.toBeNull();
    expect(scenario.contact!.aerial).toBe(true);
    expect(scenario.outcome.quality).toBe('mistimed');
    expect(scenario.outcome.timingError).toBeGreaterThan(CONFIG.timing.loft.good);
    expect(landsInCatchCircle(scenario)).toBe(true);
    expect(Math.hypot(scenario.game.ball!.position.x, scenario.game.ball!.position.z)).toBeLessThan(CONFIG.boundary);
    expect(scenario.game.ball!.position.y).toBe(CONFIG.ballRadius);
    expect(scenario.outcome).toMatchObject({ runs: 0, wicket: 'caught' });
    expect(scenario.game.match!.runs).toBe(0);
    expect(scenario.game.match!.wickets).toBe(1);
    expect(scenario.game.match!.balls).toBe(1);
    expect(scenario.game.match!.outcomes).toHaveLength(1);
    expect(scenario.game.match!.batters[scenario.faced].out).toBe(true);
    expect(JSON.stringify(scenario.delivery)).toBe(scenario.commitment);
  });

  it('drops an eligible seeded loft and awards its actual interior first-landing four', () => {
    const scenario = play(256, 'loft', 'cover', CONFIG.timing.loft.good + 0.015);
    expect(scenario.contact!.aerial).toBe(true);
    expect(scenario.outcome.quality).toBe('mistimed');
    expect(landsInCatchCircle(scenario)).toBe(true);
    const distance = Math.hypot(scenario.game.ball!.position.x, scenario.game.ball!.position.z);
    expect(distance).toBeGreaterThanOrEqual(CONFIG.rings[3]);
    expect(distance).toBeLessThan(CONFIG.boundary);
    expect(scenario.outcome).toMatchObject({ runs: 4, dropped: true });
    expect(scenario.outcome.wicket).toBeUndefined();
    expect(scenario.game.match!.wickets).toBe(0);
    expect(scenario.game.match!.batters[scenario.faced].runs).toBe(4);
    expect(scenario.game.match!.batters[scenario.faced].out).toBe(false);
    expect(scenario.game.ball!.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(JSON.stringify(scenario.delivery)).toBe(scenario.commitment);
  });

  it('classifies a failed D attempt by actual weak contact and resolves ground movement without a catch', () => {
    const scenario = play(0, 'loft', 'point', -CONFIG.timing.loft.good - 0.015);
    expect(scenario.game.shot!.type).toBe('loft');
    expect(scenario.contact).not.toBeNull();
    expect(scenario.contact!.raw as number).toBeLessThan(CONFIG.batting.launch.aerialQualityThreshold);
    expect(scenario.contact!.aerial).toBe(false);
    expect(scenario.game.ball!.bounced).toBe(true);
    expect(scenario.game.ball!.position.y).toBe(CONFIG.ballRadius);
    expect(scenario.outcome).toMatchObject({ runs: 1, quality: 'mistimed' });
    expect(scenario.outcome.wicket).toBeUndefined();
    expect(scenario.outcome.dropped).toBeUndefined();
    expect(scenario.game.match!.balls).toBe(1);
    expect(scenario.game.match!.runs).toBe(1);
    expect(scenario.game.ball!.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });
});
