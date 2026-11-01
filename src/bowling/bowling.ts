import { CONFIG } from '../core/config';
import { RNG, vec } from '../core/math';
import type { Delivery, Fielder, Length, Match, Style } from '../core/types';
import { predictDelivery } from '../physics/ball';

// Camera looks from -Z: negative X is the right-handed batter's off side.
const PRESETS = CONFIG.fielding.presets;

export function fieldPreset(name: string): Fielder[] {
  return (PRESETS[name as keyof typeof PRESETS] ?? PRESETS.balanced).map(([x, z], index) => ({
    id: `${name}-${index}`,
    x, z,
    catchRadius: CONFIG.fielderCatchRadius,
    groundRadius: CONFIG.fielderGroundRadius,
  }));
}

function chooseStrategy(match: Match, rng: RNG): Delivery['strategy'] {
  const weights = CONFIG.difficulty[match.difficulty].weights;
  const draw = rng.next();
  return draw < weights[0] ? 'normal' : draw < weights[0] + weights[1] ? 'tactical' : 'surprise';
}

function verticalVelocity(releaseY: number, horizontal: number, bounceZ: number): number {
  const drag = CONFIG.airDrag;
  const distance = CONFIG.bowling.release.z - bounceZ;
  const time = -Math.log(1 - drag * distance / horizontal) / drag;
  const integral = -Math.expm1(-drag * time) / drag;
  return (CONFIG.ballRadius - releaseY + CONFIG.gravity * (time - integral) / drag) / integral;
}

function launchVelocity(speed: number, releaseY: number, bounceZ: number) {
  let lo = speed * 0.50;
  let hi = speed;
  for (let i = 0; i < 40; i++) {
    const horizontal = (lo + hi) / 2;
    const vertical = verticalVelocity(releaseY, horizontal, bounceZ);
    if (Math.hypot(horizontal, vertical) > speed) hi = horizontal;
    else lo = horizontal;
  }
  const horizontal = (lo + hi) / 2;
  return vec(0, verticalVelocity(releaseY, horizontal, bounceZ), -horizontal);
}

function isSpin(style: Style) { return style === 'offSpin' || style === 'legSpin'; }

