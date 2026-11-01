import { CONFIG } from '../core/config';
import { clamp, lerp } from '../core/math';
import type { Vec3 } from '../core/types';

export interface Capsule { a: Vec3; b: Vec3; radius: number }
export interface SweptCollision { t: number; point: Vec3 }

const pointAt = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
});

/** Sphere against a moving shin capsule, in the same time interval as the bat sweep. */
export function sweepCapsule(
  a: Vec3,
  b: Vec3,
  from: Capsule,
  to: Capsule,
  ballRadius: number,
): SweptCollision | null {
  const distanceSquared = (t: number): number => {
    const px = lerp(a.x, b.x, t);
    const py = lerp(a.y, b.y, t);
    const pz = lerp(a.z, b.z, t);
    const ax = lerp(from.a.x, to.a.x, t);
    const ay = lerp(from.a.y, to.a.y, t);
    const az = lerp(from.a.z, to.a.z, t);
    const dx = lerp(from.b.x, to.b.x, t) - ax;
    const dy = lerp(from.b.y, to.b.y, t) - ay;
    const dz = lerp(from.b.z, to.b.z, t) - az;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const along = lengthSquared > 1e-15
      ? clamp(((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lengthSquared)
      : 0;
    const rx = px - (ax + dx * along);
    const ry = py - (ay + dy * along);
    const rz = pz - (az + dz * along);
    const radius = ballRadius + lerp(from.radius, to.radius, t);
    return rx * rx + ry * ry + rz * rz - radius * radius;
  };
  if (distanceSquared(0) <= 1e-12) return { t: 0, point: { ...a } };

  const ballTravel = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const padTravel = Math.max(
    Math.hypot(to.a.x - from.a.x, to.a.y - from.a.y, to.a.z - from.a.z),
    Math.hypot(to.b.x - from.b.x, to.b.y - from.b.y, to.b.z - from.b.z),
  );
  // Twenty is sufficient at 120 Hz; adaptive sampling also supports long debug sweeps.
  const substeps = Math.max(20, Math.ceil((ballTravel + padTravel) / Math.max(0.005, (ballRadius + Math.min(from.radius, to.radius)) * 0.4)));
  for (let i = 1; i <= substeps; i++) {
    const t = i / substeps;
    if (distanceSquared(t) <= 1e-12) {
      let low = (i - 1) / substeps;
      let high = t;
      for (let j = 0; j < 14; j++) {
        const middle = (low + high) / 2;
        if (distanceSquared(middle) <= 0) high = middle;
        else low = middle;
      }
      return { t: high, point: pointAt(a, b, high) };
    }
  }
  return null;
}

/**
 * Swept sphere against the simplified wicket envelope. Radius expansion ensures
 * a grazing physical ball can hit a stump while its center stays outside it.
 */
export function sweepStumps(a: Vec3, b: Vec3): SweptCollision | null {
  const radius = CONFIG.ballRadius;
  const minimum = [-CONFIG.stump.halfWidth - radius, -radius, CONFIG.stump.z - radius];
  const maximum = [CONFIG.stump.halfWidth + radius, CONFIG.stump.height + radius, CONFIG.stump.z + radius];
  const origin = [a.x, a.y, a.z];
  const delta = [b.x - a.x, b.y - a.y, b.z - a.z];
  let entry = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]) < 1e-12) {
      if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
      continue;
    }
    let near = (minimum[axis] - origin[axis]) / delta[axis];
    let far = (maximum[axis] - origin[axis]) / delta[axis];
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit + 1e-12) return null;
  }
  return { t: clamp(entry), point: pointAt(a, b, clamp(entry)) };
}
