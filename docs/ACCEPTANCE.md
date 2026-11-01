# Fun Cricket v0.3 acceptance report

Release: Fun Cricket v0.3, implemented from the existing `dev/0.2` game. This release improves reaction time, visibility, timing feedback and batting presentation while retaining the full Quick Chase loop. This report separates automated evidence from subjective human playtesting.

## v0.3 changes

- Beginner runs at 55% gameplay speed, Club at 70%, Pro at 85%. Both rendered frames and timestamped keyboard events enter one real-time adapter before the unchanged 120 Hz simulation. Run-up, delivery, swing, outgoing flight and result presentation share that clock.
- The physical ball radius remains 0.036 m. Only the display ball is enlarged, with a dark contour, bright core and short historical trail. The truthful late marker is clearer; a bounce pulse uses the actual swept landing event and survives a skipped first delivery frame.
- Timing windows in simulation time are defense 80/160/240 ms, grounded 55/120/190 ms, lofted 50/100/165 ms for perfect/good/outer limits. The grounded perfect band was calibrated from 65 to 55 ms after the batting refinement, retaining physical contact coverage with the shorter downswing. They remain independent of confidence and score. Real physical contact is still required.
- Actual contact reports PERFECT, EARLY or LATE. A geometric miss reports MISSED even with perfect intended timing; no-input and successful-duck feedback are distinct. Feedback freezes with pause.
- One continuous authored stroke now covers downswing, impact, follow-through and recovery for both hits and misses. Contact effects and richer impact sounds still require real contact. Camera position stays fixed; bounded smooth pan follows only the actual outgoing ball and resets before the next delivery.
- Direction can be prepared during run-up and carries between deliveries. Holding a shot key through release cannot trigger automatic batting. Pause and help block aim changes.

Bowling velocities, gravity, bounce/turn, collision detection, tactical AI, confidence formulas, fielding/scoring, wickets and strike rotation retain their original rules. Seeded catch/drop/mishit scenario inputs were refreshed so they remain deliberately mistimed under the wider windows; their physical assertions were retained.

## Batting refinement after playtest feedback

The original v0.3 motion spent 42% of a 0.20–0.28 simulation-second lead lifting the bat after input. Beginner input-to-impact took up to 509 real milliseconds. Nearly opposed bat axes caused rotation spikes, an additional success layer began after impact, and interpolated endpoints shortened the sampled blade during recovery. These defects were corrected in the authored motion rather than hidden with larger collision volumes or guaranteed hits.

The replacement has a prepared guard and 0.10–0.135 simulation-second leads: nominal impact is 182–245 ms on Beginner, with visible movement on the next simulation frame. Spherical cubic orientation and a rigid hand pivot keep the 0.69 m blade and grips consistent. Shared impact tangents, continuous follow-through and slower recovery remove the layered hit/reset. The stepping foot lifts and plants; gloves follow the handle; a smooth duck reaches its crouch at nominal impact. Head tracking begins at actual collision age and continues across the result transition.

Full-stroke tests sample every family through preparation, contact and recovery, checking blade length, angular/toe speed, arm reach, impact velocity continuity and recovery speed. Browser screenshots capture guard, first downswing frame, actual impact, follow-through and recovery. These checks establish specific corrections, not a claim that subjective batting feel is fully approved.

## Implemented scope

| Area | Implementation and evidence |
|---|---|
| Match | Both teams, three difficulties, fixed 16/24/32 targets, four-batter rosters, two overs, three wickets, immediate win/loss, scorecard and clean replay. Match reducer, headless match tests and browser match completion tests. |
| Batting | Eight directions; retained selection; one A/S/D commitment; fixed timing windows; assisted shot family; actual moving-blade collision; contact-driven launch; defense/duck; ground/loft/mishit classification. Batting, animation, timing-coverage and full game tests. |
| Bowling | Fast, medium, off-spin and leg-spin; pace then spin over; seeded weighted tactics and legal variation; immutable delivery/field before run-up; truthful late marker. Bowling/physics tests and complete matches. |
| Fielding/scoring | Continuous geometric ground interception, finite rolling stop, boundary crossing, aerial first-landing rings, geometric catch/drop eligibility and confidence formula. Fielding and actual gameplay scenario tests. |
| Confidence | Personal last-three raw execution records; neutral missing slots; initial 50%; fixed timing; bounded power/precision; current delivery uses pre-delivery value. Confidence, match and integration tests. |
| Presentation | Original articulated 3D players, continuous shared rigid strokes, connected hands and planted footwork, visible ball/trail, actual bounce/contact pulses, stable incoming view with bounded outgoing follow, HUD, confidence, live tracker and impact audio. Animation/presentation tests and browser screenshots. |
| Application | Locally runnable static browser app, assets/fonts included, pause/focus handling, production debug exclusion, source/docs, automated tests and production build. Type check, build and browser smoke. |

