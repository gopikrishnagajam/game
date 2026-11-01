import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { CricketGame } from '../src/core/game';
import { selectStroke } from '../src/batting/batting';
import type { Difficulty, Direction } from '../src/core/types';

const difficulties: Difficulty[] = ['beginner', 'club', 'pro'];
type Input = { time: number; direction: Direction };

function recordMatch(difficulty: Difficulty, bat: boolean) {
  const game = new CricketGame();
  game.start('yellow', difficulty, 12);
  const inputs: Input[] = [];
  for (let tick = 0; tick < 120 * 300 && game.phase !== 'complete'; tick++) {
    if (bat && game.phase === 'delivery' && !game.shot && game.delivery) {
      const d = game.delivery;
      const direction: Direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
      const ideal = d.arrival - CONFIG.lead[selectStroke(d, 'ground', direction)];
      if (game.deliveryTime + 1e-10 >= ideal) {
        inputs.push({ time: game.time, direction });
        expect(game.commit('ground', direction)).toBe(true);
      }
    }
    game.advance(CONFIG.step);
  }
  expect(game.phase).toBe('complete');
  return { game, inputs };
}

describe('v0.3 gameplay clock', () => {
  it.each(difficulties)('scales %s wall time once without changing fixed-step trajectory or release', difficulty => {
    const scaled = new CricketGame(), simulation = new CricketGame();
    scaled.start('blue', difficulty, 0);
    simulation.start('blue', difficulty, 0);
    const scale = CONFIG.difficulty[difficulty].timeScale;
    expect(scaled.timeScale).toBe(scale);
    for (let frame = 0; frame < 240; frame++) {
      scaled.advanceRealTime(1 / 60);
      simulation.advance(scale / 60);
      expect(scaled.time).toBe(simulation.time);
      expect(scaled.phase).toBe(simulation.phase);
      expect(scaled.phaseTime).toBe(simulation.phaseTime);
      expect(scaled.ball).toEqual(simulation.ball);
      expect(scaled.delivery).toEqual(simulation.delivery);
      expect(scaled.frame().marker).toBe(simulation.frame().marker);
    }
    expect(scaled.time).toBeCloseTo(4 * scale, 8);
  });

  it.each(difficulties)('does not accumulate hidden wall time while %s is paused', difficulty => {
    const game = new CricketGame();
    game.start('blue', difficulty, 1);
    game.advanceRealTime(.5);
    game.togglePause();
    const before = game.time;
    game.advanceRealTime(60);
    expect(game.time).toBe(before);
    game.togglePause();
    game.advanceRealTime(CONFIG.step / game.timeScale);
    expect(game.time).toBeCloseTo(before + CONFIG.step, 10);
  });

  it.each(difficulties)('preserves %s collision and scoring events after a long frame', difficulty => {
    const delayed = new CricketGame(), regular = new CricketGame();
    delayed.start('blue', difficulty, 11);
    regular.start('blue', difficulty, 11);
    delayed.advanceRealTime(6);
    for (let i = 0; i < 6; i++) delayed.advanceRealTime(0);
    for (let i = 0; i < 360; i++) regular.advanceRealTime(1 / 60);
    expect(delayed.time).toBe(regular.time);
    expect(delayed.ball).toEqual(regular.ball);
    expect(delayed.match).toEqual(regular.match);
    expect(delayed.phase).toBe(regular.phase);
  });

  for (const bat of [false, true]) {
    it.each(difficulties)(`keeps a complete %s ${bat ? 'batted' : 'no-input'} match identical at 30/60/144 FPS`, difficulty => {
      const baseline = recordMatch(difficulty, bat);
      for (const fps of [30, 60, 144]) {
        const game = new CricketGame();
        game.start('yellow', difficulty, 12);
        let elapsed = 0, next = 0;
        for (let frame = 0; frame < fps * 600 && game.phase !== 'complete'; frame++) {
          let remaining = 1 / fps;
          // Real key timestamps can divide a rendered frame. Apply the clock
          // adapter to each segment exactly as the browser does before input.
          while (remaining > 1e-10) {
            const eventTime = next < baseline.inputs.length ? baseline.inputs[next].time / game.timeScale : Infinity;
            const segment = Math.min(remaining, Math.max(0, eventTime - elapsed));
            if (segment > 1e-10) {
              game.advanceRealTime(segment);
              elapsed += segment;
              remaining -= segment;
            }
            if (elapsed >= eventTime - 1e-10) {
              expect(game.commit('ground', baseline.inputs[next].direction)).toBe(true);
              next++;
            } else if (segment <= 1e-10) {
              game.advanceRealTime(remaining);
              elapsed += remaining;
              remaining = 0;
            }
          }
        }
        expect(game.phase).toBe('complete');
        expect(next).toBe(baseline.inputs.length);
        expect(game.match).toEqual(baseline.game.match);
        expect(game.inputLog).toEqual(baseline.game.inputLog);
      }
    });
  }
});
