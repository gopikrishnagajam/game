import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { RNG, vec } from '../src/core/math';
import type { BatPose, Delivery, Direction, ShotType } from '../src/core/types';
import { resolveDirection } from '../src/input/input';
import { createShot, directionAngle, launchVelocity, selectStroke, shotSuitability, sweptBatContact, timingEvaluation } from '../src/batting/batting';

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: 0, style: 'fast', bowler: 'Test bowler', length: 'full', variation: 'Stock',
    speed: 38, release: vec(.2, 2.1, 18), velocity: vec(0, -2, -38), swing: 0, turn: 0,
    restitution: .6, bounce: vec(0, CONFIG.ballRadius, 3), arrival: .5,
    contact: vec(0, .5, CONFIG.contactZ), field: [], fieldName: 'balanced', strategy: 'normal',
    ...overrides,
  };
}

describe('eight-direction control contract', () => {
  it.each([
    [['ArrowUp'], 'straight'], [['ArrowUp', 'ArrowLeft'], 'longOn'],
    [['ArrowUp', 'ArrowRight'], 'cover'], [['ArrowLeft'], 'leg'],
    [['ArrowRight'], 'point'], [['ArrowDown', 'ArrowLeft'], 'fineLeg'],
    [['ArrowDown', 'ArrowRight'], 'thirdMan'], [['ArrowDown'], 'late'],
  ] as [string[], Direction][])('maps %j to %s', (keys, expected) => {
    expect(resolveDirection(new Set(keys))).toBe(expected);
  });

  it('retains a tapped selection and cancels opposite axes predictably', () => {
    expect(resolveDirection(new Set(), 'cover')).toBe('cover');
    expect(resolveDirection(new Set(['ArrowLeft', 'ArrowRight']), 'fineLeg')).toBe('fineLeg');
    expect(resolveDirection(new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp']), 'leg')).toBe('straight');
    expect(resolveDirection(new Set(['ArrowUp', 'ArrowDown', 'ArrowRight']))).toBe('point');
    expect(resolveDirection(new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']), 'leg')).toBe('leg');
  });

  it('uses distinct directional regions and chooses the late side from actual line', () => {
    const ordinary: Direction[] = ['straight', 'longOn', 'cover', 'leg', 'point', 'fineLeg', 'thirdMan'];
    expect(new Set(ordinary.map(direction => directionAngle(direction))).size).toBe(7);
    expect(directionAngle('cover')).toBeLessThan(0);
    expect(directionAngle('longOn')).toBeGreaterThan(0);
    expect(directionAngle('late', -.3)).toBeLessThan(0);
    expect(directionAngle('late', .3)).toBeGreaterThan(0);
  });
});

describe('delivery-assisted stroke selection', () => {
  it('chooses drives by line and selected region', () => {
    expect(selectStroke(delivery({ contact: vec(-.3, .4, .36) }), 'ground', 'cover')).toBe('coverDrive');
    expect(selectStroke(delivery(), 'ground', 'straight')).toBe('straightDrive');
    expect(selectStroke(delivery({ contact: vec(.3, .4, .36) }), 'ground', 'longOn')).toBe('onDrive');
  });

  it('distinguishes short-ball cut, pull, back-foot and late strokes', () => {
    const short = delivery({ length: 'short', contact: vec(-.2, 1.1, .36) });
    expect(selectStroke(short, 'ground', 'point')).toBe('cut');
    expect(selectStroke(short, 'ground', 'leg')).toBe('pull');
    expect(selectStroke(short, 'ground', 'straight')).toBe('backPunch');
    expect(selectStroke(short, 'ground', 'thirdMan')).toBe('lateCut');
  });

  it('selects front/back defenses and ducks high bouncers', () => {
    expect(selectStroke(delivery({ length: 'yorker', contact: vec(0, .08, .36) }), 'defend', 'straight')).toBe('forwardDefense');
    expect(selectStroke(delivery({ length: 'short', contact: vec(0, 1.2, .36) }), 'defend', 'straight')).toBe('backDefense');
    expect(selectStroke(delivery({ length: 'bouncer', contact: vec(0, 1.8, .36) }), 'defend', 'straight')).toBe('duck');
  });

  it('separates ground and loft animation families', () => {
    expect(selectStroke(delivery(), 'ground', 'straight')).toBe('straightDrive');
    expect(selectStroke(delivery(), 'loft', 'straight')).toBe('loftStraight');
    expect(selectStroke(delivery(), 'loft', 'cover')).toBe('loftDrive');
  });

  it('makes an across-line yorker loft less suitable without granting an automatic hit', () => {
    const yorker = delivery({ length: 'yorker', contact: vec(-.6, .1, .36) });
    expect(shotSuitability(yorker, 'leg', 'loft')).toBeLessThan(shotSuitability(yorker, 'cover', 'ground'));
    const shot = createShot(yorker, 'loft', 'leg', .2);
    expect(shot.suitability).toBeLessThan(1);
    expect(shot.target.x).not.toBe(yorker.contact.x);
  });
});

describe('fixed timing windows', () => {
  it.each(['defend', 'ground', 'loft'] as ShotType[])('classifies the %s thresholds inclusively and symmetrically', type => {
    const w = CONFIG.timing[type];
    for (const sign of [-1, 1]) {
      expect(timingEvaluation(type, sign * w.perfect).quality).toBe('perfect');
      expect(timingEvaluation(type, sign * (w.perfect + 1e-6)).quality).toBe('good');
      expect(timingEvaluation(type, sign * w.good).quality).toBe('good');
      expect(timingEvaluation(type, sign * (w.good + 1e-6)).quality).toBe('mistimed');
      expect(timingEvaluation(type, sign * w.outer).quality).toBe('mistimed');
      expect(timingEvaluation(type, sign * (w.outer + 1e-6)).quality).toBe('miss');
    }
    expect(timingEvaluation(type, 0)).toEqual({ quality: 'perfect', raw: 1, contribution: 50 });
  });

  it('uses animation lead time rather than treating keydown as ball contact', () => {
    const d = delivery();
    const ideal = d.arrival - CONFIG.lead.straightDrive;
    const shot = createShot(d, 'ground', 'straight', ideal);
    expect(shot.committedAt).toBe(ideal);
    expect(shot.contactAt).toBeCloseTo(d.arrival);
    expect(shot.timingError).toBeCloseTo(0);
    expect(shot.quality).toBe('perfect');
    expect(createShot(d, 'ground', 'straight', d.arrival).quality).toBe('miss');
  });

  it('does not mutate the incoming delivery while choosing target geometry', () => {
    const d = delivery();
    const before = JSON.stringify(d);
    createShot(d, 'loft', 'fineLeg', .1);
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('swept physical bat contact', () => {
  const stationary: BatPose = { heel: vec(0, .85, 0), toe: vec(0, .15, 0), face: vec(0, 0, 1) };

  it('detects a high-speed ball crossing the blade between fixed steps', () => {
    const collision = sweptBatContact(vec(0, .5, .3), vec(0, .5, -.3), stationary, stationary);
    expect(collision).not.toBeNull();
    expect(collision!.t).toBeGreaterThan(0);
    expect(collision!.t).toBeLessThan(1);
    expect(collision!.point.z).toBeGreaterThan(0);
    expect(collision!.offset).toBeCloseTo(0);
  });

  it('misses balls beyond blade width or length even at ideal input timing', () => {
    expect(sweptBatContact(vec(.2, .5, .3), vec(.2, .5, -.3), stationary, stationary)).toBeNull();
    expect(sweptBatContact(vec(0, 1.1, .3), vec(0, 1.1, -.3), stationary, stationary)).toBeNull();
  });

  it('detects a moving blade sweeping into a nearly stationary ball', () => {
    const left: BatPose = { heel: vec(-.2, .85, 0), toe: vec(-.2, .15, 0), face: vec(0, 0, 1) };
    const right: BatPose = { heel: vec(.2, .85, 0), toe: vec(.2, .15, 0), face: vec(0, 0, 1) };
    expect(sweptBatContact(vec(0, .5, .01), vec(0, .5, 0), left, right)).not.toBeNull();
  });
});

describe('contact-driven launch', () => {
  it('launches clean lofts more strongly than marginal contact and converts failed lofts to ground behavior', () => {
    const d = delivery();
    const clean = createShot(d, 'loft', 'straight', d.arrival - CONFIG.lead.loftStraight);
    const weak = { ...clean, raw: .2, quality: 'mistimed' as const };
    const incoming = vec(0, 1, -38);
    const cleanLaunch = launchVelocity(clean, incoming, 50, 0, 7, new RNG(1));
    const weakLaunch = launchVelocity(weak, incoming, 50, 0, 7, new RNG(1));
    expect(cleanLaunch.aerial).toBe(true);
    expect(weakLaunch.aerial).toBe(false);
    expect(cleanLaunch.velocity.y).toBeGreaterThan(weakLaunch.velocity.y * 5);
    expect(Math.hypot(cleanLaunch.velocity.x, cleanLaunch.velocity.y, cleanLaunch.velocity.z))
      .toBeGreaterThan(Math.hypot(weakLaunch.velocity.x, weakLaunch.velocity.y, weakLaunch.velocity.z));
  });

  it('never makes S contact catchable, including high quality contact', () => {
    const d = delivery();
    const shot = createShot(d, 'ground', 'straight', d.arrival - CONFIG.lead.straightDrive);
    for (const confidence of [0, 50, 100]) {
      expect(launchVelocity(shot, vec(0, 0, -40), confidence, 0, 10, new RNG(1)).aerial).toBe(false);
    }
  });

  it('keeps successful defense controlled and perfect shots possible at zero confidence', () => {
    const d = delivery();
    const defend = createShot(d, 'defend', 'straight', d.arrival - CONFIG.lead.forwardDefense);
    const grounded = createShot(d, 'ground', 'straight', d.arrival - CONFIG.lead.straightDrive);
    const slow = launchVelocity(defend, vec(0, 0, -38), 50, 0, 5, new RNG(1));
    const strong = launchVelocity(grounded, vec(0, 0, -38), 0, 0, 5, new RNG(1));
    expect(Math.hypot(slow.velocity.x, slow.velocity.z)).toBeLessThan(5);
    expect(Math.hypot(strong.velocity.x, strong.velocity.z)).toBeGreaterThan(30);
    expect(strong.raw).toBe(1);
  });

  it('reproduces contact deviation for the same seed', () => {
    const d = delivery();
    const shot = createShot(d, 'loft', 'cover', d.arrival - CONFIG.lead.loftDrive + .09);
    expect(launchVelocity(shot, vec(0, 0, -38), 40, .2, 5, new RNG(89)))
      .toEqual(launchVelocity(shot, vec(0, 0, -38), 40, .2, 5, new RNG(89)));
  });
});
