import { CONFIG } from '../core/config';
import type { Vec3 } from '../core/types';

/** Cosmetic values only. None of these values participate in collision or scoring. */
export const PRESENTATION = {
  ball: { scale: 1.65, maxScale: 2.6, minimumDiameterPixels: 5.8 },
  trail: { samples: 20, duration: 0.115, interval: 1 / 180, maxLength: 3.2, opacity: 0.30 },
  bounce: { duration: 0.32, expansion: 2.6 },
  contact: { duration: 0.16, perfectExpansion: 0.28, otherExpansion: 0.17 },
  camera: { maxYaw: 0.36, maxPitch: 0.32, smoothing: 7.5 },
} as const;

/** Keep the release readable without enlarging the actual ball's collision sphere. */
export function visualBallScale(distance: number, viewportHeight: number, fov: number): number {
  const minimumRadius = PRESENTATION.ball.minimumDiameterPixels * Math.max(0, distance)
    * Math.tan(fov * Math.PI / 360) / Math.max(1, viewportHeight);
  return Math.max(PRESENTATION.ball.scale, Math.min(PRESENTATION.ball.maxScale, minimumRadius / CONFIG.ballRadius));
}

/** A bounded look direction: the camera never translates or turns behind the batter. */
export function followCameraTarget(ball: Readonly<Vec3>, out: Vec3): Vec3 {
  const c = CONFIG.camera;
  const x = ball.x - c.x, y = ball.y - c.y, z = ball.z - c.z;
  const basePitch = Math.atan2(c.lookY - c.y, c.lookZ - c.z);
  const yaw = Math.max(-PRESENTATION.camera.maxYaw, Math.min(PRESENTATION.camera.maxYaw, Math.atan2(x, z)));
  const pitch = Math.max(basePitch, Math.min(PRESENTATION.camera.maxPitch, Math.atan2(y, Math.hypot(x, z))));
  const distance = Math.hypot(c.lookY - c.y, c.lookZ - c.z);
  out.x = c.x + Math.sin(yaw) * Math.cos(pitch) * distance;
  out.y = c.y + Math.sin(pitch) * distance;
  out.z = c.z + Math.cos(yaw) * Math.cos(pitch) * distance;
  return out;
}

export function smoothApproach(from: number, to: number, elapsed: number): number {
  return from + (to - from) * (1 - Math.exp(-PRESENTATION.camera.smoothing * Math.max(0, elapsed)));
}

/** Fixed storage for a short trail of observed positions. No extrapolation or prediction. */
export class BallTrail {
  readonly positions = new Float32Array(PRESENTATION.trail.samples * 6);
  readonly colors = new Float32Array(PRESENTATION.trail.samples * 8);
  private samples = Array.from({ length: PRESENTATION.trail.samples }, () => ({ x: 0, y: 0, z: 0, time: -Infinity }));
  private next = 0;
  private count = 0;
  private lastTime = -Infinity;

  reset() { this.next = 0; this.count = 0; this.lastTime = -Infinity; }

  update(position: Readonly<Vec3>, time: number): number {
    if (time < this.lastTime) this.reset();
    if (time - this.lastTime >= PRESENTATION.trail.interval) {
      const sample = this.samples[this.next];
      sample.x = position.x; sample.y = position.y; sample.z = position.z; sample.time = time;
      this.next = (this.next + 1) % this.samples.length;
      this.count = Math.min(this.count + 1, this.samples.length);
      this.lastTime = time;
    }
    let vertices = 0;
    const head = this.samples[(this.next - 1 + this.samples.length) % this.samples.length];
    for (let i = 1; i < this.count; i++) {
      const a = this.samples[(this.next - i + this.samples.length) % this.samples.length];
      const b = this.samples[(this.next - i - 1 + this.samples.length) % this.samples.length];
      if (time - b.time > PRESENTATION.trail.duration) break;
      if (Math.hypot(head.x - b.x, head.y - b.y, head.z - b.z) > PRESENTATION.trail.maxLength) break;
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const p = endpoint === 0 ? a : b;
        const index = vertices * 3;
        this.positions[index] = p.x; this.positions[index + 1] = p.y; this.positions[index + 2] = p.z;
        const color = vertices * 4;
        this.colors[color] = 1; this.colors[color + 1] = 0.91; this.colors[color + 2] = 0.69;
        this.colors[color + 3] = Math.max(0, 1 - (time - p.time) / PRESENTATION.trail.duration);
        vertices++;
      }
    }
    return vertices;
  }
}
