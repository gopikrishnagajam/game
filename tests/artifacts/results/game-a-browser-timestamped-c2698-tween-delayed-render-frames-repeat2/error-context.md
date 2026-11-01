# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game.spec.ts >> a browser-timestamped shot event advances simulation between delayed render frames
- Location: tests\browser\game.spec.ts:127:1

# Error details

```
Error: {"initial":{"deliveryTime":0.041666666666666664,"phase":"delivery"},"committed":{"shot":null,"deliveryTime":0.7499999999999998,"inputs":0,"phase":"feedback","paused":false}}

expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 0
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "Fixed camera view of the Fun Cricket ground" [ref=e4]
  - generic:
    - banner:
      - button "Fun Cricket home" [ref=e5] [cursor=pointer]:
        - generic [aria-hidden] [ref=e6]: ◒
        - text: FUN
        - generic [ref=e7]: CRICKET
        - generic [ref=e8]: "01"
      - generic:
        - text: THE TWO-OVER CHASE
        - generic: /
        - text: DESKTOP EDITION
      - navigation:
        - button "Turn sound off" [ref=e9] [cursor=pointer]:
          - generic [ref=e10]: ◖))
          - generic [ref=e11]: SOUND ON
        - button "How to play" [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: "?"
          - generic [ref=e14]: HOW TO PLAY
    - generic:
      - region "Live scoreboard":
        - generic:
          - generic:
            - text: TEAM BLUE vs YELLOW
            - generic: 0/0
          - generic:
            - generic: "0.0"
            - generic: OVERS / 2
        - generic:
          - generic: TARGET
          - generic: "24"
        - generic:
          - generic: 24 NEEDED
          - generic:
            - text: FROM
            - strong: "12"
            - text: BALLS
        - button "Pause match" [ref=e15] [cursor=pointer]: Ⅱ
      - generic:
        - generic:
          - generic: OVER 01 / MEDIUM PACE
          - generic: 121 KM/H
        - generic "Current over outcomes":
          - generic: ·
          - generic: ·
          - generic: ·
          - generic: ·
          - generic: ·
          - generic: ·
      - generic: WATCH THE BALL
      - generic:
        - generic:
          - generic:
            - generic: ▰
            - generic: BATTER 01
            - generic: ON STRIKE
            - strong:
              - text: "0"
              - generic: (0)
          - generic:
            - generic: CONFIDENCE
            - generic: 50%
          - generic:
            - text: BATTER 02
            - generic: 0 (0)
        - generic:
          - generic:
            - generic: ↑
            - generic:
              - generic: SHOT DIRECTION
              - generic: Straight
          - generic:
            - generic:
              - generic: A
              - text: DEFEND
            - generic:
              - generic: S
              - text: GROUND
            - generic:
              - generic: D
              - text: LOFT
          - generic: ARROWS TO AIM · PRESS TO TIME YOUR SWING
    - generic [ref=e16]: "{ \"phase\": \"delivery\", \"time\": \"0.042\", \"ball\": { \"x\": 0.1464605082235202, \"y\": 1.949520490821776, \"z\": 16.603617045538932 }, \"delivery\": { \"arrival\": 0.5282540499981427, \"contact\": { \"x\": -0.14728658685975035, \"y\": 0.5445987372585828, \"z\": 0.72 }, \"field\": \"balanced\" }, \"shot\": null, \"contact\": null, \"result\": null }"
```

# Test source

