import { CONFIG } from '../core/config';
import { clamp, lerp, type RNG } from '../core/math';
import type { BatPose, Delivery, Direction, Quality, Shot, ShotType, Stroke, Vec3 } from '../core/types';
import { confidenceModifiers } from '../confidence/confidence';

const DEG = Math.PI / 180;
export function directionAngle(direction: Direction, line = 0) {
  return ({ straight: 0, cover: -43, longOn: 43, leg: 88, point: -88,
    fineLeg: 139, thirdMan: -139, late: line < 0 ? -157 : 157 })[direction] * DEG;
}

export function selectStroke(delivery: Delivery, type: ShotType, direction: Direction): Stroke {
  const short = delivery.length === 'short' || delivery.length === 'bouncer';
  if (type === 'defend') {
    if (delivery.contact.y > CONFIG.batting.duckHeight) return 'duck';
    return short || delivery.contact.y > 0.85 ? 'backDefense' : 'forwardDefense';
  }
  if (type === 'loft') {
    if(short && (direction==='point'||direction==='cover'||direction==='thirdMan')) return 'cut';
    if(short && (direction==='leg'||direction==='longOn'||direction==='fineLeg')) return 'pull';
    return direction === 'straight' ? 'loftStraight' : 'loftDrive';
  }
  if (direction === 'late' || direction === 'thirdMan' || direction === 'fineLeg') return 'lateCut';
  if (short) return direction === 'leg' || direction === 'longOn' ? 'pull' : direction === 'point' || direction === 'cover' ? 'cut' : 'backPunch';
  return direction === 'cover' || direction === 'point' ? 'coverDrive' : direction === 'longOn' || direction === 'leg' ? 'onDrive' : 'straightDrive';
}

export function timingEvaluation(type: ShotType, error: number): { quality: Quality; raw: number; contribution: number } {
  const e = Math.abs(error), w = CONFIG.timing[type];
  if (e <= w.perfect) return { quality: 'perfect', raw: lerp(1, 0.9, e / w.perfect), contribution: 50 };
  if (e <= w.good) {
    const t = (e - w.perfect) / (w.good - w.perfect);
    return { quality: 'good', raw: lerp(0.9, 0.65, t), contribution: lerp(50, 25, t) };
  }
  if (e <= w.outer) {
    const t = (e - w.good) / (w.outer - w.good);
    return { quality: 'mistimed', raw: lerp(0.65, 0.12, t), contribution: lerp(25, -35, t) };
  }
  return { quality: 'miss', raw: 0, contribution: -50 };
}

export function shotSuitability(delivery: Delivery, direction: Direction, type: ShotType): number {
  const x = delivery.contact.x, height = delivery.contact.y;
  const angle = directionAngle(direction, x), side = Math.sin(angle);
  let suitability = 1;
  if (Math.abs(x) > 0.16 && side * x < -0.05) suitability -= clamp(Math.abs(x) * 0.65, 0, 0.55);
  if (Math.abs(angle) > 2 && delivery.length !== 'short') suitability -= 0.23;
  if (Math.abs(angle) > 1.15 && delivery.length === 'yorker') suitability -= 0.28;
  if (type === 'loft' && delivery.length === 'yorker') suitability -= 0.2;
  if (type === 'defend' && height > CONFIG.batting.duckHeight) return 1;
  return clamp(suitability, 0.28, 1);
}

export function createShot(delivery: Delivery, type: ShotType, direction: Direction, now: number): Shot {
  const stroke = selectStroke(delivery, type, direction);
  const contactAt = now + CONFIG.lead[stroke];
  const timingError = contactAt - delivery.arrival;
  const evaluation = timingEvaluation(type, timingError);
  const angle = directionAngle(direction, delivery.contact.x);
  const suitability = shotSuitability(delivery, direction, type);
  const reach = type === 'defend' ? 0.4 : 0.65;
  const target = { ...delivery.contact };
  target.x = clamp(target.x, CONFIG.batting.minTargetX, CONFIG.batting.maxTargetX) + Math.sin(angle) * (1 - suitability) * reach;
  target.y = clamp(target.y, CONFIG.batting.minTargetHeight, CONFIG.batting.maxTargetHeight);
  // A cut/pull has a horizontal blade and cannot reach a yorker at shoe height.
  // Keep a plausible grip height and let an unsuitable low ball pass beneath it.
  if(stroke==='cut'||stroke==='pull'||stroke==='lateCut')target.y=Math.max(CONFIG.batting.minHorizontalHeight,target.y);
  return {
    type, direction, stroke, committedAt: now, contactAt, target, angle, suitability,
    timingError, quality: evaluation.quality,
    raw: evaluation.raw * suitability,
    contribution: evaluation.contribution - (1 - suitability) * 35,
  };
}

function mixVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t), z: lerp(a.z,b.z,t) };
}

