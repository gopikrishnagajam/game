import type { Vec3 } from './types';
export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x); };
export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const copy = (v: Vec3): Vec3 => ({ ...v });
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
export class RNG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return lerp(a, b, this.next()); }
  pick<T>(items: readonly T[]): T { return items[Math.floor(this.next() * items.length)]; }
}
