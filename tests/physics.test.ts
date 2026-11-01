import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { RNG, copy, vec } from '../src/core/math';
import { generateDelivery } from '../src/bowling/bowling';
import { createMatch } from '../src/match/match';
import { createBall, predictDelivery, stepBall } from '../src/physics/ball';
import type { Ball, Delivery, Style } from '../src/core/types';

function delivery(style: Style, seed = 123): Delivery {
  const match = createMatch('blue', 'club', seed);
  match.balls = style === 'fast' || style === 'medium' ? 0 : 6;
  match.paceStyle = style;
  match.spinStyle = style;
  return generateDelivery(match, new RNG(seed));
}

describe('incoming physical trajectories', () => {
  it('reproduces actual bounce and contact predictions for every archetype', () => {
    for (const style of ['fast', 'medium', 'offSpin', 'legSpin'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const d = delivery(style, seed);
        const prediction = predictDelivery(d);
        expect(prediction.bounce).toEqual(d.bounce);
        expect(prediction.contact).toEqual(d.contact);
        expect(prediction.arrival).toBe(d.arrival);
        expect(d.bounce.z).toBeGreaterThan(0.4);
        expect(d.bounce.z).toBeLessThan(11);
        expect(Math.abs(d.contact.x)).toBeLessThan(0.8);
        expect(d.contact.y).toBeGreaterThanOrEqual(CONFIG.ballRadius);
        expect(d.contact.y).toBeLessThan(2.2);
        expect(d.arrival).toBeGreaterThan(0.35);
        expect(d.arrival).toBeLessThan(1.3);
      }
    }
  });

  it('has actual three-dimensional spin turn only after pitching', () => {
    for (const [style, sign] of [['offSpin', 1], ['legSpin', -1]] as const) {
      const d = delivery(style);
      const stock = { ...d, turn: sign * 2, swing: 0 };
      const ball = createBall(stock);
      let beforeX = ball.velocity.x;
      let afterX = beforeX;
      for (let i = 0; i < 200; i++) {
        beforeX = ball.velocity.x;
        const result = stepBall(ball, CONFIG.step, stock);
        if (result.bounced) { afterX = ball.velocity.x; break; }
      }
      expect((afterX - beforeX * 0.94) * sign).toBeGreaterThan(1.9);
    }
  });

  it('does not tunnel through the pitch with a large frame interval', () => {
    const d = delivery('fast');
    const ball = createBall(d);
    const result = stepBall(ball, d.arrival, d);
    expect(result.bounced).toBe(true);
    expect(result.landing?.y).toBe(CONFIG.ballRadius);
    expect(result.landing?.z).toBeCloseTo(d.bounce.z, 6);
    expect(ball.position.y).toBeGreaterThanOrEqual(CONFIG.ballRadius);
  });

  it('is independent of subdivision for air flight before a bounce', () => {
    const d = delivery('medium');
    const a = createBall(d);
    const b = createBall(d);
    stepBall(a, 0.15, d);
    for (let i = 0; i < 18; i++) stepBall(b, CONFIG.step, d);
    expect(a.position.x).toBeCloseTo(b.position.x, 9);
    expect(a.position.y).toBeCloseTo(b.position.y, 9);
    expect(a.position.z).toBeCloseTo(b.position.z, 9);
  });
});

describe('outgoing flight and rolling', () => {
  it('reports the actual first landing rather than its projection at release', () => {
    const ball: Ball = { position: vec(0, 1, 0), velocity: vec(12, 12, 15), bounced: false };
    let landing = null;
    for (let i = 0; i < 600; i++) {
      const result = stepBall(ball, CONFIG.step, null, true);
      if (result.landing) { landing = result.landing; break; }
    }
    expect(landing).not.toBeNull();
    expect(landing!.x).toBeGreaterThan(25);
    expect(landing!.z).toBeGreaterThan(30);
    expect(landing!.y).toBe(CONFIG.ballRadius);
  });

  it('slows a ground ball to a finite physical stop with no backwards drift', () => {
    const ball: Ball = { position: vec(0, CONFIG.ballRadius, 0), velocity: vec(0, 0, 8), bounced: true };
    let previous = copy(ball.position);
    for (let i = 0; i < 500; i++) {
      stepBall(ball, CONFIG.step, null, true);
      expect(ball.position.z).toBeGreaterThanOrEqual(previous.z);
      previous = copy(ball.position);
    }
    expect(ball.velocity.z).toBe(0);
    expect(ball.position.z).toBeCloseTo(8 * 8 / (2 * CONFIG.rollingFriction), 7);
    expect(ball.position.y).toBe(CONFIG.ballRadius);
  });
});