export function generateDelivery(match: Match, rng: RNG): Delivery {
  const style = match.balls < CONFIG.match.ballsPerOver ? match.paceStyle : match.spinStyle;
  const spin = isSpin(style);
  const strategy = chooseStrategy(match, rng);
  const difficulty = CONFIG.difficulty[match.difficulty];
  const recent = match.outcomes.slice(-3);
  const legLofts = recent.filter(o => o.shotType === 'loft' && ['longOn', 'leg', 'fineLeg'].includes(o.direction ?? '')).length;
  const offShots = recent.filter(o => ['cover', 'point', 'thirdMan'].includes(o.direction ?? '')).length;
  const early = recent.filter(o => o.timingError !== undefined && o.timingError < -0.05).length;
  const misses = recent.filter(o => o.quality === 'miss').length;

  let length: Length = spin
    ? rng.pick(['full', 'good', 'good', 'short'] as const)
    : rng.pick(['full', 'good', 'good', 'short', 'yorker', 'bouncer'] as const);
  let targetX = rng.range(CONFIG.bowling.stockLine[0], CONFIG.bowling.stockLine[1]);
  let fieldName = 'balanced';
  let slower = false;
  let variation = spin ? 'Stock ball' : 'Stock delivery';

  if (strategy === 'tactical') {
    const signal = rng.next();
    if (signal < CONFIG.bowling.tacticalWeights[0]) {
      if (legLofts >= 2) { targetX = rng.range(-0.62, -0.38); length = spin ? 'full' : 'yorker'; fieldName = 'offSide'; }
      else if (early >= 2) { slower = true; variation = 'Change of pace'; }
      else if (misses >= 2) { targetX = rng.range(-0.10, 0.10); length = 'full'; }
      else if (offShots >= 2) { targetX = rng.range(0.16, 0.40); fieldName = 'legSide'; }
    } else if (signal < CONFIG.bowling.tacticalWeights[0] + CONFIG.bowling.tacticalWeights[1]) {
      const remaining = Math.max(1, CONFIG.match.overs * CONFIG.match.ballsPerOver - match.balls);
      if ((match.target - match.runs) / remaining > 3) { targetX = -0.42; fieldName = 'offSide'; length = spin ? 'good' : 'yorker'; }
      else { targetX = 0; length = 'full'; }
    } else {
      const confidence = match.batters[match.striker]?.confidence ?? 50;
      targetX = confidence > 65 ? -0.40 : rng.range(-0.10, 0.10);
    }
  }

  let speed = rng.range(CONFIG.speed[style][0], CONFIG.speed[style][1]);
  if (slower || (!spin && strategy === 'surprise' && rng.next() < 0.55)) {
    speed *= CONFIG.bowling.slowerMultiplier;
    variation = 'Slower ball';
  }
  const stockTurn = style === 'offSpin' ? 1 : -1;
  let turn = spin ? stockTurn * rng.range(CONFIG.bowling.spinTurn[0], CONFIG.bowling.spinTurn[1]) * difficulty.movement : 0;
  let swing = !spin ? rng.range(-1, 1) * (style === 'medium' ? CONFIG.bowling.mediumSwing : CONFIG.bowling.fastSwing) * difficulty.movement : 0;
  if (spin) {
    variation = style === 'offSpin' ? 'Off-break' : 'Leg-break';
    if (strategy === 'surprise') {
      const draw = rng.next();
      if (draw < 0.45) {
        turn = style === 'legSpin' ? Math.abs(turn) : 0.05;
        variation = style === 'legSpin' ? 'Googly' : 'Arm ball';
      } else if (draw < 0.75) { speed *= CONFIG.bowling.flightedMultiplier; length = 'full'; variation = 'Flighted ball'; }
      else { speed *= CONFIG.bowling.fasterMultiplier; turn *= CONFIG.bowling.fasterTurnMultiplier; variation = 'Faster ball'; }
    }
  } else if (style === 'medium' && variation === 'Stock delivery') {
    variation = swing > 0 ? 'Inswinger' : 'Outswinger';
    if (strategy === 'surprise' && rng.next() < 0.5) { swing *= CONFIG.bowling.cutterSwingMultiplier; turn = rng.range(-CONFIG.bowling.cutterTurn, CONFIG.bowling.cutterTurn); variation = 'Cutter'; }
  }

  // Reduced accuracy changes playable line dispersion, never the truth of the marker.
  targetX += rng.range(-1, 1) * (1 - difficulty.accuracy) * CONFIG.bowling.accuracyDispersion;
  const band = CONFIG.bowling.bounceBands[length];
  const bounceZ = rng.range(band[0], band[1]);
  const release = { ...CONFIG.bowling.release };
  const velocity = launchVelocity(speed, release.y, bounceZ);
  const restitution = spin
    ? rng.range(CONFIG.bowling.spinRestitution[0], CONFIG.bowling.spinRestitution[1])
    : length === 'bouncer' ? CONFIG.bowling.bouncerRestitution
    : rng.range(CONFIG.bowling.paceRestitution[0], CONFIG.bowling.paceRestitution[1]);
  const delivery: Delivery = {
    id: match.balls,
    style,
    bowler: ({ fast: 'The Express', medium: 'The Swinger', offSpin: 'The Off-spinner', legSpin: 'The Leg-spinner' })[style],
    length, variation, speed,
    release, velocity, swing, turn, restitution,
    bounce: vec(), arrival: 0, contact: vec(),
    field: fieldPreset(fieldName), fieldName, strategy,
  };

  // X is linear in initial vx: solve to the committed contact line, preserving real swing and turn.
  let prediction = predictDelivery(delivery);
  const xIntegral = -Math.expm1(-CONFIG.airDrag * prediction.arrival) / CONFIG.airDrag;
  velocity.x += (targetX - prediction.contact.x) / xIntegral;
  prediction = predictDelivery(delivery);
  velocity.x += (targetX - prediction.contact.x) / xIntegral;
  prediction = predictDelivery(delivery);
  delivery.speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  delivery.bounce = prediction.bounce;
  delivery.arrival = prediction.arrival;
  delivery.contact = prediction.contact;

  // Immutable commitments prevent accidental tactical changes after the run-up starts.
  Object.freeze(delivery.release);
  Object.freeze(delivery.velocity);
  Object.freeze(delivery.bounce);
  Object.freeze(delivery.contact);
  for (const fielder of delivery.field) Object.freeze(fielder);
  Object.freeze(delivery.field);
  return Object.freeze(delivery);
}
