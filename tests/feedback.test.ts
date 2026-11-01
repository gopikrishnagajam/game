import { describe, expect, it } from 'vitest';
import type { Outcome } from '../src/core/types';
import { battingFeedback } from '../src/ui/feedback';

const contact = (overrides: Partial<Outcome> = {}): Outcome => ({
  runs: 0, quality: 'good', contribution: 25, shotType: 'ground', timingError: -.08, ...overrides,
});

describe('truthful batting feedback', () => {
  it('rewards actual perfect contact', () => {
    expect(battingFeedback(contact({ quality: 'perfect', timingError: 0 })).label).toBe('PERFECT!');
  });

  it('distinguishes early and late contact with actionable corrections', () => {
    expect(battingFeedback(contact())).toMatchObject({ label: 'EARLY', tone: 'early' });
    expect(battingFeedback(contact()).note).toContain('later');
    expect(battingFeedback(contact({ quality: 'mistimed', timingError: .15 }))).toMatchObject({ label: 'LATE', tone: 'late' });
    expect(battingFeedback(contact({ timingError: .1 })).note).toContain('sooner');
  });

  it('does not label a geometric miss as a perfect hit even with ideal intended timing', () => {
    const feedback = battingFeedback(contact({ quality: 'miss', timingError: 0 }));
    expect(feedback.label).toBe('MISSED');
    expect(feedback.note).toContain('No bat contact');
    expect(feedback.note).toContain('direction or shot');
  });

  it('explains both ends of a complete timing miss', () => {
    expect(battingFeedback(contact({ quality: 'miss', timingError: -1 })).note).toContain('Too early');
    expect(battingFeedback(contact({ quality: 'miss', timingError: 1 })).note).toContain('Too late');
  });

  it('explains an unplayed delivery without inventing timing or contact', () => {
    const feedback = battingFeedback({ runs: 0, quality: 'miss', contribution: -50 });
    expect(feedback.label).toBe('MISSED');
    expect(feedback.note).toContain('No shot played');
  });

  it('recognizes a successful duck without claiming the bat struck the ball', () => {
    expect(battingFeedback(contact({ shotType: 'defend' }), true).label).toBe('WELL LEFT');
    expect(battingFeedback(contact({ quality: 'miss', shotType: 'defend' }), true).label).toBe('MISSED');
  });

  it('keeps caught and dropped outcomes independent of timing feedback', () => {
    const clean = contact({ quality: 'perfect', timingError: 0 });
    expect(battingFeedback({ ...clean, wicket: 'caught' }).label).toBe('PERFECT!');
    expect(battingFeedback({ ...clean, dropped: true, runs: 2 }).label).toBe('PERFECT!');
  });
});
