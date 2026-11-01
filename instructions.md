# FUN CRICKET
## Master Build Specification & Agent Implementation Prompt
**Version:** 0.1 — First Playable Release  
**Platform:** Desktop web browser  
**Category:** 3D arcade cricket batting game  
**Primary mode:** Two-over Quick Chase  
**Development objective:** Deliver a genuinely playable, technically complete game, not a mockup or animation demonstration.

---

# 0. YOUR ROLE AND PRIMARY INSTRUCTIONS

You are a senior game developer, 3D gameplay engineer, animation systems engineer, frontend developer, and gameplay QA engineer.

Your task is to build a complete browser-based cricket batting game called **Fun Cricket**, from scratch, according to this specification.

The game takes inspiration from two classic experiences:

- **Stick Cricket:** Simple batting-focused gameplay, an uninterrupted fixed point of view, rapid deliveries, immediate scoring feedback, minimal unnecessary animations, and high replayability.
- **EA Sports Cricket 07:** Authentic cricket batting strokes, realistic player proportions, believable footwork, natural bat movement, cricket-style shot selection, and convincing 3D batting presentation.

Fun Cricket is **not** a full cricket simulator.

The central objective is to make batting satisfying, challenging, and skill-based through a small set of controls and a well-designed 3D animation and physics system.

### Non-negotiable development instructions

1. Follow the agreed gameplay specification faithfully.
2. Do not introduce features that fundamentally change the gameplay.
3. Prioritize the quality of batting over graphics, menus, or additional modes.
4. Implement functional mechanics rather than visual approximations or fake interactions.
5. Keep gameplay calculations deterministic wherever possible, with explicitly seeded randomness for probabilistic mechanics.
6. Separate physics, animation, batting, bowling, scoring, confidence, and match management into independent systems.
7. Never substitute a random scoring outcome for actual ball trajectory calculations.
8. Do not change the fixed camera after the game begins.
9. Do not add fielders, a wicketkeeper, umpires, running animations, replay cameras, or cinematic celebrations.
10. Keep all major gameplay parameters configurable.
11. Provide a working, locally runnable browser game with source code.
12. Implement the complete first-playable release, not merely its first development milestone.
13. Test the actual integration between input timing, animation, physical ball trajectory, scoring, and match state.

### Design authority

Distinguish between:

- **LOCKED:** Explicitly agreed gameplay behavior. Do not change.
- **CONFIGURABLE:** Numerical parameters that can be adjusted without changing behavior.
- **IMPLEMENTATION DETAIL:** A technical choice required to make an agreed feature functional.

Where this specification provides suggested values, place them in centralized configuration rather than hardcoding them throughout the application.

Do not invent tournaments, progression systems, extra characters, player upgrades, or additional game modes.

---

# 1. PRODUCT VISION

Fun Cricket should feel like a modern, lightweight, browser-playable cricket game with the straightforward accessibility of Stick Cricket and the visual authenticity of a classic 3D cricket game.

The player controls batting exclusively.

The player reads deliveries, selects a shot direction, and executes a batting stroke at the right moment.

Shot quality depends on:

1. Incoming delivery properties.
2. Player-selected batting direction.
3. Selected shot type.
4. Timing accuracy.
5. Bat-ball contact quality.
6. Individual batsman confidence.

The resulting trajectory interacts with an invisible geometric fielding system to determine runs and dismissals.

The player should feel rewarded for:

- Correct shot selection.
- Accurate timing.
- Reading pace and spin.
- Finding gaps in field placements.
- Maintaining batsman confidence.
- Managing strike rotation.
- Chasing targets under pressure.

A perfectly timed cover drive should feel satisfying even when it does not score a boundary.

A badly timed shot must look and behave differently from a well-timed shot.

**Primary gameplay principle: Easy to learn, difficult to master.**

---

# 2. BASE VERSION SCOPE

## 2.1 Included features — LOCKED

The initial release contains:

- One playable Quick Chase mode.
- Two overs per match.
- Twelve legal deliveries maximum.
- Three wickets available.
- Two fixed teams.
- Team Blue and Team Yellow.
- Three selectable difficulty levels.
- Beginner, Club, and Pro.
- A fixed predefined batting lineup.
- Individual batsman scores and confidence.
- Realistic internal strike rotation.
- Fast, medium-pace, off-spin, and leg-spin bowling archetypes.
- Weighted tactical bowling.
- One fixed 3D batting camera.
- 3D batsman and bowler.
- Realistic batting animations.
- Directional keyboard controls.
- Defensive, grounded, and lofted batting.
- Smart-assisted shot animation selection.
- Physical 3D ball trajectories.
- Subtle late-appearing pitch marker.
- Invisible geometric fielding.
- Geometric catching and run scoring.
- A small off-screen 2D ball tracker.
- Live scoreboard and confidence meter.
- Simple wicket and batting-milestone animations.
- Match completion and immediate replay.

## 2.2 Excluded features — LOCKED

Do not implement:

- Full two-innings match simulation.
- User-controlled bowling.
- Fielding controls.
- Visible 3D fielders.
- Wicketkeeper models or animations.
- Umpire models or animations.
- Running between wickets.
- A visible non-striker character.
- Player walking or batting-entry animations.
- Full player-specific batting styles.
- Detailed character customization.
- Multiplayer.
- Online matchmaking.
- Tournaments.
- Career mode.
- Progression ladders.
- Character unlocks.
- Permanent player upgrades.
- Multiple stadiums.
- Commentary.
- Replays.
- Dynamic camera angles.
- Camera-following-ball behavior.
- Dramatic celebrations.
- Mobile-specific gameplay systems.
- Power charging or conventional power meters.
- Manual front-foot and back-foot controls.
- Separate shot-type buttons for every cricket stroke.
- Wides, no-balls, or other extras in v0.1.

Keep the initial release focused.

---

# 3. TECHNICAL FOUNDATION

## 3.1 Recommended stack

Use:

- TypeScript for game logic.
- Three.js for real-time 3D rendering.
- Vite for the browser application and development environment.
- GLTF/GLB for rigged character and animation assets.
- A lightweight reactive UI layer or ordinary TypeScript DOM for menus and HUD.
- Custom cricket-specific ball simulation.
- Browser keyboard input for gameplay.
- Browser-compatible audio playback for lightweight sound effects.

Avoid introducing a heavy gameplay framework unless it demonstrably simplifies the implementation.

Do not require a backend server for the base game.

All matches, scoring, and AI decisions may run locally in the browser.

## 3.2 Suggested module boundaries

Organize the application into logically separate systems.

**Core**

- Game initialization.
- Game configuration.
- Global game state.
- Frame timing and update loop.
- Seeded random generator.
- Match state machine.

**Rendering**

- Scene setup.
- Lighting.
- Camera.
- Ground and pitch.
- Character models.
- Bat and ball.
- Wickets.
- Animation mixer and controller.

**Gameplay**

- Input manager.
- Delivery generator.
- Bowling AI.
- Ball trajectory simulator.
- Ball bounce simulator.
- Shot selection.
- Batting animation controller.
- Contact evaluator.
- Confidence evaluator.
- Fielding geometry.
- Scoring engine.
- Wicket detection.
- Strike rotation.
- Match controller.

**Interface**

- Main menu.
- Team selection.
- Difficulty selection.
- Live scoreboard.
- Confidence meter.
- Delivery outcomes.
- Off-screen ball tracker.
- Match result screen.

**Testing**

- Physics and trajectory tests.
- Fielding-zone geometry tests.
- Confidence tests.
- Strike rotation tests.
- Scoring tests.
- Bowling-weight tests.
- Match lifecycle tests.
- Browser integration tests.

Maintain a single authoritative game state. The scoreboard and HUD must derive information from that state.

---

# 4. CAMERA AND VIEWPORT — LOCKED

## 4.1 Fixed camera

The camera must remain stationary for the entire match.

Position it slightly elevated behind the striker, looking toward the bowler and far end of the pitch.

The camera must show:

