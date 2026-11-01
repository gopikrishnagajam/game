import { CONFIG } from '../core/config';
import { RNG } from '../core/math';
import type { Batter, Difficulty, Match, Outcome, Style, Team } from '../core/types';
import { confidenceFromHistory } from '../confidence/confidence';

export interface MatchUpdate {
  match: Match;
  milestone: boolean;
  overChanged: boolean;
}

export function createMatch(team: Team, difficulty: Difficulty, seed: number): Match {
  const rng = new RNG(seed);
  const batters: Batter[] = Array.from({ length: CONFIG.match.rosterSize }, (_, id) => ({
    id,
    name: `Batter ${String(id + 1).padStart(2, '0')}`,
    runs: 0,
    balls: 0,
    confidence: CONFIG.confidence.initial,
    history: [],
    out: false,
    milestones: [],
  }));
  return {
    team,
    difficulty,
    target: CONFIG.difficulty[difficulty].target,
    seed,
    runs: 0,
    wickets: 0,
    balls: 0,
    striker: 0,
    nonStriker: 1,
    nextBatter: 2,
    batters,
    outcomes: [],
    complete: false,
    won: false,
    paceStyle: rng.pick<Style>(['fast', 'medium']),
    spinStyle: rng.pick<Style>(['offSpin', 'legSpin']),
  };
}

function validateOutcome(outcome: Outcome): void {
  if (![0, 1, 2, 3, 4, 6].includes(outcome.runs)) {
    throw new Error(`Invalid delivery runs: ${outcome.runs}`);
  }
  if (outcome.wicket && outcome.runs !== 0) {
    throw new Error('A v0.1 dismissal cannot also award shot runs.');
  }
  if (!Number.isFinite(outcome.contribution) || outcome.contribution < -50 || outcome.contribution > 50) {
    throw new Error('Execution contribution must be finite and between -50 and +50.');
  }
  if (outcome.wicket === 'caught' && outcome.shotType && outcome.shotType !== 'loft') {
    throw new Error('Only eligible lofted shots can be caught.');
  }
}

/** Resolve one legal delivery atomically. The caller owns the delivery-once guard. */
export function applyOutcome(current: Match, outcome: Outcome): MatchUpdate {
  if (current.complete) return { match: current, milestone: false, overChanged: false };
  validateOutcome(outcome);

  const match: Match = {
    ...current,
    batters: current.batters.map(batter => ({
      ...batter,
      history: [...batter.history],
      milestones: [...batter.milestones],
    })),
    outcomes: [...current.outcomes, { ...outcome }],
  };
  // Capture the faced batter before replacement or either strike swap.
  const faced = match.batters[current.striker];
  if (!faced || faced.out) throw new Error('A delivery requires a live striker.');
  faced.balls += 1;
  faced.runs += outcome.runs;
  faced.history = [...faced.history, outcome.contribution].slice(-CONFIG.confidence.history);
  faced.confidence = confidenceFromHistory(faced.history);
  faced.out = Boolean(outcome.wicket);

  let milestone = false;
  for (const threshold of CONFIG.milestones) {
    if (faced.runs >= threshold && !faced.milestones.includes(threshold)) {
      faced.milestones.push(threshold);
      milestone = true;
    }
  }

  match.runs += outcome.runs;
  match.balls += 1;
  match.wickets += outcome.wicket ? 1 : 0;
  match.won = match.runs >= match.target;
  match.complete = match.won
    || match.wickets >= CONFIG.match.maxWickets
    || match.balls >= CONFIG.match.overs * CONFIG.match.ballsPerOver;

  // An ended match has no next delivery and must not load another batter.
  if (match.complete) return { match, milestone, overChanged: false };

  if (outcome.wicket) {
    if (match.nextBatter >= match.batters.length) throw new Error('Batting roster exhausted before innings end.');
    match.striker = match.nextBatter;
    match.nextBatter += 1;
  }
  if (outcome.runs % 2 === 1) [match.striker, match.nonStriker] = [match.nonStriker, match.striker];

  const overChanged = match.balls % CONFIG.match.ballsPerOver === 0;
  if (overChanged) [match.striker, match.nonStriker] = [match.nonStriker, match.striker];
  return { match, milestone, overChanged };
}
