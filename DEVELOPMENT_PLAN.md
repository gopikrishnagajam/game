# Fun Cricket v0.1 development plan

Status: implementation in progress. See `docs/ACCEPTANCE.md` for verified release status.

Source of authority: `instructions.md`, master specification v0.1. This plan preserves its locked behavior; numerical tuning and technical choices below are implementation decisions. The workspace currently contains only the specification.

## 1. Release scope

Deliver the complete desktop browser Quick Chase: two overs, at most twelve legal balls, three wickets, Team Blue or Team Yellow, four batters per team, and Beginner/Club/Pro targets of 16/24/32. Over one uses fast or medium pace; over two uses off-spin or leg-spin.

Arrow keys select eight directions; A defends/ducks, S plays grounded strokes, and D attempts lofted strokes. One shot commitment locks direction and shot type per delivery. Preserve tapped directions, ignore repeated shot keydown events, and resolve opposing arrows deterministically by cancelling the opposing axis and retaining the last valid selection when no direction remains.

Keep one stationary camera, authentic right-handed batting, individual confidence, physical ball movement, invisible geometric fielding, tactical bowling, an off-screen tracker, and fast match replay. Honor every exclusion in specification section 2.2, including visible fielders, running, extras, additional modes, and camera movement.

## 2. Technical architecture

Use TypeScript, Vite, Three.js, GLB character/animation assets, ordinary DOM/CSS for interface, and browser audio. Use Vitest for simulation tests and Playwright for browser integration. There is no backend.

Proposed source structure:

```text
src/
  core/          configuration, seeded RNG, simulation clock, shared types
  match/         authoritative state, lifecycle, roster, strike, result reducer
  input/         keyboard state, direction resolution, timestamped commitments
  bowling/       archetypes, delivery generation, tactical weights, field presets
  physics/       integration, bounce, swing, spin, bat/pad/stump collisions
  batting/       shot compatibility, timing, raw execution, contact, launch
  confidence/    individual history, contribution mapping, modifiers
  fielding/      boundary, segment-circle interception, landing classification
  scoring/       outcome precedence and distance-to-runs rules
  animation/     rig sampling, clip metadata, blending, procedural adjustments
  rendering/     scene, fixed camera, characters, ball, marker, lighting
  ui/            menu, setup, HUD, feedback, tracker, results
  audio/         loading, contact/bounce/stump/UI sounds
  debug/         development-only overlays and deterministic scenario controls
public/assets/   models, animations, audio, license manifest
tests/           unit, integration, deterministic scenarios, browser tests
docs/            mechanics, architecture, acceptance evidence
```

Simulation modules must run without WebGL or DOM. One authoritative state owns match and delivery data; rendering, audio, and HUD consume it. Resolve each delivery exactly once through an outcome event and an atomic match update.

Record match seed, configuration version, delivery commitments, and simulation-time input events for reproducible developer diagnostics. This is a testing facility, not a player-facing replay mode.

## 3. Shared simulation and animation contract

- Use meters and seconds; Y is up, +Z points from striker toward bowler, and -X is the right-handed batter's off side (screen right when viewed from the fixed camera at -Z). Put the scoring origin at the striker. All physics, fielding, tracker, and rendering transformations use this convention.
- Start with a 120 Hz fixed simulation step and rendering interpolation. Timestamp inputs against the simulation clock. Pause on focus loss, clear held keys, and resume without advancing through hidden-tab elapsed time. Under load, preserve unresolved physics events rather than jumping the ball forward.
- Use swept collision checks for fast ball movement and moving bat geometry. Choose the earliest valid event within each step and process the remainder consistently.
- Drive character poses and bat colliders from the same animation time. Rendering interpolation must keep ball and bat aligned. Each stroke clip supplies lead time, contact phase, bat attachment/contact geometry, footwork family, and recovery duration.
- Predict bounce and expected contact using the same integrator and committed delivery parameters as live play. Predictions support animation selection and the truthful pitch marker; they never replace actual contact detection or scoring.
- Ideal input time equals expected arrival time minus the selected animation's lead time. Timing quality and spatial overlap both matter. Never force the ball onto the bat or launch it from an unrelated point.
- Apply bounded procedural adjustments to foot placement, torso, arms, and bat alignment. Preserve unsuitable direction choices and genuine misses. Contact response uses bat movement, ball velocity, contact offset, shot intent, timing, and pre-delivery confidence.
- S remains grounded and never catchable. D is catchable only when the resulting trajectory meets configured genuine-airborne criteria; a failed loft uses ground rules. Document and test that classification.