- The batsman's full body.
- The cricket bat.
- The batting crease.
- The incoming ball.
- The pitch and bowler.
- A useful portion of the outfield.

Its projection should provide adequate depth perception for judging the approaching delivery.

Choose a camera distance and field of view that make the bat swing and ball trajectory readable.

The game should resemble a fixed-camera arcade cricket experience but retain convincing 3D perspective.

## 4.2 Absolutely no camera changes

The camera must not:

- Follow a struck ball.
- Pan toward the boundary.
- Tilt after contact.
- Zoom for a wicket.
- Switch to a fielding perspective.
- Cut to a celebration.
- Rotate during an over.
- Play a replay animation.
- Use automatic cinematic tracking.

This is a central design decision.

All batting, wicket, milestone, and bowling animations occur within the same continuous camera view.

---

# 5. TEAMS AND PLAYER MODELS

## 5.1 Teams — LOCKED

Exactly two teams:

**Team Blue**

- Predominantly blue jersey.
- Matching or complementary blue equipment accents.

**Team Yellow**

- Predominantly yellow jersey.
- Matching or complementary yellow equipment accents.

Selecting one team automatically makes the other team the bowling opposition.

No additional teams.

## 5.2 Batting players

For v0.1, define four batsmen per team:

- Batter 01 — opening striker.
- Batter 02 — opening non-striker.
- Batter 03 — first replacement.
- Batter 04 — second replacement.

This supports the agreed three-wicket limit.

Each batter has a fixed identity within the roster.

All batsmen share:

- The same basic 3D character rig.
- The same equipment geometry.
- The same animation library.
- The same baseline batting abilities.
- The same timing rules.

Permitted appearance variations:

- Team jersey color.
- A small predefined range of natural skin tones.
- Minor equipment color changes, if useful.

Do not associate skin tone with performance attributes.

No character-specific powers, boosts, or permanent upgrades.

Use one right-handed batting animation system for the base version.

Left-handed batting is outside v0.1 scope.

## 5.3 Bowler models

Use a shared bowler rig and appropriate team uniform.

The bowler may use distinct animation families for pace and spin.

Define a small fixed roster representing:

- Fast bowler.
- Medium-pace bowler.
- Off-spinner.
- Leg-spinner.

Do not create individual celebrity likenesses.

Use original character assets and animations.

---

# 6. CONTROL SYSTEM — LOCKED

The game uses two-stage batting input.

## 6.1 Stage 1 — Direction

Arrow keys determine the intended shot direction.

Use eight logical directional regions.

| Input | Intended region |
|---|---|
| Up | Straight down the ground |
| Up + Left | Midwicket / long-on |
| Up + Right | Covers / long-off |
| Left | Square leg |
| Right | Point / square off side |
| Down + Left | Fine leg |
| Down + Right | Third man |
| Down | Late or behind-square region |

Assume a right-handed batsman.

Direction mapping must correspond to leg-side and off-side cricket conventions from the chosen camera perspective.

For Down alone, the assistance system should choose the appropriate late-shot family based on the incoming ball's actual line. It must not guarantee that an unsuitable ball can be played safely behind square.

## 6.2 Direction selection behavior

Direction is continuously adjustable before shot execution.

The player may:

- Tap an arrow key to select a direction.
- Hold a direction.
- Combine compatible arrow keys for diagonals.
- Change the selected direction while the ball approaches.

The most recently selected valid direction remains active until changed or until the shot is executed.

The initial default direction can be Straight.

Opposing simultaneous inputs, such as Left and Right, should be handled predictably without causing unstable direction changes.

When the player presses A, S, or D, the current direction is locked for that delivery.

Subsequent arrow presses must not redirect an already committed shot.

## 6.3 Stage 2 — Shot execution

Use three shot buttons:

| Key | Shot |
|---|---|
| A | Defend / duck |
| S | Grounded batting stroke |
| D | Lofted batting stroke |

The shot key is also the timing input.

There is no separate swing-confirmation button.

There is no shot-power charging mechanic.

The player presses the desired shot key at the moment they anticipate the bat must begin its swing.

Each delivery accepts one committed shot action.

Holding a shot key must not repeatedly trigger batting animations.

## 6.4 Shot intent

**A — Defense**

- Performs an appropriate defensive stroke.
- Can automatically duck or sway beneath a sufficiently high bouncer.
- Generally safe against ordinary pace bowling.
- Does not deliberately generate powerful scoring shots.
- Remains vulnerable to genuinely threatening yorkers and incorrectly judged spin.
- Correctly executed defense can improve confidence despite scoring zero.

**S — Grounded**

- Attempts a controlled stroke designed to travel along the ground.
- Appropriate animation depends on the delivery and direction.
- Can score 0, 1, 2, 3, or 4.
- Cannot produce a caught dismissal under the agreed gameplay rules.

**D — Lofted**

- Attempts an aerial stroke.
- Can produce a six.
- Can be caught if its first landing position intersects an invisible catching zone.
- Should be harder to execute cleanly than an ordinary grounded stroke.
- A severely mistimed attempt may fail to become airborne and behave as a grounded mishit.

Do not automatically reward lofted shots with more runs.

---

# 7. DELIVERY AND BALL SIMULATION

## 7.1 Required delivery properties

Every generated delivery must have:

- Bowler identity.
- Bowling style.
- Initial release position.
- Initial velocity.
- Speed.
- Intended line.
- Intended length.
- Actual landing position.
- Bounce behavior.
- Swing or seam movement, when applicable.
- Spin and turn, when applicable.
- Arrival time near the batsman.
- Expected ball height at the batting contact region.

## 7.2 Ball trajectory

Use genuine continuously updated 3D positions.

The ball should exhibit:

- Forward velocity.
- Gravity.
- Airborne movement.
- Plausible lateral movement for swing.
- Contact with the pitch.
- Bounce.
- Appropriate changes to velocity after bounce.
- Sideways turn for spin.
- Friction and rolling after ground contact.
- Physically coherent flight after being struck.

It is not necessary to implement a scientifically exact aerodynamics simulator.

However, the ball must behave coherently, and the displayed movement must be linked to the actual gameplay calculations.

Do not visually display one trajectory while scoring from an unrelated random calculation.

## 7.3 Bowling legality

All deliveries count as legal balls in the initial release.

Do not implement wides, no-balls, free hits, extras, or re-bowling.

Ensure generated lines and lengths remain within the game's playable, legal-delivery model.

A wide yorker may be included as a difficult but legal delivery.

## 7.4 Spin behavior

For right-handed batting:

- A conventional right-arm off-break generally turns from off toward leg.
- A conventional right-arm leg-break generally turns from leg toward off.
- Arm balls and googlies can alter the expected turn.

These differences should be visible in the actual ball movement after pitching.

Avoid arbitrary changes to the ball's path after the player has selected a shot.

---

# 8. PITCH MARKER — LOCKED

A subtle projected marker indicates the ball's anticipated bounce location.

## 8.1 Visual design

- Small circular ring.
- Low visual opacity.
- Positioned on the pitch surface.
- No oversized crosshair.
- No visually distracting glow.
- No trajectory line revealing where the ball will travel after pitching.

## 8.2 Timing

The marker appears after the bowler releases the ball.

At Club difficulty, begin by showing it approximately one-third of the way into the ball's flight.

This is a tunable starting value.

The marker should appear later or become subtler on higher difficulties.

It fades as the ball reaches the pitch.

## 8.3 Accuracy

The marker must indicate the actual expected bounce location.

It must not deliberately mislead the player.

Swing, seam, and spin can still affect the ball after the marker appears.

For spinners, the marker does not reveal the amount or direction of post-bounce turn.

Difficulty may change marker visibility, never its truthfulness.

---

# 9. BATTING ANIMATION SYSTEM

This is one of the highest-priority parts of the project.

The animations must look like authentic cricket batting.

Do not implement a rigid character that merely rotates a bat when a key is pressed.

## 9.1 Required character states

The striker moves through:

