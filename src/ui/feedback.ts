import { CONFIG } from '../core/config';
import type { Outcome } from '../core/types';

export interface BattingFeedback {
  label: string;
  note: string;
  tone: 'perfect' | 'early' | 'late' | 'miss' | 'neutral';
}

/** Describe observed contact, never turn intended timing into a claimed hit. */
export function battingFeedback(outcome: Outcome, ducked = false): BattingFeedback {
  if (ducked && outcome.quality === 'good') return { label: 'WELL LEFT', note: 'Bouncer avoided.', tone: 'neutral' };
  const error = outcome.timingError;
  const early = error !== undefined && error < 0;
  if (outcome.quality === 'miss') {
    if (error === undefined) return { label: 'MISSED', note: 'No shot played. Press A, S or D after release.', tone: 'miss' };
    const close = Math.abs(error) <= CONFIG.timing[outcome.shotType ?? 'ground'].perfect;
    return {
      label: 'MISSED', tone: 'miss',
      note: close ? 'No bat contact. Try a direction or shot suited to the ball.'
        : early ? 'Too early. Let the ball come closer before swinging.' : 'Too late. Start your swing sooner.',
    };
  }
  if (outcome.quality === 'perfect') return { label: 'PERFECT!', note: 'Clean timing.', tone: 'perfect' };
  if (error === undefined || Math.abs(error) < 1e-6) return { label: outcome.quality === 'good' ? 'GOOD CONTACT' : 'MISTIMED', note: 'Contact made. Keep watching the ball.', tone: 'neutral' };
  return {
    label: early ? 'EARLY' : 'LATE', tone: early ? 'early' : 'late',
    note: `${outcome.quality === 'good' ? 'Good' : 'Mistimed'} contact. Try swinging ${early ? 'a little later' : 'a little sooner'}.`,
  };
}