Animation assets are an early dependency. Create original rigged players and authored cricket clips, or use assets with verified licenses. Validate the complete required clip inventory in specification section 9.2. Temporary development geometry cannot satisfy final character or animation acceptance. If a clip is unavailable, author it before closing the affected milestone.

## 4. Locked mechanics and explicit implementation rules

### Timing and confidence

Initial perfect/good/outer timing thresholds in milliseconds are A: 70/140/210, S: 45/95/160, D: 35/75/130. These remain fixed across difficulty, confidence, and match situation.

Each batter starts at 50% confidence. Keep exactly three personal contribution slots, padding missing history with zero:

`confidence = clamp(50 + sum(three contributions) / 3, 0, 100)`

Use the specified anchors: perfect +50, good +25, average 0, poor -35, miss -50, successful defense +10, successful duck/leave 0. Interpolate ordinary execution contributions continuously. Update history from raw execution only, after the outcome. Current-shot modifiers use confidence captured before the delivery; they cannot change timing windows. Cap the initial relative power adjustment at 8% and preserve strong shots at zero confidence and failures at full confidence.

### Geometry and scoring

Begin with a 65 m circular boundary, 3 m catching circles, 5 m interception circles, and scoring thresholds at 12/25/40/55 m, all configurable.

- Lofted shots: first landing outside the boundary scores six before any catch check. Inside the boundary, a landing in a catching circle permits one seeded catch draw: `P(caught) = 1 - 0.002 * confidence`. An uncaught landing scores 0/1/2/3/4 by ring, then resolves immediately.
- Grounded shots: compare interception and boundary events in physical travel order. Stop at the earliest valid interception; otherwise resolve boundary crossing or natural stopping. Interior stops/interceptions score at most three; reaching the boundary scores four. Never award six or a catch.
- Ring intervals are lower-inclusive and upper-exclusive. Exact 12/25/40/55 m lofted landings enter the higher ring. For aerial landings, exactly the boundary radius is inside; strictly beyond is six. A grounded ball reaching the boundary scores four. Catch/interception circle edges are inclusive. Define a common numerical tolerance and stable tie rules; for exactly simultaneous ground interception and boundary arrival, interception wins.
- Bowled requires swept ball-stump contact. Simplified LBW requires a valid pad collision before bat contact, an eligible pitching/impact line, and projected stump intersection using the same physics model. Document its simplifications explicitly; shot direction alone can never cause a dismissal.

### Bowling and match updates

Select and freeze delivery parameters and the virtual field before run-up. AI reads only completed delivery history. Difficulty strategy weights are Beginner 80/15/5, Club 60/30/10, Pro 45/40/15 for normal/tactical/surprise. Tactical weighting starts at 70% recent patterns, 20% match situation, 10% confidence.

Apply a resolved result to the batter who actually faced the ball: record balls, runs/dismissal, raw history, and team totals once. Check terminal victory/third-wicket/twelve-ball conditions before preparing another delivery. For continuing play, replace a dismissed striker, apply any odd-run strike swap, then apply the over-end swap. A wicket on ball six therefore brings in the replacement before the over swap. Never request a fifth batter.

## 5. Lifecycle

Implement the specification's explicit lifecycle:

`MAIN_MENU -> MATCH_SETUP -> PRE_DELIVERY -> BOWLER_RUNUP -> BALL_IN_FLIGHT -> SHOT_COMMITTED -> CONTACT_RESOLUTION -> BALL_OUTCOME -> RESULT_FEEDBACK`

After feedback, take the applicable wicket, milestone, and over transitions in deterministic order, then prepare the next delivery or enter `MATCH_COMPLETE`. Treat shot commitment as delivery state so ball simulation continues during animation. A no-input delivery bypasses shot commitment and still resolves physically as a dismissal or legal dot. Terminal results prevent further deliveries; brief outcome presentation may finish before the result screen.

Pause/resume is an overlay on this lifecycle. Space may shorten resolved presentation only. Gate match start on required asset loading and make restart dispose/reset transient state and listeners cleanly.

## 6. Implementation milestones and exit gates

Follow the specification's milestone order. Each milestone must leave runnable code and pass its gate before proceeding.