1. Ready stance.
2. Delivery observation.
3. Small anticipatory footwork adjustments.
4. Committed stroke preparation.
5. Bat swing.
6. Contact or missed contact.
7. Follow-through.
8. Recovery to ready stance.

The bowler moves through:

1. Preparation.
2. Run-up or delivery preparation.
3. Bowling action.
4. Ball release.
5. Follow-through.
6. Return to ready state.

A wicket may trigger one brief bowler celebration.

## 9.2 Minimum batting animation families

Include believable animations for:

- Idle batting stance.
- Forward defense.
- Back-foot defense.
- Duck / sway.
- Front-foot straight drive.
- Cover drive.
- On-drive or flick.
- Back-foot punch.
- Square cut.
- Pull shot.
- Lofted straight drive.
- Lofted leg-side or off-side drive.
- Missed swing / recovery.
- Simple bat-raising milestone animation.

These may share underlying authored clips with carefully controlled blending and procedural adjustments.

Do not require a separate fully authored animation for every possible direction.

## 9.3 Smart-assisted animation selection — LOCKED

The player does not manually select individual cricket shots.

The game selects the appropriate animation based on:

- Delivery length.
- Delivery line.
- Bounce height.
- Incoming speed.
- Ball movement.
- Selected direction.
- Shot type.

Examples:

| Delivery | Player input | Animation |
|---|---|---|
| Full outside off | Up + Right, S | Cover drive |
| Full on middle | Up, S | Straight drive |
| Full on leg | Up + Left, S | On-drive or flick |
| Short outside off | Right, S | Cut |
| Short toward body | Left, S | Pull |
| Full outside off | Up + Right, D | Lofted cover drive |
| Full on middle | Up, D | Lofted straight drive |
| Good-length pace | A | Forward/back-foot defense |
| High bouncer | A | Duck / sway |
| Full yorker | A | Low defensive bat-down |
| Short outside off | Right, D | Upper-cut-style lofted attempt |

This is animation assistance, not automatic shot success.

A player who chooses an unsuitable direction or badly times the shot must still suffer the consequences.

## 9.4 Authentic footwork

Automatically select front-foot or back-foot preparation based on delivery length and bounce.

Front-foot strokes require a plausible forward weight transfer.

Back-foot strokes require a plausible backward weight shift.

Footwork must not appear independent of the incoming delivery.

The player does not manually control footwork.

## 9.5 Contact synchronization

The bat must visually reach the ball at the same moment used by the contact simulation.

Do not:

- Launch the ball before bat contact.
- Show the bat passing through the ball without explanation.
- Complete a swing while the ball is still approaching.
- Play a perfect contact animation when the bat actually misses.
- Apply a scoring result disconnected from bat-ball geometry.

Use animation contact frames and a bat-associated contact region.

Blend animations carefully to avoid unnatural snapping.

---

# 10. TIMING SYSTEM — LOCKED

Timing windows are fixed.

They do not change with:

- Batsman confidence.
- Difficulty level.
- Score.
- Target.
- Recent boundaries.
- Recent wickets.
- Tactical bowling state.

Different shot families may have different fixed windows.

## 10.1 Input timing

Pressing A, S, or D initiates the appropriate animation.

The animation takes time to reach its contact frame.

Therefore:

**Ideal shot input time = expected ball contact time − animation lead time.**

The exact lead time is configurable per animation family.

The player should learn when to press the shot key from the ball's movement.

## 10.2 Timing error

Calculate the difference between the bat's actual contact time and the ball's arrival at the expected contact region.

Use the absolute timing difference to classify contact.

Suggested initial tuning values:

| Shot | Perfect | Good | Mistimed outer limit |
|---|---|---|---|
| A — Defense | ±70 ms | ±140 ms | ±210 ms |
| S — Ground | ±45 ms | ±95 ms | ±160 ms |
| D — Loft | ±35 ms | ±75 ms | ±130 ms |

These are provisional calibration values.

The critical rule is that **they remain constant during gameplay**.

Beyond the mistimed outer limit, contact is generally missed unless physical bat-ball overlap justifies a weak edge or deflection.

## 10.3 Timing outcomes

**Perfect**

- Clean contact.
- Maximum ordinary shot precision.
- Strong, appropriate ball speed.
- Natural follow-through.

**Good**

- Solid contact.
- Slight loss of precision or power.
- Plausible minor directional deviation.

**Mistimed**

- Noticeable early or late contact.
- Altered bat angle or contact position.
- Reduced control.
- Possible weak hit, leading edge, inside edge, or outside edge.
- Greater risk of missing or creating a catchable lofted trajectory.

**Missed**

- Bat does not contact the ball.
- Ball continues toward its natural destination.
- Bowled or LBW may occur if physically justified.

## 10.4 Player feedback

Provide temporary, small labels:

- PERFECT!
- GOOD
- MISTIMED
- BEATEN!

These labels describe batting execution, not runs scored.

A perfectly timed shot can score zero.

A mistimed shot may occasionally score a boundary.

Keep run outcome feedback separate.

---

# 11. SHOT CONTACT AND TRAJECTORY GENERATION

Once a shot is committed:

1. Lock the selected direction.
2. Lock the selected shot type.
3. Choose the animation family.
4. Determine animation lead time.
5. Determine actual contact or miss.
6. Calculate timing quality.
7. Calculate the bat-ball contact point.
8. Apply confidence adjustments to effective contact quality.
9. Determine resulting ball speed and direction.
10. Determine launch angle.
11. Simulate the resulting trajectory.
12. Send the trajectory to the fielding and scoring system.

## 11.1 Directional quality

A selected direction is not guaranteed to be suitable for the delivery.

Examples:

- A full ball outside off is naturally suited to an off-side drive.
- A short ball into the body is naturally suited to a pull.
- A yorker outside off is difficult to loft across toward leg.
- A sharply turning delivery may beat an incorrectly aligned defensive bat.

Poor direction selection should alter the swing geometry and resulting contact.

Do not simply award a penalty percentage while showing an implausibly perfect batting animation.

## 11.2 Shot power

Do not add a user-controlled power meter.

Shot power emerges from:

- A/S/D shot class.
- Contact quality.
- Bat speed.
- Incoming ball speed.
- Batting animation.
- Direction suitability.
- Confidence adjustment.

A lofted shot should not automatically travel farther than every grounded shot.

## 11.3 Failed loft attempts

If the player selects D but contact is sufficiently poor that the ball only trickles, skims, or bounces immediately near the bat, classify the actual ball behavior as a grounded mishit.

It must not automatically become catchable just because the D key was pressed.

Only genuinely airborne lofted shots are eligible for the virtual catching system.

---

# 12. BATSMAN CONFIDENCE SYSTEM — LOCKED

Each batsman owns an individual confidence meter.

Range: **0%–100%**.

Starting value: **50%**.

The confidence meter and exact percentage are always visible in the live scoreboard for the current striker.

## 12.1 Three-delivery history

Confidence is calculated using only the individual batsman's three most recently faced deliveries.

Do not use the team's last three deliveries.

Do not use another batsman's deliveries.

If the batsman has faced fewer than three deliveries, missing entries are neutral.

If the batsman has faced none, confidence is 50%.

Confidence does not change while the batsman is at the non-striker's end.

## 12.2 Confidence calculation

Use the neutral baseline of 50%.

Initial calibration anchors:

| Raw execution quality | Contribution |
|---|---:|
| Perfect | +50 |
| Good | +25 |
| Average | 0 |
| Poor | −35 |
| Miss | −50 |
| Well-executed defense | +10 |
| Successful duck / leave | 0 |

For each recent delivery, calculate an execution-quality contribution.

Confidence = clamp(50 + average of the three contribution slots, 0, 100).

Missing history slots contribute zero.

Prefer continuous interpolation between quality anchors to avoid large jumps at label thresholds.

The three-delivery rolling window remains mandatory.

Examples:

- New batsman: 50%.
- Three perfect deliveries: 100%.
- Three complete misses: 0%.
- One perfect delivery and two empty history slots: approximately 66.7%.
- Three neutral deliveries: 50%.

