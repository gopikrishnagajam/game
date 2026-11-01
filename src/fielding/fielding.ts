import { CONFIG } from '../core/config';
import type { RNG } from '../core/math';
import type { Fielder, Vec3 } from '../core/types';

export const GEOMETRY_EPSILON = CONFIG.fielding.epsilon;

/** Earliest entry into a closed 2D circle; handles starts inside and tangencies. */
export function segmentCircle(a: Vec3, b: Vec3, x: number, z: number, radius: number): number | null {
  const px = a.x - x;
  const pz = a.z - z;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const c = px * px + pz * pz - radius * radius;
  if (c <= GEOMETRY_EPSILON) return 0;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= GEOMETRY_EPSILON * GEOMETRY_EPSILON) return null;
  const halfB = px * dx + pz * dz;
  const discriminant = halfB * halfB - lengthSquared * c;
  if (discriminant < -GEOMETRY_EPSILON) return null;
  const t = (-halfB - Math.sqrt(Math.max(0, discriminant))) / lengthSquared;
  return t >= -GEOMETRY_EPSILON && t <= 1 + GEOMETRY_EPSILON ? Math.max(0, Math.min(1, t)) : null;
}

function boundaryExit(a: Vec3, b: Vec3): number | null {
  const radius = CONFIG.boundary;
  if (Math.hypot(a.x, a.z) >= radius - GEOMETRY_EPSILON) return 0;
  if (Math.hypot(b.x, b.z) < radius - GEOMETRY_EPSILON) return null;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const aa = dx * dx + dz * dz;
  if (aa < GEOMETRY_EPSILON * GEOMETRY_EPSILON) return null;
  const halfB = a.x * dx + a.z * dz;
  const c = a.x * a.x + a.z * a.z - radius * radius;
  const t = (-halfB + Math.sqrt(Math.max(0, halfB * halfB - aa * c))) / aa;
  return Math.max(0, Math.min(1, t));
}

export interface GroundEvent {
  t: number;
  kind: 'intercept' | 'boundary';
  position: Vec3;
}

/** Competes intersections in physical travel order, with interception winning exact ties. */
export function groundEvent(a: Vec3, b: Vec3, field: Fielder[]): GroundEvent | null {
  let earliest = boundaryExit(a, b);
  let kind: GroundEvent['kind'] = 'boundary';
  for (const fielder of field) {
    const hit = segmentCircle(a, b, fielder.x, fielder.z, fielder.groundRadius);
    if (hit !== null && (earliest === null || hit <= earliest + GEOMETRY_EPSILON)) {
      earliest = hit;
      kind = 'intercept';
    }
  }
  if (earliest === null) return null;
  return {
    t: earliest,
    kind,
    position: {
      x: a.x + (b.x - a.x) * earliest,
      y: a.y + (b.y - a.y) * earliest,
      z: a.z + (b.z - a.z) * earliest,
    },
  };
}

/** Half-open rings; exact thresholds enter the higher run band. */
export function groundRuns(distance: number): number {
  if (distance + GEOMETRY_EPSILON < CONFIG.rings[0]) return 0;
  if (distance + GEOMETRY_EPSILON < CONFIG.rings[1]) return 1;
  if (distance + GEOMETRY_EPSILON < CONFIG.rings[2]) return 2;
  return 3;
}

export function loftOutcome(
  landing: Vec3,
  field: Fielder[],
  confidence: number,
  rng: RNG,
): { runs: number; wicket?: 'caught'; dropped?: boolean } {
  const distance = Math.hypot(landing.x, landing.z);
  if (distance > CONFIG.boundary + GEOMETRY_EPSILON) return { runs: 6 };
  const runs = distance + GEOMETRY_EPSILON >= CONFIG.rings[3] ? 4 : groundRuns(distance);
  const catchingOpportunity = field.some(fielder =>
    Math.hypot(landing.x - fielder.x, landing.z - fielder.z) <= fielder.catchRadius + GEOMETRY_EPSILON,
  );
  if (!catchingOpportunity) return { runs };
  const probability = 1 - 0.002 * Math.max(0, Math.min(100, confidence));
  if (rng.next() < probability) return { runs: 0, wicket: 'caught' };
  return { runs, dropped: true };
}
