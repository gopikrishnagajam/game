import { CONFIG } from '../core/config';
import { clamp } from '../core/math';

/** Missing entries are neutral slots, not a smaller divisor. */
export function confidenceFromHistory(history: readonly number[]): number {
  const recent = history.slice(-CONFIG.confidence.history);
  return clamp(
    CONFIG.confidence.initial + recent.reduce((sum, value) => sum + value, 0) / CONFIG.confidence.history,
    0,
    100,
  );
}

/** Call only after an eligible loft has landed in a virtual catching zone. */
export function catchProbability(confidence: number): number {
  return 1 - 0.002 * clamp(confidence, 0, 100);
}

/**
 * Confidence changes marginal contact, never input timing or whether the bat
 * physically reached the ball. raw is execution quality on a 0..1 scale.
 * power and deviation are multipliers, not extra random draws.
 */
export function confidenceModifiers(confidence: number, raw: number): {
  quality: number;
  power: number;
  deviation: number;
} {
  const execution = clamp(raw);
  const centered = (clamp(confidence, 0, 100) - 50) / 50;
  const marginal = 4 * execution * (1 - execution);
  return {
    quality: clamp(execution + centered * 0.12 * marginal),
    power: 1 + centered * CONFIG.confidence.powerCap,
    deviation: 1 - centered * 0.35,
  };
}
