# Asset provenance

## Original project assets

| Asset | Source / rebuild path | Provenance |
|---|---|---|
| Articulated batter and shared bowler geometry, clothing, helmet/grille, gloves, pads, shoes and bat | `src/rendering/player.ts` | Original geometry authored for this project using Three.js primitives and articulated parts; no downloaded player model or celebrity likeness |
| Batting stance, defenses, duck/sway, drives, flick, back-foot punch, cut, pull, lofted strokes, late cut, miss/recovery and milestone gesture | `src/animation/pose.ts`, `src/rendering/player.ts` | Original authored motion curves and joint positioning; no copied game animation or third-party motion-capture clip |
| Pace/spin bowling movement and repeatable wicket celebration | `src/rendering/player.ts` | Original authored animation using the shared player model |
| `fun-cricket-batter.glb` | `src/rendering/export.ts`; rebuild with `node src/rendering/build-assets.mjs` | Portable GLB export of the original project geometry and baked animation clips; companion `fun-cricket-batter.asset.json` lists clip names and origin |
| Pitch, stumps, creases, field, boundary, stadium, banners, grass presentation and lighting | `src/rendering/scene.ts` | Original procedural scene geometry and materials |
| Contact, bounce, wicket, boundary and interface sound effects | `src/audio/audio.ts` | Original Web Audio oscillator/noise synthesis; no third-party recordings or samples |
| Cricket-ball favicon and interface symbols | `public/favicon.svg`, application UI source | Original SVG/CSS/text presentation |

These assets are original work supplied with this project. This provenance record does not assign an additional open-source license to the user's project. No Cricket 07, Stick Cricket, licensed sports-team logo, proprietary character, or proprietary game audio is included.

## Fonts

The interface ships Latin-subset **Barlow Condensed**, **DM Sans**, and **IBM Plex Mono** WOFF2 files in `public/assets/fonts/`. These are distributed under the SIL Open Font License 1.1, with complete notices in `barlowcondensed-OFL.txt`, `dmsans-OFL.txt`, and `ibmplexmono-OFL.txt` beside the font files. `fonts.css` references only local files; ordinary play makes no Google Fonts request. `scripts/download-fonts.mjs` can refresh the files from Google Fonts and the Google Fonts source repository. System fallback fonts are supplied by the user's operating system and are not redistributed here.

## Software dependencies

Three.js, Vite, TypeScript, Vitest, Playwright and their dependencies retain their own package licenses. See each package's license file in `node_modules` and the lockfile for the installed versions. They are software dependencies, not sources for third-party character or sound assets.
