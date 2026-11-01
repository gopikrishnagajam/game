import type { Direction, ShotType } from '../core/types';

export function resolveDirection(keys: ReadonlySet<string>, previous: Direction = 'straight'): Direction {
  const x = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  const z = Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'));
  if (!x && !z) return previous;
  if (z > 0) return x < 0 ? 'longOn' : x > 0 ? 'cover' : 'straight';
  if (z < 0) return x < 0 ? 'fineLeg' : x > 0 ? 'thirdMan' : 'late';
  return x < 0 ? 'leg' : 'point';
}

export class InputManager {
  direction: Direction = 'straight';
  private held = new Set<string>();
  private shotHeld = new Set<string>();
  private locked = false;
  constructor(
    private onShot: (type: ShotType, direction: Direction, timestamp: number) => boolean,
    private onAdvance: () => void,
    private onPause: () => void,
    private onDirection: () => void,
  ) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }
  private down = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code.startsWith('Arrow')) {
      event.preventDefault();
      this.held.add(event.code);
      if (!this.locked) { this.direction = resolveDirection(this.held, this.direction); this.onDirection(); }
    }
    const shot: Record<string, ShotType> = { KeyA: 'defend', KeyS: 'ground', KeyD: 'loft' };
    if (shot[event.code]) {
      event.preventDefault();
      if (event.repeat || this.shotHeld.has(event.code)) return;
      this.shotHeld.add(event.code);
      if (!this.locked && this.onShot(shot[event.code], this.direction, event.timeStamp)) this.locked = true;
    }
    if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) this.onAdvance(); }
    if (event.code === 'Escape' && !event.repeat) this.onPause();
  };
  private up = (event: KeyboardEvent) => { this.held.delete(event.code); this.shotHeld.delete(event.code); };
  clear = () => { this.held.clear(); this.shotHeld.clear(); };
  reset() { this.clear(); this.locked = false; this.direction = 'straight'; }
  unlock() { this.locked = false; }
  dispose() {
    window.removeEventListener('keydown', this.down); window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }
}