## 12.3 Confidence must use raw execution quality

This is essential.

Evaluate the player's underlying shot execution **before applying confidence modifiers**.

Use that raw value to update the next confidence calculation.

Otherwise, low confidence could cause artificially worse confidence results, creating an unfair negative feedback loop.

## 12.4 Confidence effects

Confidence affects:

**Contact quality**

- Higher confidence makes marginally cleaner contact more likely.
- Lower confidence makes imperfect contact slightly less controlled.
- The player must still time the shot successfully.

**Shot precision**

- Higher confidence reduces unintentional direction deviation.
- Lower confidence modestly increases direction inconsistency on imperfect shots.

**Contact power**

- Higher confidence may provide a small effective-contact advantage.
- Keep the magnitude modest, initially around a maximum 5–8% relative power adjustment.
- Do not let confidence overpower shot timing.

**Catch survival**

- Confidence affects the probability that an eligible virtual catching opportunity is converted into a dismissal.

## 12.5 Confidence catch probability — LOCKED

For a valid lofted shot whose first landing point lies inside a fielder's catching circle:

**P(caught) = 1 − 0.002 × confidence**

Confidence is measured on a 0–100 scale.

| Confidence | Catch probability |
|---|---:|
| 0% | 100% |
| 25% | 95% |
| 50% | 90% |
| 75% | 85% |
| 100% | 80% |

If the catch succeeds, the batsman is out.

If it fails, register a dropped catch and award runs from the lofted ball's first landing position.

Use a seeded random draw for this one probabilistic mechanic.

This catch-survival model is an intentional arcade rule.

Do not secretly change fielder positions, catching radii, or ball trajectories after the shot to manufacture the outcome.

## 12.6 Confidence update timing

The current confidence affects the current delivery.

After the delivery is resolved:

1. Record the player's raw execution contribution.
2. Append it to that batsman's history.
3. Retain only the latest three entries.
4. Recalculate confidence.
5. Update the scoreboard.

Do not let the current shot retroactively alter its own pre-delivery confidence.

If a batsman is dismissed, their confidence history can remain in the completed scorecard, but the incoming replacement starts at 50%.

---

# 13. DEFENSIVE BATTING — LOCKED

The A button must provide a controlled defensive option.

## 13.1 Against pace

Ordinary, correctly timed defensive strokes should be relatively safe.

For high bouncers, A may cause a duck or sway.

Defense should not ordinarily produce substantial runs.

However, legitimate dismissal risks remain for:

- Missed yorkers.
- Completely mistimed defense.
- Balls that physically reach the stumps.
- Simplified LBW situations.

## 13.2 Against spin

Spin bowling must make defense more challenging.

A key scenario is right-arm off-spin turning from off toward the leg-side stumps.

If the player selects a defensive direction that fails to cover the actual post-bounce trajectory, a gap may open between bat and pad.

Possible outcomes:

- Successful defensive contact.
- Bat-pad contact.
- Missed defensive contact.
- Bowled.
- LBW.

Do not implement an automatic wicket whenever leg-side defense is selected against off-spin.

The dismissal must follow the simulated ball line, turn, bat position, and pad/stump interaction.

---

# 14. INVISIBLE FIELDING SYSTEM — LOCKED

There are no visible fielders.

All fielders exist as geometric entities in a 2D top-down representation of the ground.

## 14.1 Ground shape

Start with a circular playing field.

Keep the geometry configurable so an oval or elliptical boundary could be supported later.

The ground is centered around the batting/scoring origin for the simplified geometric model.

Use consistent world coordinates for:

- Ball movement.
- Fielding positions.
- Catching checks.
- Ground interceptions.
- Distance scoring.
- Off-screen tracker positions.

## 14.2 Virtual fielders

Each invisible fielder has:

- Fixed 2D position.
- Catching radius.
- Ground-interception radius.

Suggested starting values:

- Catching radius: approximately 3 m.
- Ground-interception radius: approximately 5 m.

These are tunable.

Different fielders may eventually have different radii, but the initial implementation can share common defaults.

No fielding movement is simulated.

No running, diving, throwing, or catching animations are shown.

## 14.3 Position locking

Fielder positions must be selected before the bowler begins a delivery.

They remain fixed throughout that delivery.

They may be changed only between deliveries.

The bowling AI can select from predefined field configurations.

It cannot reposition fielders in response to the current shot.

## 14.4 Catching geometry

Only eligible lofted shots can be caught.

Calculate the ball's **first landing point**.

If that point lies inside the actual boundary, test whether it falls within any virtual fielder's catching radius.

Use a 2D distance calculation.

If the point is inside an eligible catching zone, run the confidence-adjusted catching check.

If it is outside all catching zones, no catch can occur.

For v0.1, do not add separate mid-flight interception catches.

A ball merely passing above a fielder's circle does not automatically count as caught.

## 14.5 Ground interception

Grounded shots cannot be caught.

Instead, test the ball's ground trajectory against fielders' interception circles.

If the ball crosses a fielding circle:

- The ball is intercepted.
- Its visible movement stops at the interception position.
- The scoring engine evaluates the interception distance.
- No catch is registered.

Use segment-circle intersection or equivalent continuous collision checking to prevent a fast ball from passing through a fielding zone between frames.

If multiple fielding circles are intersected, use the first interception along the trajectory.

---

# 15. SCORING SYSTEM — LOCKED

The scoring system is geometric.

It must depend on actual simulated ball movement.

There are separate rules for lofted and grounded shots.

## 15.1 Scoring rings

Use concentric scoring zones centered on the batting origin.

Suggested initial distances:

| Distance | Lofted landing score |
|---|---|
| 0–12 m | 0 |
| 12–25 m | 1 |
| 25–40 m | 2 |
| 40–55 m | 3 |
| 55 m to boundary | 4 |
| First landing beyond boundary | 6 |

A circular boundary radius of approximately 65 m may be used as an initial configurable prototype value.

All numerical radii are subject to balancing.

Scoring rings are internal calculations.

Do not render them as visible rings over the 3D playing field.

## 15.2 Lofted shots — first landing determines runs

For an eligible lofted shot:

1. Simulate the physical airborne trajectory.
2. Determine the first landing point.
3. If the first landing point is beyond the actual boundary, award 6.
4. Otherwise, check whether it lands inside a virtual catching circle.
5. If eligible, resolve the catch using the confidence-adjusted probability.
6. If caught, register a wicket and award no shot runs.
7. If dropped, award the ordinary landing-ring score.
8. If outside every catching circle, award the ordinary landing-ring score.

**The first landing position determines runs for uncaught lofted shots.**

Do not change the score based on subsequent rolling after the first bounce.

The outer 4-run ring is an intentional arcade scoring region: a safe lofted shot may score four without physically crossing the boundary.

Visually, present its scoring outcome at first landing. Avoid continuing an extended post-landing animation that appears to contradict the awarded result.

Do not allow a ball whose first landing is beyond the boundary to be caught by an out-of-bounds virtual fielder.

## 15.3 Grounded shots

For a grounded shot:

1. Simulate the actual ground trajectory.
2. Check for interception against fixed fielder circles.
3. If intercepted, stop the ball.
4. Award 0–3 runs based on the distance reached at interception.
5. If not intercepted, continue simulating ground movement.
6. If the ball reaches the actual boundary, award 4.
7. If it naturally stops inside the boundary, award up to 3 runs from its final stopping distance.

Suggested ground-interception/final-stop scoring:

- Less than 12 m: 0.
- 12–25 m: 1.
- 25–40 m: 2.
- 40 m or farther inside boundary: 3.
- Actual boundary crossing without interception: 4.

A grounded shot must not score six.

A grounded shot must not be caught.

## 15.4 Scoring priority

Handle events in the correct order.

For lofted shots:

1. Bowled/LBW or missed-contact dismissal, where applicable.
2. Actual bat contact and loft classification.
3. First landing beyond boundary → six.
4. First landing inside eligible catching zone → catch check.
5. Catch success → wicket.
6. Catch failure → landing-ring runs.
7. Otherwise → landing-ring runs.