No visible fielders, keeper, umpire, non-striker, running, extras, extra modes, progression, backend or online account dependency were added. The v0.3 request explicitly permits outgoing-ball camera follow; the incoming batting view remains stable.

## Verification commands

```text
npm test
npm run check
npm run test:browser
npm run build
```

Final check results and production smoke evidence are recorded below. JSON reports and browser screenshots are stored in `tests/artifacts/`, with additional animation screenshots in `artifacts/`.

The browser suite uses Chromium through Playwright with software WebGL at 1440 × 900. It captures page/console errors and exercises actual application controls. Test scenarios use the development API only to drive deterministic simulation time and seeded inputs; physical outcomes are never replaced by mocked scores. The production smoke blocks non-local network requests and checks that the debug API and overlays remain unavailable.

## Specification edge-case traceability

| Section 25 case | Verification |
|---|---|
| A: loft beyond boundary | `fielding.test.ts`, actual early-win lofts in `game.test.ts` |
| B: landing in catch circle | `fielding.test.ts`, physical mistimed catch/drop in `scenarios.test.ts` |
| C: loft outside catch circles | `fielding.test.ts` checks no random catch or catch draw |
| D: failed loft becomes ground shot | `batting.test.ts`, physical D mishit in `scenarios.test.ts` |
| E: grounded interception | `fielding.test.ts` swept intersections and first-event order |
| F: grounded boundary | `fielding.test.ts`, real grounded match integration |
| G: natural ground stop | `physics.test.ts` rolling stop, field scoring tests and defensive dots |
| H: correct pace defense | Physical timing-coverage matrix and contact-driven defensive launch tests |
| I: failed spin defense | Same off-break defended or physically bowled with different selected geometry in `scenarios.test.ts`; another off-break succeeds with the risky direction |
| J/K: confidence extremes | `confidence.test.ts`, `batting.test.ts` perfect/miss endpoints and confidence-independent timing |
| L: 100% confidence catch probability | `confidence.test.ts` exact 80% endpoint |
| M: third wicket | `match.test.ts`, physical no-input third-wicket match in `game.test.ts` |
| N: early victory | `match.test.ts`, physical loft chase in game/browser tests |
| O: odd sixth-ball runs | `match.test.ts` applies both swaps |
| P: replacement confidence | `match.test.ts`, full game restart and confidence preservation tests |
| Q: off-screen ball | Tracker uses actual world position outside bounded camera pan; camera position stays fixed and next delivery restores original orientation |
| R: frame-rate variation | Identical complete matches at 30/60/144 Hz using each difficulty's scaled wall clock; browser timestamp/frame checks at all three speeds |
| S: geometric equality | Ring thresholds, exact boundary, closed circle edges, tangencies and interception ties in `fielding.test.ts` |

## Presentation inspection and known limits

The menu, setup, release, bounce, contact, geometric miss, tracker and results were inspected through captured browser screenshots. The original GLB was refreshed with the successful follow-through and retains sixteen animation clips. Animation tests check unchanged contact/pad geometry, footwork, continuity, recovery, blade length and reachable hands.

The sixteen scenarios in specification section 29.3 have automated coverage or corresponding deterministic mechanics checks, but **a human keyboard playtest of all sixteen has not been performed**. Batting feel, ball readability on different displays, target balance and repeated-match enjoyment still need user playtesting. Those subjective acceptance points are not marked conclusively passed.