```ts
  57  |   await expect(page.locator('#confidence-value')).toHaveText('50%');
  58  |   await expect(page.locator('#pause-overlay')).toBeVisible();
  59  |   await page.screenshot({ path: 'tests/artifacts/match-paused.png' });
  60  |   await page.locator('#resume').click();
  61  |   await expect(page.locator('#pause-overlay')).toBeHidden();
  62  |   await page.keyboard.press('Escape');
  63  |   await expect(page.locator('#pause-overlay')).toBeVisible();
  64  | });
  65  | 
  66  | test('arrow selection and S keyboard input lock one physical shot and suppress key repeats', async ({ page }) => {
  67  |   await openDebug(page);
  68  |   await page.evaluate(() => {
  69  |     const api = (window as any).__cricket;
  70  |     api.game.start('blue', 'club', 1);
  71  |     api.game.advance(1);
  72  |     api.game.advance(.7);
  73  |     api.ui.update();
  74  |   });
  75  |   await page.keyboard.down('ArrowUp');
  76  |   await page.keyboard.down('ArrowRight');
  77  |   await page.keyboard.up('ArrowUp');
  78  |   await page.keyboard.up('ArrowRight');
  79  |   await page.keyboard.down('s');
  80  |   await page.keyboard.down('s');
  81  |   await page.keyboard.up('s');
  82  |   await page.keyboard.press('ArrowLeft');
  83  |   await page.keyboard.press('d');
  84  |   const shot = await page.evaluate(() => {
  85  |     const api = (window as any).__cricket;
  86  |     api.ui.update();
  87  |     return { phase: api.game.phase, shot: api.game.shot, log: api.game.inputLog, selection: api.input.direction };
  88  |   });
  89  |   expect(shot.phase).toBe('delivery');
  90  |   expect(shot.shot.type).toBe('ground');
  91  |   expect(shot.shot.direction).toBe('cover');
  92  |   expect(shot.log).toHaveLength(1);
  93  |   expect(shot.selection).toBe('cover');
  94  |   await expect(page.locator('#direction-name')).toHaveText('Covers');
  95  |   await expect(page.locator('#direction-lock')).toHaveText('LOCKED');
  96  | });
  97  | 
  98  | test('losing focus pauses the live simulation until explicit resume', async ({ page }) => {
  99  |   await openDebug(page);
  100 |   const initial = await page.evaluate(() => {
  101 |     const api = (window as any).__cricket;
  102 |     api.game.start('blue', 'club', 12);
  103 |     api.game.advance(.5);
  104 |     window.dispatchEvent(new Event('blur'));
  105 |     api.ui.update();
  106 |     return api.game.time;
  107 |   });
  108 |   await expect(page.locator('#pause-overlay')).toBeVisible();
  109 |   const paused = await page.evaluate(() => {
  110 |     const game = (window as any).__cricket.game;
  111 |     game.advance(60);
  112 |     return { time: game.time, paused: game.paused };
  113 |   });
  114 |   expect(paused).toEqual({ time: initial, paused: true });
  115 |   await page.locator('#resume').click();
  116 |   const resumed = await page.evaluate(() => {
  117 |     const api = (window as any).__cricket;
  118 |     api.game.advance(1 / 120);
  119 |     api.ui.update();
  120 |     return { time: api.game.time, paused: api.game.paused };
  121 |   });
  122 |   expect(resumed.paused).toBe(false);
  123 |   expect(resumed.time).toBeCloseTo(initial + 1 / 120);
  124 |   await expect(page.locator('#pause-overlay')).toBeHidden();
  125 | });
  126 | 
  127 | test('a browser-timestamped shot event advances simulation between delayed render frames', async ({ page }) => {
  128 |   await page.addInitScript(() => {
  129 |     const callbacks: FrameRequestCallback[] = [];
  130 |     (window as any).__delayedFrames = callbacks;
  131 |     window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  132 |   });
  133 |   await page.goto('/?debug=1');
  134 |   await page.waitForFunction(() => Boolean((window as any).__cricket));
  135 |   const result = await page.evaluate(async () => {
  136 |     const api = (window as any).__cricket;
  137 |     // Keep main.ts on its real timestamp path: do not call stopRendering().
  138 |     api.start('blue', 'club');
  139 |     api.game.start('blue', 'club', 1);
  140 |     api.game.advance(1);
  141 |     api.game.advance(.7);
  142 |     // Other cases cover rendering. Isolate input clock behavior from a software
  143 |     // GPU frame that can itself take longer than an entire real delivery.
  144 |     api.scene.update = () => {};
  145 |     const callback = (window as any).__delayedFrames.shift();
  146 |     callback(performance.now());
  147 |     const initial = { deliveryTime: api.game.deliveryTime, phase: api.game.phase };
  148 |     // Create the DOM key event in the browser after a controlled frame gap.
  149 |     // This avoids CDP keyboard delivery overhead swamping a 0.5s pace ball.
  150 |     await new Promise(resolve => setTimeout(resolve, 80));
  151 |     window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
  152 |     const game = api.game;
  153 |     return { initial, committed: { shot: game.shot, deliveryTime: game.deliveryTime, inputs: game.inputLog.length, phase: game.phase, paused: game.paused } };
  154 |   });
  155 |   const { initial, committed } = result;
  156 |   expect(initial.phase).toBe('delivery');
> 157 |   expect(committed.inputs, JSON.stringify({ initial, committed })).toBe(1);
      |                                                                    ^ Error: {"initial":{"deliveryTime":0.041666666666666664,"phase":"delivery"},"committed":{"shot":null,"deliveryTime":0.7499999999999998,"inputs":0,"phase":"feedback","paused":false}}
  158 |   expect(committed.shot.type).toBe('ground');
  159 |   expect(committed.shot.committedAt).toBeGreaterThanOrEqual(initial.deliveryTime + .07);
  160 |   expect(committed.shot.committedAt).toBe(committed.deliveryTime);
  161 | });
  162 | 
  163 | test('real seeded loft trajectories reach victory and Play Again resets the chase', async ({ page }) => {
  164 |   await openDebug(page);
  165 |   await page.evaluate(async () => {
  166 |     const api = (window as any).__cricket;
  167 |     const configPath = '/src/core/config.ts';
  168 |     const battingPath = '/src/batting/batting.ts';
  169 |     const { CONFIG } = await import(configPath);
  170 |     const { selectStroke } = await import(battingPath);
  171 |     api.ui.team = 'yellow';
  172 |     api.ui.difficulty = 'beginner';
  173 |     api.game.debug = false;
  174 |     api.game.start('yellow', 'beginner', 0);
  175 |     for (let tick = 0; tick < 120 * 200 && api.game.phase !== 'complete'; tick++) {
  176 |       const game = api.game;
  177 |       if (game.phase === 'delivery' && !game.shot && game.delivery) {
  178 |         const d = game.delivery;
  179 |         const direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
  180 |         const lead = CONFIG.lead[selectStroke(d, 'loft', direction)];
  181 |         if (game.deliveryTime + 1e-10 >= d.arrival - lead) game.commit('loft', direction);
  182 |       }
  183 |       game.advance(CONFIG.step);
  184 |     }
  185 |     api.scene.update(api.game.frame());
  186 |     api.ui.update();
  187 |   });
  188 |   await expect(page.getByRole('region', { name: 'Match result' })).toBeVisible();
  189 |   await expect(page.locator('#result-title')).toHaveText('VICTORY.');
  190 |   await expect(page.locator('#final-score')).toHaveText('18/0');
  191 |   const state = await page.evaluate(() => (window as any).__cricket.snapshot());
  192 |   expect(state.match.won).toBe(true);
  193 |   expect(state.match.balls).toBe(3);
  194 |   expect(state.match.outcomes.every((outcome: any) => outcome.runs === 6)).toBe(true);
  195 |   await page.screenshot({ path: 'tests/artifacts/victory.png' });
  196 |   await page.locator('#play-again').click();
  197 |   await expect(page.locator('#result-panel')).toBeHidden();
  198 |   await expect(page.locator('#match-ui')).toBeVisible();
  199 |   const replay = await page.evaluate(() => (window as any).__cricket.snapshot());
  200 |   expect(replay.match.team).toBe('yellow');
  201 |   expect(replay.match.difficulty).toBe('beginner');
  202 |   expect(replay.match.runs).toBe(0);
  203 |   expect(replay.match.balls).toBe(0);
  204 |   expect(replay.match.batters.every((batter: any) => batter.confidence === 50 && batter.history.length === 0)).toBe(true);
  205 | });
  206 | 
  207 | test('real no-input match reaches twelve balls and renders defeat and a return to menu', async ({ page }) => {
  208 |   await openDebug(page);
  209 |   await page.evaluate(() => {
  210 |     const api = (window as any).__cricket;
  211 |     api.game.debug = false;
  212 |     api.game.start('blue', 'club', 12);
  213 |     for (let tick = 0; tick < 120 * 200 && api.game.phase !== 'complete'; tick++) api.game.advance(1 / 120);
  214 |     api.scene.update(api.game.frame());
  215 |     api.ui.update();
  216 |   });
  217 |   await expect(page.locator('#result-title')).toHaveText('DEFEAT.');
  218 |   await expect(page.locator('#final-score')).toHaveText('0/2');
  219 |   const state = await page.evaluate(() => (window as any).__cricket.snapshot());
  220 |   expect(state.match.balls).toBe(12);
  221 |   expect(state.match.wickets).toBe(2);
  222 |   expect(state.match.outcomes).toHaveLength(12);
  223 |   await page.screenshot({ path: 'tests/artifacts/defeat.png' });
  224 |   await page.locator('#result-menu').click();
  225 |   await expect(page.locator('#menu-panel')).toBeVisible();
  226 |   await expect(page.locator('#result-panel')).toBeHidden();
  227 | });
  228 | 
  229 | test('live ball tracker follows an actual off-screen loft while the batting camera stays fixed', async ({ page }) => {
  230 |   await openDebug(page);
  231 |   const before = await page.evaluate(async () => {
  232 |     const api = (window as any).__cricket;
  233 |     api.game.debug = false;
  234 |     api.game.start('blue', 'club', 0);
  235 |     api.input.reset();
  236 |     for (let tick = 0; tick < 240 && api.game.phase !== 'delivery'; tick++) api.game.advance(1 / 120);
  237 |     for (let tick = 0; tick < 15; tick++) api.game.advance(1 / 120);
  238 |     api.scene.update(api.game.frame());
  239 |     api.ui.update();
  240 |     api.ui.drawTracker(!api.scene.isBallVisible(api.game.ball.position), api.game.ball.position);
  241 |     return {
  242 |       camera: api.scene.camera.matrixWorld.toArray(),
  243 |       incoming: { ...api.game.ball.position },
  244 |       phase: api.game.phase,
  245 |     };
  246 |   });
  247 |   expect(before.phase).toBe('delivery');
  248 |   await expect(page.locator('#match-ui')).toBeVisible();
  249 |   await expect(page.locator('#tracker')).toBeHidden();
  250 |   await page.screenshot({ path: 'tests/artifacts/gameplay-incoming.png' });
  251 |   const after = await page.evaluate(async () => {
  252 |     const api = (window as any).__cricket;
  253 |     const configPath = '/src/core/config.ts';
  254 |     const battingPath = '/src/batting/batting.ts';
  255 |     const { CONFIG } = await import(configPath);
  256 |     const { selectStroke } = await import(battingPath);
  257 |     const d = api.game.delivery;
```