For grounded shots:

1. Bowled/LBW or missed-contact dismissal, where applicable.
2. Contact and actual ground trajectory.
3. First valid ground-fielding interception.
4. Boundary crossing if not intercepted.
5. Natural stop if no interception or boundary.

Use explicit precedence to avoid awarding both runs and a wicket from one caught shot.

## 15.5 Fielding consistency

Given identical:

- Delivery.
- Shot input.
- Timing.
- Confidence.
- Field placement.
- Random seed.

The outcome must be identical.

A lofted ball outside all catching circles must never be randomly caught.

A grounded ball must never be caught.

The probabilistic catching mechanic must only operate after the geometric catch condition has been satisfied.

---

# 16. OFF-SCREEN 2D BALL TRACKER — LOCKED

The 3D camera never follows the ball.

If the ball moves outside the camera's visible area, display a small circular top-down tracking indicator.

## 16.1 Appearance

The tracker should include:

- Small circular or oval ground representation.
- Minimal pitch orientation.
- A small moving ball dot.
- Subtle recent-path trail.
- Optional landing ripple.
- Compact boundary or catch feedback.

Keep the tracker unobtrusive.

Do not cover the main batting area.

## 16.2 Activation

The tracker remains hidden while the ball is clearly visible in the main 3D viewport.

When the ball leaves the visible region:

- Fade in the tracker.
- Show the ball at its actual projected ground position.
- Continue tracking its current movement.
- Show first landing and scoring feedback as relevant.

After the outcome is complete, fade it out before the next delivery.

## 16.3 No outcome prediction

Do not show:

- Predicted landing markers.
- Future ball paths.
- Expected score.
- Guaranteed catch predictions.

The tracker must communicate what is happening, not what is guaranteed to happen later.

## 16.4 Fielding visibility

The existence of visible fielder dots on the 2D tracker was not finalized as a gameplay decision.

For v0.1, keep the public tracker focused on the ball.

Provide developer-only debugging visualization for fielding circles and positions.

Do not introduce permanent player-facing catching-zone overlays without explicit approval.

---

# 17. BOWLING ENGINE

## 17.1 Bowling categories

Support four archetypes.

**Fast bowling**

Suggested speed: 135–150 km/h.

Deliveries include:

- Full.
- Good length.
- Short.
- Yorker.
- Bouncer.
- Slower-ball variation.

**Medium pace / swing**

Suggested speed: 115–135 km/h.

Deliveries include:

- Full.
- Good length.
- Short.
- Inswinger.
- Outswinger.
- Cutter.

**Off-spin**

Suggested speed: 75–95 km/h.

Deliveries include:

- Stock off-break.
- Flighted off-break.
- Faster ball.
- Arm ball / straighter delivery.

**Leg-spin**

Suggested speed: 75–95 km/h.

Deliveries include:

- Stock leg-break.
- Flighted delivery.
- Faster ball.
- Googly.

These are provisional speed bands.

All styles must remain playable from the fixed camera.

## 17.2 Over allocation — LOCKED

Quick Chase contains two overs.

- Over 1: one fast or medium-pace bowler.
- Over 2: one off-spinner or leg-spinner.

The bowler changes at the over boundary.

Each over uses a distinct selected bowler.

Do not require user-controlled bowling.

## 17.3 Tactical bowling — LOCKED

The bowler makes weighted decisions based on:

- Its bowling archetype.
- Its available delivery variations.
- Recent batting directions.
- Recent shot types.
- Recent timing quality.
- Recent scoring patterns.
- Match situation.
- Batsman confidence as a minor signal.

Use only information available before the next delivery begins.

Do not read the player's current uncommitted direction to select a counter-delivery.

## 17.4 Bowling strategy weights

Initial Club configuration:

- 60% normal delivery selection.
- 30% tactical delivery selection.
- 10% surprise variation.

Within tactical decisions, use provisional weighting:

- 70% recent shot patterns.
- 20% match situation.
- 10% batsman confidence.

These are selection weights, not guarantees that exactly six out of ten balls will follow a category.

## 17.5 Examples of tactical responses

If the player repeatedly lofts toward leg side:

- Increase the chance of a legal delivery outside off.
- Increase the chance of a yorker or a more challenging length.
- Optionally select a compatible predefined field.

If the player repeatedly swings early:

- Increase the chance of a slower delivery.

If the batsman repeatedly misses full balls:

- Modestly increase the likelihood of another accurate full delivery.

If confidence is high:

- The bowler may modestly favor defensive lines or deliveries that disrupt an established scoring pattern.

If confidence is low:

- The bowler may modestly favor attacking lines.

Do not allow confidence to become the dominant tactical factor.

## 17.6 Fixed bowling commitments

Before each run-up:

1. Select the delivery strategy.
2. Select the actual delivery parameters.
3. Select the virtual field placement.
4. Commit to those choices.
5. Begin the visible bowling animation.

Once committed, none of these can change based on the player's current input.

No rubber-banding.

No changing the ball's physics mid-flight to force a wicket.

No teleporting virtual fielders after contact.

---

# 18. DIFFICULTY SYSTEM — LOCKED

Three selectable difficulties:

| Difficulty | Target | Normal | Tactical | Surprise |
|---|---:|---:|---:|---:|
| Beginner | 16 | 80% | 15% | 5% |
| Club | 24 | 60% | 30% | 10% |
| Pro | 32 | 45% | 40% | 15% |

Targets are initial balancing values.

Use them in the initial game unless playtesting reveals a significant issue; keep them configurable.

## 18.1 Beginner

- More readable bowling.
- Lower bowling accuracy.
- Less pronounced movement.
- Fewer difficult variations.
- Later tactical sophistication.
- Subtle but helpful pitch marker.

## 18.2 Club

- Balanced bowling accuracy.
- Genuine variation.
- Moderate swing and spin.
- Tactical response to repeated patterns.
- Late pitch marker.

## 18.3 Pro

- Better bowling accuracy.
- More advanced selection of variations.
- More tactical deliveries.
- Stronger but physically plausible movement.
- Less time to interpret pitch markers.

## 18.4 Difficulty safeguards

Do not:

- Change batting timing windows.
- Reduce input responsiveness.
- Automatically increase wicket probability.
- Use impossible deliveries.
- Make the bounce marker intentionally inaccurate.
- Override the physics engine.
- Adjust the target after the match starts.

Difficulty must come from bowling quality and the challenge target, not hidden cheating.

---

# 19. MATCH SYSTEM — LOCKED

## 19.1 Match format

Only one primary mode:

**Quick Chase — 2 overs**

- Twelve legal deliveries maximum.
- Three wickets available.
- One player-selected batting team.
- One opposing bowling team.
- A pre-established target.
- No simulated opponent batting innings.

## 19.2 Match setup

Player chooses:

1. Team Blue or Team Yellow.
2. Beginner, Club, or Pro.

The game then establishes:

- Opponent team.
- Target.
- Opening batsmen.
- Starting striker.
- Opening bowler.
- Second-over bowler.
- Initial scoreboard.
- Match random seed.

All batsmen begin each new match with 50% confidence.

## 19.3 Batting roster

For each team:

- Two opening batsmen.
- Two replacement batsmen.

The maximum number of batsmen needed is four because the innings ends on the third wicket.

Each batsman tracks:

- Identifier.
- Team.
- Runs.
- Balls faced.
- Confidence.
- Last three delivery-quality records.
- Dismissal state.

## 19.4 Strike rotation

Implement authentic internal strike rotation.

- 0 runs: retain strike.
- 1 run: change strike.
- 2 runs: retain strike.
- 3 runs: change strike.
- 4 runs: retain strike.
- 6 runs: retain strike.
- End of over: change strike.
- Wicket: incoming batter replaces dismissed striker.

An odd run on the final delivery of an over causes a run-based swap and then the over-based swap, so the same batter faces the next over.

Do not animate running.

