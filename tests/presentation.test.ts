import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { BallTrail, followCameraTarget, PRESENTATION, smoothApproach, visualBallScale } from '../src/rendering/presentation';

describe('render-only ball visibility', () => {
  it('keeps the release ball readable with a bounded visual enlargement', () => {
    const distance = 26, height = 900, fov = CONFIG.camera.fov;
    const scale = visualBallScale(distance, height, fov);
    const diameterPixels = CONFIG.ballRadius * scale * height / (distance * Math.tan(fov * Math.PI / 360));
    expect(diameterPixels).toBeGreaterThanOrEqual(PRESENTATION.ball.minimumDiameterPixels - 1e-8);
    expect(scale).toBeGreaterThan(1);
    expect(visualBallScale(1000, height, fov)).toBe(PRESENTATION.ball.maxScale);
    expect(visualBallScale(1, height, fov)).toBe(PRESENTATION.ball.scale);
    expect(CONFIG.ballRadius).toBe(.036);
  });

  it('draws only historical observed segments and expires old samples', () => {
    const trail = new BallTrail();
    const points = [0, 1, 2, 3].map(x => Object.freeze({ x, y: x * .2, z: 18 - x }));
    points.forEach((point, i) => trail.update(point, i * .04));
    const count = trail.update(points[3], .12);
    expect(count).toBe(4);
    const xs = Array.from({ length: count }, (_, i) => trail.positions[i * 3]);
    expect(xs).toEqual([3, 2, 2, 1]);
    expect(xs).not.toContain(0);
    // A long gap cannot create a line from an old delivery to a new position.
    expect(trail.update({ x: 25, y: 3, z: 40 }, 5)).toBe(0);
  });

  it('does not extend a paused trail and resets between deliveries', () => {
    const trail = new BallTrail();
    trail.update({ x: 0, y: 1, z: 18 }, 0);
    const count = trail.update({ x: 0, y: .9, z: 17 }, .01);
    const before = trail.positions.slice(0, count * 3);
    expect(trail.update({ x: 99, y: 99, z: 99 }, .01)).toBe(count);
    expect(trail.positions.slice(0, count * 3)).toEqual(before);
    trail.reset();
    expect(trail.update({ x: 0, y: 2, z: 18 }, 0)).toBe(0);
  });
});

describe('outgoing camera presentation', () => {
  it('bounds tracking to a small forward pan and leaves the live ball untouched', () => {
    const ball = Object.freeze({ x: -200, y: 100, z: -40 });
    const target = followCameraTarget(ball, { x: 0, y: 0, z: 0 });
    const c = CONFIG.camera;
    const yaw = Math.atan2(target.x - c.x, target.z - c.z);
    const pitch = Math.atan2(target.y - c.y, Math.hypot(target.x - c.x, target.z - c.z));
    expect(Math.abs(yaw)).toBeLessThanOrEqual(PRESENTATION.camera.maxYaw + 1e-10);
    expect(pitch).toBeLessThanOrEqual(PRESENTATION.camera.maxPitch + 1e-10);
    expect(target.z).toBeGreaterThan(c.z);
    expect(ball).toEqual({ x: -200, y: 100, z: -40 });
  });

  it('smooths by elapsed simulation time rather than rendered frame count', () => {
    const advance = (hz: number) => {
      let value = 0;
      for (let frame = 0; frame < hz; frame++) value = smoothApproach(value, 8, 1 / hz);
      return value;
    };
    expect(advance(30)).toBeCloseTo(advance(144), 10);
    expect(advance(60)).toBeCloseTo(smoothApproach(0, 8, 1), 10);
    expect(smoothApproach(2, 8, 0)).toBe(2);
  });
});