| Milestone | Implementation | Exit gate |
|---|---|---|
| 1. Functional 3D scene | Scaffold app/config/state/test harness; ground, pitch, creases, stumps, boundary, lighting, fixed camera, rigged batter and bowler, ball, basic interface; asset inventory. | Scene loads locally; full batter, bat, release area, and incoming delivery corridor are readable. Rig and bat attachment are suitable for authored cricket motion. |
| 2. Delivery physics | Four bowling styles, release alignment, legal delivery generator, gravity, swing/seam, bounce, spin, friction, arrival prediction, late marker. | Seeded fixtures reproduce bounce/contact locations; opposite stock spin directions work; marker matches bounce; release comes from bowler's hand. |
| 3. Controls and animation | Eight directions, retained selection, shot commitment, repeat suppression, complete shot-family selection, front/back-foot movement, clip blending and contact metadata. | Full/off-side and short/body deliveries select appropriate distinct strokes. Input locks once; collider and visible bat follow the same pose. Required clip inventory is complete. |
| 4. Contact and shot physics | Fixed timing thresholds, swept bat-ball collision, clean/mistimed/edge/miss responses, grounded/aerial launch, grounded mishits, stumps/pads and simplified LBW. | A deterministic batting matrix verifies visible contact, launch, timing labels, unsuitable choices, and continued ball travel on misses. No teleportation or timing-only fabricated hit. |
| 5. Invisible fielding and scoring | Frozen presets, landing detection, catch eligibility, interception, boundary, rings, seeded catch/drop handling with injected confidence. | Geometry tests cover all scoring paths, event ordering, exact edges, overlapping zones, and high-speed crossings. Actual ball movement explains each result. |
| 6. Confidence and bowling AI | Personal rolling history, raw/effective quality separation, bounded modifiers, catch formula, tactical delivery and field selection. | Confidence anchors and rollover pass. Identical seeds/inputs reproduce results. AI commitments cannot change after observing current input; timing thresholds remain unchanged. |
| 7. Full Quick Chase | Team/difficulty setup, targets, four-batter rosters, score updates, strike changes, pace-to-spin over change, replacements, immediate terminal conditions, results and replay. | Full two-over matches work; early wins, final-ball outcomes, third wickets, wickets on over end, and odd sixth-ball runs resolve correctly; repeated restart is clean. |
| 8. Final presentation | Finished HUD/history, confidence, off-screen tracker, sound, milestone bat raise, brief wicket celebration, loading/focus handling, fast transitions, menu polish. | All required UI works from real state; tracker shows live movement only; camera stays fixed; complete acceptance suite and representative manual matches pass. |

The critical gate is milestone 4. Do not progress to presentation polish while animation and physical contact disagree. Milestones 5-8 remain mandatory for the release.

## 7. Verification and tuning

Maintain a traceability checklist mapping specification sections 25 and 32 to code, automated scenarios, and manual evidence. Do not equate compilation with gameplay completion.

- Unit tests: directions and locking; shot compatibility; timing invariance; confidence neutral slots/rollover/persistence; catch probability endpoints; trajectory and circle intersections; ring/boundary equality; catch exclusion for grounded shots; seeded selection; all score, wicket, strike, and match-ending rules.
- Integration tests: animation release/contact timestamps; bat collider alignment; input-to-contact-to-launch; confidence application; physical outcome-to-HUD update; over change and replacement; tracker projection; focus loss and restart.
- Deterministic scenarios: all specification section 25 cases A-S, including zero-confidence perfect hits, full-confidence misses, dropped catches, ground mishits, and no-input resolution. Re-run the same timestamped inputs under varied render frame rates and verify identical simulation results.
- Browser checks: successful load and production preview, working menus/controls, representative complete matches, no console errors, fixed camera, asset readiness, and clean repeat play.
- Manual play: all sixteen scenarios in section 29.3 across all difficulties. Assess cricket posture, contact readability, ball visibility, shot responsiveness, and whether good shots feel satisfying. Record issues and fix them before sign-off.
- Performance: profile a named desktop/browser at a documented resolution, aiming for 60 FPS; check input latency, startup size, allocations, repeated matches, and dropped-frame behavior. Report measured results rather than assuming the target is met.

Use developer-only views for trajectory, arrival/contact time, bat geometry, raw/effective quality, confidence, virtual fields, catch draws, and outcome reasons. Keep future trajectories and fielding circles out of ordinary gameplay.

Tune configurable pace, movement, lead times, launch, friction, marker visibility, and presentation durations through playtesting. Begin with the specification's values; record significant balance changes. Never tune away locked rules or vary timing windows by difficulty.

## 8. Delivery checklist

- Complete browser-runnable source and production build.
- README with setup, controls, development, testing, build, and local preview commands.
- Centralized typed gameplay configuration distinguishing locked invariants from tuning values.
- Architecture/state-machine documentation and explanations of contact, confidence, bowling, fielding, scoring, and equality rules.
- Automated mechanics and browser tests plus deterministic test fixtures.
- Original/properly licensed model, animation, and audio manifest with attribution where required.
- Completed acceptance report with test/playtest evidence and candid remaining limitations.

Implementation starts with milestone 1. Completion means all eight milestones and the release acceptance checklist pass; an attractive scene or isolated batting demo is insufficient.