Do not show a non-striker model.

The on-screen striker model may remain in place while the internal batsman identity changes.

## 19.5 Confidence and strike

Every batsman's confidence belongs to that batsman alone.

When strike changes:

- Preserve both batsmen's scores.
- Preserve both confidence values.
- Preserve both delivery histories.
- Display the new striker's confidence.

Non-strikers do not gain or lose confidence while off strike.

## 19.6 Wicket behavior

Supported dismissals:

- Bowled.
- Simplified LBW.
- Caught from eligible lofted shots.

The third wicket ends the innings.

After the first or second wicket:

1. Register the dismissal.
2. Show brief wicket feedback.
3. Play one repeatable bowler celebration.
4. Replace the dismissed striker.
5. Initialize the new striker at 50% confidence.
6. Continue the next delivery.

No new-batsman walking animation.

## 19.7 Win condition

Win immediately when team runs reach or exceed the target.

Stop the innings even if balls remain.

## 19.8 Loss condition

Lose if:

- Three wickets fall before reaching the target.
- Twelve legal deliveries are completed without reaching the target.

The player should be allowed to start another match immediately.

---

# 20. LIVE SCOREBOARD AND HUD

The scoreboard must remain visible during the batting experience.

## 20.1 Required information

Always show:

- Batting team.
- Opposition team.
- Team score.
- Wickets lost.
- Overs and balls completed.
- Target.
- Runs needed.
- Balls remaining.
- Current striker identity.
- Current striker's runs and balls faced.
- Confidence percentage.
- Confidence bar.

Use a compact layout that does not block the batsman or incoming ball.

## 20.2 Confidence meter

The meter must display:

- Exact percentage, rounded appropriately for presentation.
- A filled progress bar.
- Clear but restrained changes as confidence increases or decreases.

Suggested color semantics:

- Low: warm red.
- Neutral: yellow/amber.
- High: green/lime.

Do not let the confidence meter obscure the 3D gameplay.

## 20.3 Delivery history

Display the current over's outcomes using compact markers:

- 0.
- 1.
- 2.
- 3.
- 4.
- 6.
- W.

Use distinct styling for boundaries and wickets.

## 20.4 Shot feedback

Briefly show:

- PERFECT.
- GOOD.
- MISTIMED.
- BEATEN.

Then show the actual result when resolved:

- DOT BALL.
- 1 RUN.
- 2 RUNS.
- 3 RUNS.
- FOUR!
- SIX!
- CAUGHT!
- DROPPED!
- BOWLED!
- LBW!

Avoid crowding the screen with multiple large messages.

Do not confuse contact quality with scoring.

---

# 21. VISUAL DESIGN

The game should have a clean, recognizable cricket presentation.

## 21.1 Stadium

Use one stadium environment.

It can be stylized, but should feel believable.

Required:

- Grass playing field.
- Pitch strip.
- Crease markings.
- Wickets.
- A visible boundary.
- Basic stadium background.
- Daylight or consistent stadium lighting.
- Appropriate shadows.
- Realistic ball and bat proportions.

Avoid expensive crowd simulations.

## 21.2 Character fidelity

Prioritize:

- Correct cricket batting posture.
- Authentic shot follow-through.
- Believable foot movement.
- Smooth animation blending.
- Good bat-ball alignment.

Photorealism is not necessary.

The models should look like simplified 3D cricket players, not stick figures.

## 21.3 Sound

Implement restrained effects:

- Bat contacting the ball.
- Cleaner, sharper contact for well-timed strokes.
- Duller contact for mistimed strokes.
- Edge sounds when appropriate.
- Ball bounce.
- Stump impact.
- Modest boundary/wicket UI sounds.
- Optional low-level stadium ambience.

No commentary required.

Avoid excessive music or cinematic audio.

---

# 22. CELEBRATIONS AND SPECIAL ANIMATIONS — LOCKED

Only two celebration behaviors are needed.

## 22.1 Batsman milestone

When a batsman reaches a configured individual run milestone, play a brief bat-raising animation.

For the initial version, use a configurable first milestone such as 25 individual runs, with later thresholds such as 50 if relevant.

The milestone should only trigger once per threshold per batsman.

Do not:

- Change camera.
- Add a long cutscene.
- Show crowd close-ups.
- Display elaborate animations.

## 22.2 Bowler wicket celebration

After a wicket, play one short, repeatable celebration from the current bowler.

Target approximately one to two seconds.

Use the same celebration each time.

No camera movement.

No fielders joining the celebration.

## 22.3 Normal boundaries

Ordinary fours and sixes should not interrupt the game with large celebrations.

The satisfaction should come from the shot animation, ball trajectory, sound, and compact scoring feedback.

---

# 23. DELIVERY-TO-DELIVERY GAMEPLAY FLOW

Implement an explicit state machine.

Suggested states:

1. MAIN_MENU
2. MATCH_SETUP
3. PRE_DELIVERY
4. BOWLER_RUNUP
5. BALL_IN_FLIGHT
6. SHOT_COMMITTED
7. CONTACT_RESOLUTION
8. BALL_OUTCOME
9. RESULT_FEEDBACK
10. WICKET_TRANSITION
11. MILESTONE_TRANSITION
12. OVER_TRANSITION
13. NEXT_DELIVERY
14. MATCH_COMPLETE

These may be represented with a smaller equivalent state machine if behavior remains identical.

## 23.1 Normal delivery flow

1. Determine striker.
2. Load striker confidence.
3. Choose bowler strategy.
4. Fix virtual fielder positions.
5. Generate and commit the delivery.
6. Begin bowler animation.
7. Release the ball.
8. Show late pitch marker.
9. Allow player direction adjustments.
10. Player presses A/S/D.
11. Lock shot selection.
12. Start correct batting animation.
13. Calculate bat-ball contact.
14. Apply confidence to contact and trajectory.
15. Simulate struck ball movement.
16. Resolve catch, interception, boundary, or other scoring.
17. Display contact-quality and run feedback.
18. Update striker's score and balls faced.
19. Update confidence from raw shot quality.
20. Update team score.
21. Evaluate win, loss, wicket, and over-end conditions.
22. Apply strike rotation in correct order.
23. Prepare the next delivery.

## 23.2 Input not pressed

If the player does not press A/S/D:

- The ball continues naturally.
- If it hits the wickets, register bowled.
- If it does not produce a valid dismissal, resolve the legal ball as a dot.
- Record an appropriate raw execution result for the striker.

Do not freeze the match waiting for input.

## 23.3 Pacing

Keep the game fast.

Initial pacing targets:

- Bowler preparation: about 1–2 seconds.
- Delivery: determined by actual simulated ball speed.
- Ordinary feedback: roughly 0.5–1 second.
- Wicket celebration: roughly 1–2 seconds.
- Over transition: roughly 1–2 seconds.

Once an outcome is resolved, a short Space-key advance may be supported to skip remaining nonessential result presentation.

Space must not become an additional batting mechanic.

Do not skip unresolved ball physics or change the result when advancing.

---

# 24. MAIN MENU AND MATCH FLOW

Keep navigation extremely simple.

## 24.1 Main screen

Display:

- Fun Cricket title.
- Play button.
- Minimal control instructions.
- Optional sound toggle.

Do not create a complex navigation system.

## 24.2 Setup screen

Display:

- Team Blue.
- Team Yellow.
- Beginner.
- Club.
- Pro.
- Start Match.

Show the chosen target before play starts.

## 24.3 Match screen

Display:

- Fixed 3D cricket scene.
- Compact scoreboard.
- Confidence meter.
- Delivery history.
- Temporary shot feedback.
- Off-screen ball tracker when needed.

## 24.4 Match completion

Show:

- VICTORY or DEFEAT.
- Final team score.
- Target.
- Balls used.
- Wickets lost.
- Runs/balls for each batsman.
- Replay or Play Again action.
- Return to Menu action.

Do not introduce a tournament ladder, rankings, or progression UI.

---

# 25. PHYSICS AND SCORING EDGE CASES

