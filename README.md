# Fun Cricket

A desktop browser cricket batting game: twelve balls, three wickets, one target. Built with TypeScript, Three.js and Vite. Everything runs locally; play needs no backend or external asset requests.

## Run locally

Install Node.js 22.12 or newer (Node 22.14 was used during development), then run these commands in this folder:

```powershell
npm install
npm run dev
```

Open the Local URL printed by Vite, normally **http://127.0.0.1:5173/**. Use a current desktop browser with WebGL and hardware acceleration enabled. Select Play Quick Chase, your team, and a difficulty. Team Blue and Team Yellow use the same batting abilities.

## Controls

| Key | Action |
|---|---|
| Arrow keys | Select a shot direction; combine keys for diagonals |
| A | Defend, or duck a high bouncer |
| S | Grounded stroke |
| D | Lofted stroke |
| Escape | Pause/resume |
| Space | Advance already-resolved result presentation |

Press the shot key **before the ball arrives**: the batting animation needs time to reach contact. Your first shot press locks the direction for that ball. Holding a key never creates a second shot. The in-game How to Play panel explains the rules.

Directions for the right-handed batter: Up = straight, Up/Left = midwicket, Up/Right = covers, Left = square leg, Right = point, Down/Left = fine leg, Down/Right = third man. Down chooses a late stroke based on actual ball line.

## Match rules

- Two overs, at most twelve legal deliveries, three wickets, four batters per team.
- Beginner chases 16, Club 24, Pro 32. Targets stay fixed during a match.
- The first over is fast or medium pace; the second is off-spin or leg-spin.
- Odd runs change strike; the over end changes it again. Batters retain independent scores and confidence.
- Grounded shots score from their simulated interception, stopping point or actual boundary crossing. They cannot be caught.
- Lofted shots score from the first landing. Clearing the boundary is six; landing in a virtual catching circle permits a confidence-adjusted catch.
- Reaching the target ends the innings immediately. Twelve balls or three wickets ends an unsuccessful chase.

The camera remains fixed. The small tracker appears when an outgoing ball leaves the 3D viewport. It displays the live ball, never a predicted result. No fielders, keeper, umpires or non-striker model are rendered.

## Checks and production build

```powershell
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

`npm test` runs the deterministic unit and integration suite. The browser suite starts/reuses a loopback Vite server, exercises actual WebGL and controls in Chromium, and writes screenshots into `tests/artifacts/`. Its software WebGL configuration makes it suitable for headless QA; it does not measure hardware GPU performance.

`npm run build` type-checks TypeScript and creates `dist/`. Serve that directory with a static HTTP server or use `npm run preview` to check it. The build uses relative paths for static hosting below a subdirectory. Do not open `index.html` directly through `file://`.

## Architecture

`src/core/game.ts` owns the match lifecycle and fixed 120 Hz simulation. Pure systems implement bowling, ball physics, batting, confidence, collision, fielding and scoring. The immutable match reducer updates the faced batter before applying replacements and strike rotation. The HUD reads this same authoritative state.

The original articulated player is authored in `src/rendering/player.ts`; `src/animation/pose.ts` samples the stroke, footwork and pad geometry. Both rendering and physics use these poses, so the collider follows the visible bat. A seeded PRNG controls delivery generation, bounded shot deviation and geometrically eligible catch decisions. No independent roll invents runs.

All primary gameplay values live in `src/core/config.ts`. Locked rules and fixed timing windows must remain consistent with `instructions.md`. See [mechanics documentation](docs/MECHANICS.md), [development plan](DEVELOPMENT_PLAN.md), and [acceptance report](docs/ACCEPTANCE.md) for behavior and validation limits.

## Developer diagnostics and original assets

In development, `http://127.0.0.1:5173/?debug=1` enables the diagnostics overlay, field circles, and `window.__cricket` scenario API. This API is excluded from production builds. It records delivery commitments, simulation-time shot inputs, timing errors, actual contact position, contact quality, pre-delivery confidence and outcome. Ordinary play has no future-path or field-circle overlays.

The portable original character export is `public/assets/fun-cricket-batter.glb`, with sixteen baked animation clips. The game samples its authored source directly to preserve exact animation/collision agreement. Rebuild the export with:

```powershell
node src/rendering/build-assets.mjs
```

The exporter uses `esbuild`, supplied by Vite. Original sound effects are synthesized through Web Audio after the first user gesture. Font files and SIL Open Font License notices are local in `public/assets/fonts/`; `node scripts/download-fonts.mjs` refreshes them and requires internet access. See the [asset manifest](public/assets/LICENSES.md).

## Current limitations

Characters and strokes are original stylized articulated animation, rather than motion capture or photorealistic players. Aerodynamics, LBW and first-landing catches use the documented arcade model. Desktop keyboard play is the supported platform. Automated gameplay and browser evidence do not replace a human batting-feel playtest; validation and any remaining issues are recorded in `docs/ACCEPTANCE.md`.