// Sphere vs a moving bat blade. Sampled subdivisions bound travel to < 3 cm
// at the fastest supported incoming speed, then refine the first overlap.
export function sweptBatContact(a: Vec3, b: Vec3, before: BatPose, after: BatPose): { t: number; point: Vec3; offset: number } | null {
  const overlap = (t: number) => {
    const p = mixVec(a,b,t), heel = mixVec(before.heel,after.heel,t), toe = mixVec(before.toe,after.toe,t);
    const axis = { x: toe.x-heel.x, y: toe.y-heel.y, z: toe.z-heel.z };
    const length = Math.hypot(axis.x,axis.y,axis.z);
    if (!length) return null;
    axis.x /= length; axis.y /= length; axis.z /= length;
    const face = mixVec(before.face,after.face,t), fl = Math.hypot(face.x,face.y,face.z) || 1;
    face.x /= fl; face.y /= fl; face.z /= fl;
    const side = { x: axis.y*face.z-axis.z*face.y, y: axis.z*face.x-axis.x*face.z, z: axis.x*face.y-axis.y*face.x };
    const sl = Math.hypot(side.x,side.y,side.z) || 1;
    side.x/=sl; side.y/=sl; side.z/=sl;
    // Orthogonalize normal against the blade axis and its width.
    const normal = { x: side.y*axis.z-side.z*axis.y, y: side.z*axis.x-side.x*axis.z, z: side.x*axis.y-side.y*axis.x };
    const delta = { x:p.x-heel.x,y:p.y-heel.y,z:p.z-heel.z };
    const along = delta.x*axis.x+delta.y*axis.y+delta.z*axis.z;
    const across = delta.x*side.x+delta.y*side.y+delta.z*side.z;
    const depth = delta.x*normal.x+delta.y*normal.y+delta.z*normal.z;
    const dx = Math.max(0,Math.abs(across)-CONFIG.batting.bladeHalfWidth);
    const dy = Math.max(0,-along,along-length);
    const dz = Math.max(0,Math.abs(depth)-CONFIG.batting.bladeHalfThickness);
    return dx*dx+dy*dy+dz*dz <= CONFIG.ballRadius ** 2
      ? { point:p, offset: Math.abs(along / length - 0.5)*2 } : null;
  };
  for (let i=0;i<=20;i++) {
    const t=i/20, hit=overlap(t);
    if (hit) {
      let lo=Math.max(0,t-1/20), hi=t;
      for(let j=0;j<8;j++){const mid=(lo+hi)/2; if(overlap(mid))hi=mid;else lo=mid;}
      const first=overlap(hi)!;
      return {t:hi,...first};
    }
  }
  return null;
}

export function launchVelocity(shot: Shot, incoming: Vec3, confidence: number, offset: number, batSpeed: number, rng: RNG): { velocity: Vec3; aerial: boolean; raw: number } {
  const tuning=CONFIG.batting.launch;
  const raw = clamp(shot.raw * (1 - offset * CONFIG.batting.offsetQualityPenalty));
  const modifiers = confidenceModifiers(confidence, raw);
  const q = modifiers.quality;
  const deviation = (rng.next()-0.5) * (1-q) * CONFIG.batting.maxPrecisionDeviation * modifiers.deviation;
  const angle = shot.angle + deviation;
  if (shot.type === 'defend') {
    const speed = tuning.defenseBase + q*tuning.defenseQuality + Math.min(tuning.defenseIncomingCap,Math.hypot(incoming.x,incoming.z)*tuning.defenseIncomingScale);
    return { velocity: { x:Math.sin(angle)*speed,y:0.2,z:Math.cos(angle)*speed }, aerial:false, raw };
  }
  const transfer=lerp(tuning.minimumTransfer,1,Math.pow(q,tuning.transferExponent));
  const speed = (tuning.baseSpeed+tuning.qualitySpeed*q+Math.min(tuning.maxBatBoost,batSpeed*tuning.batSpeedScale)+Math.hypot(incoming.x,incoming.z)*tuning.incomingSpeedScale) * transfer * modifiers.power * shot.suitability;
  const aerial = shot.type === 'loft' && raw > tuning.aerialQualityThreshold;
  // Drive higher contacts down into the turf rather than letting a "grounded"
  // cut carry above a virtual ground interceptor. The first bounce is simulated.
  const elevation = aerial ? lerp(tuning.minLoftAngle,tuning.maxLoftAngle,q)*DEG
    : -Math.atan2(Math.max(0,shot.target.y-CONFIG.ballRadius),tuning.groundContactDistance);
  return { velocity: { x: Math.sin(angle)*speed*Math.cos(elevation), y: speed*Math.sin(elevation), z: Math.cos(angle)*speed*Math.cos(elevation) }, aerial, raw };
}