Explicitly handle the following.

### Case A — Perfect lofted hit beyond boundary

First landing beyond actual boundary.

Result: SIX.

Do not perform a catching check outside the boundary.

### Case B — Lofted shot lands inside a catching circle

Use confidence-adjusted catching probability.

Caught → wicket.

Dropped → first-landing-point score.

### Case C — Lofted shot lands outside catching zones

Award the landing-ring score.

No random wicket.

### Case D — Lofted attempt becomes a ground mishit

Use ground-fielding rules.

No catch.

### Case E — Grounded shot crosses a fielding circle

Stop at first valid interception.

Award distance-based 0–3 runs.

### Case F — Grounded shot avoids all fielders and crosses boundary

Award FOUR.

### Case G — Grounded shot stops naturally before boundary

Award 0–3 using its final stopping distance.

### Case H — Correct defense against ordinary pace

Normally a controlled dot ball.

Confidence may improve.

### Case I — Incorrect defense against turning off-spin

If the ball physically beats the bat and reaches the stumps or qualifies for simplified LBW, dismiss the batsman.

Do not use an automatic special-case wicket rule.

### Case J — Perfect timing at zero confidence

The player can still hit a clean, powerful stroke.

Confidence must not prohibit successful batting.

### Case K — Bad timing at full confidence

The player can still miss, edge, or be dismissed.

Confidence must not guarantee survival.

### Case L — High confidence and valid catching zone

At 100% confidence, catching probability is 80%, not zero.

### Case M — Third wicket

End immediately.

Do not attempt to load a fifth batsman.

### Case N — Target reached before final ball

End immediately with victory.

### Case O — Odd runs on final ball of an over

Apply the run-based strike swap and the over-end swap.

### Case P — New batsman

Start confidence at 50%.

Do not inherit the dismissed batsman's recent delivery history.

### Case Q — Ball leaves camera view

Show 2D tracker.

Do not move the camera.

### Case R — Frame-rate variation

Game physics and timing must be based on elapsed time or fixed simulation steps, not the number of rendered frames.

### Case S — Scoring boundary equality

Define consistent inclusive/exclusive rules for ring boundaries, catching-circle edges, and field-boundary crossings.

Document these rules and test them.

---

# 26. ANIMATION AND GAMEPLAY QUALITY REQUIREMENTS

A technically correct score engine is insufficient if the batting feels wrong.

The following are high-priority quality requirements:

1. Smooth transitions from idle stance into shot preparation.
2. Realistic upper-body rotation.
3. Appropriate foot movement.
4. Bat aligned with the incoming ball.
5. Convincing follow-through.
6. Correct ball contact timing.
7. Distinct grounded and lofted follow-throughs.
8. Visible difference between front-foot and back-foot batting.
9. Clear reaction to short balls.
10. Plausible spin-bowling defensive mistakes.
11. Natural ball launch after bat contact.
12. No unnatural ball teleportation.
13. No visible mismatch between physics and animation.
14. Fast recovery to ready stance.
15. Minimal interruption between deliveries.

Use animation blending where necessary.

If available assets are insufficient, create or obtain properly licensed original animations rather than substituting visibly incorrect motions.

Do not copy proprietary Cricket 07 or Stick Cricket game assets.

---

# 27. CONFIGURATION SYSTEM

Create a centralized configuration for tunable parameters.

It should contain, at minimum:

**Match configuration**

- Overs.
- Wickets.
- Difficulty targets.
- Initial batsman confidence.
- Batting milestone thresholds.

**Bowling configuration**

- Bowling speed bands.
- Accuracy.
- Swing amounts.
- Spin amounts.
- Delivery weights.
- Tactical weights.
- Variation probabilities.

**Batting configuration**

- Shot animation lead times.
- Timing thresholds.
- Direction suitability values.
- Contact geometry tolerances.
- Shot power ranges.
- Loft launch-angle ranges.

**Confidence configuration**

- History length: locked to three.
- Initial value: locked to 50.
- Contribution mapping.
- Contact precision modifiers.
- Contact power cap.
- Catch probability coefficients.

**Fielding configuration**

- Ground radius.
- Catching radii.
- Ground interception radii.
- Fielder positions.
- Field presets.
- Scoring ring thresholds.

**Visual configuration**

- Camera position.
- Camera field of view.
- Pitch marker opacity and timing.
- Tracker size and location.
- Animation durations.
- Feedback durations.

Keep numerical values editable without modifying core game logic.

---

# 28. DEVELOPMENT MILESTONES

Implement in the following order.

Each milestone must leave working, testable code.

## Milestone 1 — Functional 3D scene

Build:

- Ground.
- Pitch.
- Wickets.
- Lighting.
- Fixed camera.
- Batter model.
- Bowler model.
- Cricket ball.
- Basic browser interface.

Acceptance: The scene renders consistently, and the fixed viewpoint provides clear visibility of the batter and delivery.

## Milestone 2 — Delivery physics

Build:

- Bowler release.
- Delivery generation.
- Pace trajectories.
- Bounce.
- Spin movement.
- Late pitch marker.

Acceptance: Multiple delivery styles visibly behave differently and arrive at predictable contact locations.

## Milestone 3 — Batting controls and animations

Build:

- Direction selection.
- Diagonal selection.
- A/S/D input.
- Direction locking.
- Batting animation selection.
- Basic footwork.
- Contact frame synchronization.

Acceptance: The same player input selects appropriate different animations depending on ball length and line.

## Milestone 4 — Contact and shot physics

Build:

- Timing evaluation.
- Clean contact.
- Mistimed contact.
- Missed contact.
- Lofted trajectories.
- Grounded trajectories.
- Bat-ball collision integration.

Acceptance: The ball's movement results from the performed shot and matches the displayed contact.

## Milestone 5 — Invisible fielding and scoring

Build:

- Fixed virtual fielders.
- Catching circles.
- Ground interception circles.
- Scoring rings.
- Boundary detection.
- First-landing scoring.
- Catch and drop outcomes.

Acceptance: Geometry tests produce the correct runs and dismissals.

## Milestone 6 — Confidence and bowling AI

Build:

- Individual batsman confidence.
- Three-delivery rolling calculation.
- Confidence modifiers.
- Catch probabilities.
- Weighted tactical bowling.
- Field preset selection.

Acceptance: Confidence and tactical bowling respond to previous deliveries without changing timing windows or cheating.

## Milestone 7 — Full Quick Chase

Build:

- Team selection.
- Difficulty selection.
- Fixed targets.
- Batting roster.
- Strike rotation.
- Two-over structure.
- Three-wicket limit.
- Win/loss handling.
- Match replay.

Acceptance: A full match can be completed from start to finish.

## Milestone 8 — Final gameplay presentation

Build:

- Finished scoreboard.
- Confidence display.
- 2D off-screen tracker.
- Contact feedback.
- Sound.
- Bat-raising milestone.
- Repeatable bowler wicket celebration.
- Fast transitions.
- Polished menus.

Acceptance: The game looks coherent, plays smoothly, and contains no incomplete placeholder interactions.

---

# 29. TESTING REQUIREMENTS

Do not deliver solely on the basis of a successful compilation.

Test game behavior.

## 29.1 Unit tests

Write tests for:

- Eight-direction input mapping.
- Direction locking.
- Shot-selection compatibility.
- Fixed timing thresholds.
- Confidence calculation.
- Neutral missing-history slots.
- Three-delivery history rollover.
- Confidence persistence across strike changes.
- Catch probability formula.
- Landing-point scoring.
- Catch-zone intersection.
- Ground trajectory and interception.
- Boundary checking.
- Grounded shots never becoming caught.
- Wicket counting.
- Strike rotation.
- Final-ball odd-run behavior.
- Match victory.
- Match defeat.
- Tactical delivery selection.
- Seeded randomness reproducibility.

## 29.2 Integration tests

Verify:

- Bowling animation and ball release alignment.
- Ball arrival and batting contact-frame alignment.
- Input-to-animation responsiveness.
- Animation-to-physics synchronization.
- Confidence influence on shot outcomes.
- Fielding outcome followed by correct scoreboard update.
- Complete first-over and second-over transitions.
- Wicket replacement and confidence reset.
- Off-screen tracker positions matching the live 3D ball.
- Match completion without state errors.

## 29.3 Manual gameplay scenarios

Play through:

1. A complete Beginner chase.
2. A complete Club chase.
3. A complete Pro chase.
4. A chase that ends on the final delivery.
5. A chase that ends early through victory.
6. A match ending on the third wicket.
7. Multiple consecutive grounded shots.
8. Multiple consecutive lofted shots.
9. Three perfectly timed deliveries.
10. Three complete misses.
11. A deliberately mistimed loft into a catching circle.
12. A correctly timed defensive shot against off-spin.
13. An incorrect defense against a turning delivery.
14. Odd-run strike rotation.
15. A ball that leaves the 3D camera view.
16. A boundary reached without entering any ground-fielding circle.

Record and fix issues rather than merely describing them.

---

# 30. PERFORMANCE AND RELIABILITY

The game should be responsive and lightweight.

Targets:

- Smooth gameplay on a typical modern desktop browser.
- Aim for 60 FPS on a reasonable desktop or laptop.
- Minimal input latency.
- Consistent time-based simulation.
- Reasonable startup loading.
- No unnecessary large 3D assets.
- No continuous allocation-heavy physics operations.
- Clean resets between matches.
- No duplicate keyboard event listeners.
- No game state leaking into subsequent matches.

Use asset loading management so the game does not begin a delivery before necessary animations and models are ready.

Handle loss of browser focus gracefully so returning to the tab does not cause a huge physics jump or a burst of unintended inputs.

Do not silently skip scoring events when frames are dropped.

---

# 31. DEBUGGING AND DEVELOPER TOOLS

Provide developer-only diagnostics that can be disabled for the release.

Useful debug information includes:

- Current ball position and velocity.
- Predicted landing position.
- Actual ball bounce position.
- Selected shot direction.
- Selected shot type.
- Selected animation.
- Animation contact time.
- Ball arrival time.
- Timing error in milliseconds.
- Raw execution quality.
- Effective contact quality.
- Confidence before and after delivery.
- Active virtual field preset.
- Catching and interception circles.
- Calculated landing distance.
- Scoring ring.
- Catch probability and random draw.
- Final delivery outcome.

Use this information to verify that the visual animation and mechanical calculations agree.

Do not expose internal debugging overlays in ordinary gameplay.

---

# 32. ACCEPTANCE CRITERIA

The project is not considered complete unless all of the following are satisfied.

## Gameplay

- The player can launch a Quick Chase.
- Both fixed teams are selectable.
- All three difficulties work.
- Twelve-ball, three-wicket match rules work.
- Strike rotation works correctly.
- Every incoming batsman starts at 50% confidence.
- Two active batsmen retain independent confidence.
- Direction inputs work.
- A/S/D controls work.
- Shot timing feels consistent.
- Pace and spin behave differently.
- Tactical bowling reacts to recent patterns.
- Targets and match-ending conditions are correct.

## Batting and animation

- The batter is visibly three-dimensional.
- The batter performs genuine cricket stroke motions.
- Full and short balls produce appropriate footwork.
- Grounded and lofted strokes look different.
- Timing is linked to bat contact.
- The ball visibly leaves the bat at the correct moment.
- Mistimed shots do not look identical to perfect shots.

## Fielding and scoring

- Virtual catching zones work.
- Only eligible lofted shots are caught.
- Grounded balls are intercepted geometrically.
- Lofted shots are scored from first landing.
- Grounded boundary crossing scores four.
- Lofted shots clearing the boundary score six.
- Catch probability responds to confidence.
- Runs and dismissals are not invented independently of the physics and geometric checks.

## Visual behavior

- The camera remains fixed.
- No fielders, keeper, umpire, or running animations appear.
- Off-screen tracking works.
- Confidence is always visible during play.
- Wicket celebration is brief and repeatable.
- Bat-raising milestone animation works.
- Blue and yellow jerseys are correctly applied.

## Application quality

- No broken controls.
- No placeholder buttons.
- No fake scoring simulation.
- No blocking console errors.
- No broken match reset.
- No unresponsive game states.
- Core unit and integration tests pass.

**A visual demo that merely animates batting without implementing real contact, fielding geometry, scoring, confidence, and match rules does not satisfy this specification.**

---

# 33. REQUIRED DELIVERABLES

Provide:

1. Complete working source code.
2. A browser-runnable project.
3. A straightforward local setup procedure.
4. A README describing architecture and controls.
5. A description of the game state machine.
6. Documentation of the batting-contact calculation.
7. Documentation of confidence calculations.
8. Documentation of fielding and scoring rules.
9. A centralized gameplay configuration.
10. Automated tests covering core mechanics.
11. A list of original or properly licensed 3D and audio assets.
12. Instructions for building a production browser release.
13. A brief report of completed acceptance criteria.
14. A candid list of any remaining limitations.

Do not mark incomplete features as complete.

If an animation asset or technical limitation prevents a required feature from working correctly, identify the issue and resolve it using an appropriate implementation rather than silently removing that mechanic.

---

# 34. FINAL DESIGN PRINCIPLES

These principles take precedence over discretionary implementation choices.

### Principle 1 — Batting first

The game succeeds when hitting the cricket ball feels satisfying.

Focus development effort on ball reading, shot timing, realistic batting motion, and contact.

### Principle 2 — Simple inputs, meaningful decisions

Three shot buttons and directional arrows should provide enough freedom for interesting cricket.

Do not complicate controls.

### Principle 3 — Authentic animation, arcade presentation

The shots should look like cricket.

The game should still play quickly like an arcade title.

### Principle 4 — Physics determines trajectory

The ball must behave consistently with the executed stroke.

### Principle 5 — Geometry determines fielding

Invisible catching and interception circles replace fielding animations.

### Principle 6 — Confidence influences quality

Confidence changes contact quality, precision, power modestly, and catch survival.

It never changes timing windows.

### Principle 7 — Fair bowling

Bowlers may adapt to previous batting patterns.

They cannot cheat by reacting to current input after committing to a delivery.

### Principle 8 — Fixed viewpoint

The camera never follows the ball.

The 2D tracker handles off-screen movement.

### Principle 9 — Minimal presentation

No unnecessary celebrations, cutscenes, menus, or delays.

### Principle 10 — Quick Chase only

Two fixed teams, selectable difficulty, a two-over target, realistic internal strike rotation, and three wickets.

No feature creep.

---

# 35. EXECUTION INSTRUCTIONS TO THE DEVELOPMENT AGENT

Start by translating this specification into a concrete technical architecture and implementation checklist.

Identify the genuinely difficult integration points, especially:

- Animation contact-frame timing.
- Bat-ball collision.
- Procedural adjustment of cricket stroke animations.
- Pace and spin trajectory simulation.
- Fixed-camera ball visibility.
- Grounded and aerial scoring geometry.
- Confidence-adjusted shot outcomes.
- Strike rotation and match lifecycle.

Then implement the full game incrementally in the recommended milestone order.

At each milestone, verify functional behavior before progressing.

Use the configuration values provided here as sensible starting points where exact tuning has not been finalized.

Do not reinterpret the product into a full cricket simulator.

Do not add unapproved features.

Do not silently substitute attractive mockups for functioning gameplay.

When the application is complete, run the available tests, play through representative matches, and verify the final product against the acceptance checklist.

The final experience should be recognizable as:

**FUN CRICKET — A fast, simple, fixed-camera, 3D browser cricket batting game that combines accessible arcade controls with authentic batting animation, skill-based shot timing, individual batsman confidence, tactical bowling, and geometric fielding and scoring.**

The most important final test is simple:

**Does hitting a perfectly timed cricket shot feel good enough that the player immediately wants to face another delivery?**

Build toward that outcome.

**END OF MASTER SPECIFICATION**