Character motion is original articulated animation with procedural joint positioning, not motion capture. The models are stylized. Aerodynamics use gravity, linear drag and configured movement; catches resolve at first landing; LBW uses actual pads plus a simplified legal-line/stump projection model. These are documented arcade simplifications.

The 60 FPS hardware target has not been certified on a named consumer desktop GPU. Headless software WebGL is used for functional browser checks, not as a representative hardware benchmark. Trails use fixed storage and one line-segment draw; effects are brief and simple. Desktop keyboard play is supported; mobile controls are outside this release.

## Final check results

Verified on November 1, 2026, using Windows, Node.js 22.14.0 and Playwright Chromium. Browser checks use a 1440 × 900 viewport and software WebGL.

| Check | Result | Evidence |
|---|---|---|
| Unit and integration suite | 166 passed across 15 test files; zero failures | `tests/artifacts/unit-results.json` |
| TypeScript | `npm run check` passed; final production build also runs `tsc --noEmit` | Build's typecheck plugin in `vite.config.ts` |
| Browser suite | 18 passed; the separate production smoke is intentionally skipped in this development run | `tests/artifacts/browser-results.json`, `browser-run.log` |
| Production smoke | 1 passed against the final `dist/` build at `http://127.0.0.1:4173/` | `tests/artifacts/production-results.json`, `production.png`, `production-run.log` |
| Production build | `npm run build` passed; complete static output in `dist/` | Main JS 81.11 kB / 29.51 kB gzip; Three.js chunk 485.38 kB / 121.62 kB gzip |
| Original character export | Loaded successfully through Three.js `GLTFLoader.parseAsync`; all 16 animation clips present | `public/assets/fun-cricket-batter.glb` and asset manifest |

The browser suite verifies real physical victories and defeats, both teams, all difficulty targets, run-up aiming, retained direction, no buffered shots, locking/repeat suppression, focus-loss pause, scaled between-frame input timing, bounded camera follow/reset, and clean replay. Release/trail/bounce/contact checks verify cosmetic effects use real events, the physical radius is unchanged, effects freeze with pause, and skipped frames retain bounce feedback. Another integrated case distinguishes physical early/late hits from an ideally timed geometric miss. The production smoke verifies team setup, pause, return to menu, zero external requests, and absence of developer hooks. Neither browser run reported page or console errors.

The batting browser regression presses a real shot key, verifies next-frame movement and actual contact within 250 ms on Beginner, and compares rendered transforms across delivery/contact/feedback at the same animation time. There is no phase-triggered pose reset. The updated GLB retains 16 clips and includes exact impact keys plus the complete recovery; the portable export is about 1.43 MB and is not fetched by normal gameplay.

Existing Home navigation, Space activation of focused buttons, help/pause isolation and keyboard focus regressions also pass. The match container's programmatic focus has no decorative outline; button focus remains visible.

The checked-in `pacing.test.ts` adds 15 regressions, including complete no-input and batted match comparisons at 30/60/144 FPS for every speed, exact trajectory/marker comparisons, pause and frame-debt preservation. The prior v0.1 exploratory audit of 1,440 matches is historical baseline evidence; the results above are the current v0.3 checks.

To repeat the production smoke, keep `npm run preview` running and use a second PowerShell terminal:

```powershell
$env:CRICKET_PRODUCTION_URL = 'http://127.0.0.1:4173'
node node_modules/@playwright/test/cli.js test --grep 'production build'
```

## User review

Open `http://127.0.0.1:4173/` while the production preview is running. If it has stopped, run `npm run preview` in the project folder; rebuild with `npm run build` after source changes.

Start a Beginner chase, then try Club and Pro. Aim during run-up, watch release/bounce, then press A/S/D before arrival. Check whether the ball is easy to read, early/late advice helps the next swing, the outgoing pan is comfortable, and sound/contact feedback feels satisfying. Test pause/help and One More Chase. Arrows aim, A defends/ducks, S plays along the ground, D attempts a loft, and Escape pauses. Human batting-feel acceptance and hardware performance certification remain pending this review; the automated results do not stand in for them.
