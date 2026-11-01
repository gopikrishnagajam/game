# First-playable acceptance report

Release: Fun Cricket v0.1, first edition prepared for user review on November 1, 2026. The full Quick Chase loop is implemented and the checks below pass. This report separates automated evidence from subjective human playtesting. Further development is held for the user's review.

## Implemented scope

| Area | Implementation and evidence |
|---|---|
| Match | Both teams, three difficulties, fixed 16/24/32 targets, four-batter rosters, two overs, three wickets, immediate win/loss, scorecard and clean replay. Match reducer, headless match tests and browser match completion tests. |
| Batting | Eight directions; retained selection; one A/S/D commitment; fixed timing windows; assisted shot family; actual moving-blade collision; contact-driven launch; defense/duck; ground/loft/mishit classification. Batting, animation, timing-coverage and full game tests. |
| Bowling | Fast, medium, off-spin and leg-spin; pace then spin over; seeded weighted tactics and legal variation; immutable delivery/field before run-up; truthful late marker. Bowling/physics tests and complete matches. |
| Fielding/scoring | Continuous geometric ground interception, finite rolling stop, boundary crossing, aerial first-landing rings, geometric catch/drop eligibility and confidence formula. Fielding and actual gameplay scenario tests. |
| Confidence | Personal last-three raw execution records; neutral missing slots; initial 50%; fixed timing; bounded power/precision; current delivery uses pre-delivery value. Confidence, match and integration tests. |
| Presentation | Original articulated 3D players, cricket equipment/strokes, stance/footwork/recovery, fixed camera/stadium, compact HUD, confidence meter, over history, actual off-screen tracker, synthesized sound, brief wickets and milestones. Browser screenshots and animation contracts. |
| Application | Locally runnable static browser app, assets/fonts included, pause/focus handling, production debug exclusion, source/docs, automated tests and production build. Type check, build and browser smoke. |

No visible fielders, keeper, umpire, non-striker, running, extras, dynamic camera, extra modes, progression, backend or online account dependency were added.

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
| Q: off-screen ball | Browser tracker uses actual world position; camera matrix stays unchanged |
| R: frame-rate variation | Identical timestamped inputs at 30/60/144 Hz; native browser input between deferred frames |
| S: geometric equality | Ring thresholds, exact boundary, closed circle edges, tangencies and interception ties in `fielding.test.ts` |

## Presentation inspection and known limits

The menu, setup, live scene, contact, tracker and results were inspected through captured browser screenshots. The original GLB export round-trips through the Three.js loader with sixteen animation clips. Animation tests check shared contact geometry, footwork, recovery and reachable arm positions.

The sixteen scenarios in specification section 29.3 have automated coverage or corresponding deterministic mechanics checks, but **a human keyboard playtest of all sixteen has not been performed**. Batting feel, ball readability on different displays, target balance and repeated-match enjoyment still need user playtesting. Those subjective acceptance points are not marked conclusively passed.

Character motion is original articulated animation with procedural joint positioning, not motion capture. The models are stylized. Aerodynamics use gravity, linear drag and configured movement; catches resolve at first landing; LBW uses actual pads plus a simplified legal-line/stump projection model. These are documented arcade simplifications.

The 60 FPS hardware target has not been certified on a named consumer desktop GPU. Headless software WebGL is used for functional browser checks, not as a representative hardware benchmark. Desktop keyboard play is supported; mobile controls are outside v0.1.

## Final check results

Verified on November 1, 2026, using Windows, Node.js 22.14.0 and Playwright Chromium. Browser checks use a 1440 × 900 viewport and software WebGL.

| Check | Result | Evidence |
|---|---|---|
| Unit and integration suite | 132 passed across 12 test files; zero failures | `tests/artifacts/unit-results.json` |
| TypeScript | `npm run check` passed; final production build also runs `tsc --noEmit` | Build's typecheck plugin in `vite.config.ts` |
| Browser suite | 12 passed; the separate production smoke is intentionally skipped in this development run | `tests/artifacts/browser-results.json`, `browser-run.log` |
| Production smoke | 1 passed against the final `dist/` build at `http://127.0.0.1:4173/` | `tests/artifacts/production-results.json`, `production.png`, `production-run.log` |
| Production build | `npm run build` passed; complete static output in `dist/` | Main JS 69.71 kB and Three.js chunk 481.97 kB, before gzip |
| Original character export | Loaded successfully through Three.js `GLTFLoader.parseAsync`; all 16 animation clips present | `public/assets/fun-cricket-batter.glb` and asset manifest |

The browser suite verifies real physical victories and defeats, both teams, all three difficulty targets, shot locking and repeat suppression, focus-loss pause, input timestamps between render frames, fixed camera, live ball tracking and clean replay. The production smoke verifies team setup, pause, return to menu, zero external requests, and absence of developer hooks. Neither browser run reported page or console errors.

The final interface fixes restore Home navigation from match results, Space activation of focused buttons, isolation of gameplay keys inside How to Play, prior pause state after closing help, and keyboard focus through screen and pause transitions. Three browser regressions cover the repaired behaviors. The match container's programmatic focus has no decorative outline; button focus remains visible.

An additional exploratory seeded audit ran 1,440 complete physical matches: 120 seeds across three difficulties and four strategies (no input, ideal defense, ground and loft). Every match completed without stalls, invalid positions, excess balls/wickets or roster errors. This audit supplements the repeatable checked-in test suite.

To repeat the production smoke, keep `npm run preview` running and use a second PowerShell terminal:

```powershell
$env:CRICKET_PRODUCTION_URL = 'http://127.0.0.1:4173'
node node_modules/@playwright/test/cli.js test --grep 'production build'
```

## User review

Open `http://127.0.0.1:4173/` while the production preview is running. If it has stopped, run `npm run preview` in the project folder; rebuild with `npm run build` after source changes.

Start a Beginner chase, then try Club and Pro. Check how early to press A/S/D, ball readability, stroke feedback, pause/help behavior, and One More Chase. Arrows aim, A defends/ducks, S plays along the ground, D attempts a loft, and Escape pauses. Human batting-feel acceptance and hardware performance certification remain pending this review; the automated results do not stand in for them.
