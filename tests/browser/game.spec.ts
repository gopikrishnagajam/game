import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    // Freeze each navigation's source while other development work continues.
    // The application has no gameplay WebSocket; this prevents Vite HMR reloads.
    await page.routeWebSocket('**', () => {});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(errors);
    expect(errors, 'Browser page and console errors').toEqual([]);
  }, { auto: true }],
});

async function openDebug(page: Page) {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__cricket));
  await page.evaluate(() => (window as any).__cricket.stopRendering());
}

test('normal menu renders the cricket scene and exposes working help and sound controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /TWO OVERS/ })).toBeVisible();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect(page.locator('#debug-panel')).toBeHidden();
  expect(await page.evaluate(() => '__cricket' in window)).toBe(false);
  const canvas = await page.locator('.viewport canvas').boundingBox();
  expect(canvas!.width).toBeGreaterThan(1000);
  expect(canvas!.height).toBeGreaterThan(600);
  await page.screenshot({ path: 'tests/artifacts/menu.png' });

  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick. Time. Chase.' })).toBeVisible();
  await page.getByRole('button', { name: /GOT IT/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible();
});

test('Team Yellow and Pro setup produce the selected live match and support pause/resume', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /PLAY QUICK CHASE/ }).click();
  await expect(page.getByRole('region', { name: 'Match setup' })).toBeVisible();
  await page.locator('[data-team="yellow"]').click();
  await page.locator('[data-difficulty="pro"]').click();
  await expect(page.locator('[data-team="yellow"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-team="blue"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-difficulty="pro"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#setup-target')).toHaveText('32');
  await page.screenshot({ path: 'tests/artifacts/setup-yellow-pro.png' });
  await page.locator('#start').click();
  await page.getByRole('button', { name: 'Pause match' }).click();
  await expect(page.locator('#score-team')).toHaveText('TEAM YELLOW vs BLUE');
  await expect(page.locator('#target')).toHaveText('32');
  await expect(page.locator('#confidence-value')).toHaveText('50%');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/match-paused.png' });
  await page.locator('#resume').click();
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
});

test('arrow selection and S keyboard input lock one physical shot and suppress key repeats', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.start('blue', 'club', 1);
    api.game.advance(1);
    api.game.advance(.7);
    api.ui.update();
  });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('s');
  await page.keyboard.down('s');
  await page.keyboard.up('s');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('d');
  const shot = await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.ui.update();
    return { phase: api.game.phase, shot: api.game.shot, log: api.game.inputLog, selection: api.input.direction };
  });
  expect(shot.phase).toBe('delivery');
  expect(shot.shot.type).toBe('ground');
  expect(shot.shot.direction).toBe('cover');
  expect(shot.log).toHaveLength(1);
  expect(shot.selection).toBe('cover');
  await expect(page.locator('#direction-name')).toHaveText('Covers');
  await expect(page.locator('#direction-lock')).toHaveText('LOCKED');
});

test('losing focus pauses the live simulation until explicit resume', async ({ page }) => {
  await openDebug(page);
  const initial = await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.start('blue', 'club', 12);
    api.game.advance(.5);
    window.dispatchEvent(new Event('blur'));
    api.ui.update();
    return api.game.time;
  });
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const paused = await page.evaluate(() => {
    const game = (window as any).__cricket.game;
    game.advance(60);
    return { time: game.time, paused: game.paused };
  });
  expect(paused).toEqual({ time: initial, paused: true });
  await page.locator('#resume').click();
  const resumed = await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.advance(1 / 120);
    api.ui.update();
    return { time: api.game.time, paused: api.game.paused };
  });
  expect(resumed.paused).toBe(false);
  expect(resumed.time).toBeCloseTo(initial + 1 / 120);
  await expect(page.locator('#pause-overlay')).toBeHidden();
});

test('a browser-timestamped shot event advances simulation between delayed render frames', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks: FrameRequestCallback[] = [];
    (window as any).__delayedFrames = callbacks;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__cricket));
  const result = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    // Keep main.ts on its real timestamp path: do not call stopRendering().
    api.start('blue', 'club');
    api.game.start('blue', 'club', 1);
    api.game.advance(1);
    api.game.advance(.7);
    // Other cases cover rendering. Isolate input clock behavior from a software
    // GPU frame that can itself take longer than an entire real delivery.
    api.scene.update = () => {};
    const callback = (window as any).__delayedFrames.shift();
    callback(performance.now());
    const initial = { deliveryTime: api.game.deliveryTime, phase: api.game.phase };
    // Create the DOM key event in the browser after a controlled frame gap.
    // This avoids CDP keyboard delivery overhead swamping a 0.5s pace ball.
    await new Promise(resolve => setTimeout(resolve, 80));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
    const game = api.game;
    return { initial, committed: { shot: game.shot, deliveryTime: game.deliveryTime, inputs: game.inputLog.length, phase: game.phase, paused: game.paused } };
  });
  const { initial, committed } = result;
  expect(initial.phase).toBe('delivery');
  expect(committed.inputs, JSON.stringify({ initial, committed })).toBe(1);
  expect(committed.shot.type).toBe('ground');
  expect(committed.shot.committedAt).toBeGreaterThanOrEqual(initial.deliveryTime + .07);
  expect(committed.shot.committedAt).toBe(committed.deliveryTime);
});

test('real seeded loft trajectories reach victory and Play Again resets the chase', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(async () => {
    const api = (window as any).__cricket;
    const configPath = '/src/core/config.ts';
    const battingPath = '/src/batting/batting.ts';
    const { CONFIG } = await import(configPath);
    const { selectStroke } = await import(battingPath);
    api.ui.team = 'yellow';
    api.ui.difficulty = 'beginner';
    api.game.debug = false;
    api.game.start('yellow', 'beginner', 0);
    for (let tick = 0; tick < 120 * 200 && api.game.phase !== 'complete'; tick++) {
      const game = api.game;
      if (game.phase === 'delivery' && !game.shot && game.delivery) {
        const d = game.delivery;
        const direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
        const lead = CONFIG.lead[selectStroke(d, 'loft', direction)];
        if (game.deliveryTime + 1e-10 >= d.arrival - lead) game.commit('loft', direction);
      }
      game.advance(CONFIG.step);
    }
    api.scene.update(api.game.frame());
    api.ui.update();
  });
  await expect(page.getByRole('region', { name: 'Match result' })).toBeVisible();
  await expect(page.locator('#result-title')).toHaveText('VICTORY.');
  await expect(page.locator('#final-score')).toHaveText('18/0');
  const state = await page.evaluate(() => (window as any).__cricket.snapshot());
  expect(state.match.won).toBe(true);
  expect(state.match.balls).toBe(3);
  expect(state.match.outcomes.every((outcome: any) => outcome.runs === 6)).toBe(true);
  await page.screenshot({ path: 'tests/artifacts/victory.png' });
  await page.locator('#play-again').click();
  await expect(page.locator('#result-panel')).toBeHidden();
  await expect(page.locator('#match-ui')).toBeVisible();
  const replay = await page.evaluate(() => (window as any).__cricket.snapshot());
  expect(replay.match.team).toBe('yellow');
  expect(replay.match.difficulty).toBe('beginner');
  expect(replay.match.runs).toBe(0);
  expect(replay.match.balls).toBe(0);
  expect(replay.match.batters.every((batter: any) => batter.confidence === 50 && batter.history.length === 0)).toBe(true);
});

test('real no-input match reaches twelve balls and renders defeat and a return to menu', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.debug = false;
    api.game.start('blue', 'club', 12);
    for (let tick = 0; tick < 120 * 200 && api.game.phase !== 'complete'; tick++) api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    api.ui.update();
  });
  await expect(page.locator('#result-title')).toHaveText('DEFEAT.');
  await expect(page.locator('#final-score')).toHaveText('0/2');
  const state = await page.evaluate(() => (window as any).__cricket.snapshot());
  expect(state.match.balls).toBe(12);
  expect(state.match.wickets).toBe(2);
  expect(state.match.outcomes).toHaveLength(12);
  await page.screenshot({ path: 'tests/artifacts/defeat.png' });
  await page.locator('#result-menu').click();
  await expect(page.locator('#menu-panel')).toBeVisible();
  await expect(page.locator('#result-panel')).toBeHidden();
});

test('live ball tracker follows an actual off-screen loft while the batting camera stays fixed', async ({ page }) => {
  await openDebug(page);
  const before = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    api.game.debug = false;
    api.game.start('blue', 'club', 0);
    api.input.reset();
    for (let tick = 0; tick < 240 && api.game.phase !== 'delivery'; tick++) api.game.advance(1 / 120);
    for (let tick = 0; tick < 15; tick++) api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    api.ui.update();
    api.ui.drawTracker(!api.scene.isBallVisible(api.game.ball.position), api.game.ball.position);
    return {
      camera: api.scene.camera.matrixWorld.toArray(),
      incoming: { ...api.game.ball.position },
      phase: api.game.phase,
    };
  });
  expect(before.phase).toBe('delivery');
  await expect(page.locator('#match-ui')).toBeVisible();
  await expect(page.locator('#tracker')).toBeHidden();
  await page.screenshot({ path: 'tests/artifacts/gameplay-incoming.png' });
  const after = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    const configPath = '/src/core/config.ts';
    const battingPath = '/src/batting/batting.ts';
    const { CONFIG } = await import(configPath);
    const { selectStroke } = await import(battingPath);
    const d = api.game.delivery;
    const direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
    const inputAt = d.arrival - CONFIG.lead[selectStroke(d, 'loft', direction)];
    while (api.game.deliveryTime + 1e-10 < inputAt) api.game.advance(CONFIG.step);
    api.game.commit('loft', direction);
    for (let tick = 0; tick < 120 * 20; tick++) {
      api.game.advance(CONFIG.step);
      if (api.game.phase === 'outgoing' && !api.scene.isBallVisible(api.game.ball.position)) break;
    }
    api.scene.update(api.game.frame());
    api.ui.update();
    api.ui.drawTracker(!api.scene.isBallVisible(api.game.ball.position), api.game.ball.position);
    const pixels = (document.querySelector('#tracker-canvas') as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 200, 200).data;
    return {
      camera: api.scene.camera.matrixWorld.toArray(),
      phase: api.game.phase,
      visible: api.scene.isBallVisible(api.game.ball.position),
      position: { ...api.game.ball.position },
      contact: api.game.contactDebug,
      drawn: pixels.some((value: number) => value > 0),
    };
  });
  expect(after.phase).toBe('outgoing');
  expect(after.visible).toBe(false);
  expect(after.contact).not.toBeNull();
  expect(after.drawn).toBe(true);
  expect(after.camera).toEqual(before.camera);
  await expect(page.locator('#tracker')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/gameplay-tracker.png' });
});

test('all three difficulties complete real seeded chases in the browser simulation', async ({ page }) => {
  await openDebug(page);
  const matches = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    const configPath = '/src/core/config.ts';
    const battingPath = '/src/batting/batting.ts';
    const { CONFIG } = await import(configPath);
    const { selectStroke } = await import(battingPath);
    const results = [];
    for (const difficulty of ['beginner', 'club', 'pro']) {
      api.game.start('blue', difficulty, 0);
      for (let tick = 0; tick < 120 * 300 && api.game.phase !== 'complete'; tick++) {
        const game = api.game;
        if (game.phase === 'delivery' && !game.shot && game.delivery) {
          const d = game.delivery;
          const direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
          const inputAt = d.arrival - CONFIG.lead[selectStroke(d, 'loft', direction)];
          if (game.deliveryTime + 1e-10 >= inputAt) game.commit('loft', direction);
        }
        game.advance(CONFIG.step);
      }
      results.push({ difficulty, phase: api.game.phase, match: structuredClone(api.game.match) });
    }
    return results;
  });
  expect(matches.map(result => result.match.target)).toEqual([16, 24, 32]);
  for (const result of matches) {
    expect(result.phase).toBe('complete');
    expect(result.match.complete).toBe(true);
    expect(result.match.balls).toBeGreaterThan(0);
    expect(result.match.balls).toBeLessThanOrEqual(12);
    expect(result.match.outcomes).toHaveLength(result.match.balls);
    expect(result.match.won || result.match.wickets === 3 || result.match.balls === 12).toBe(true);
  }
});

test('production build runs without external requests or developer hooks', async ({ page }) => {
  const productionURL = process.env.CRICKET_PRODUCTION_URL;
  test.skip(!productionURL, 'Set CRICKET_PRODUCTION_URL to a running production preview to verify the built artifact.');
  const origin = new URL(productionURL!).origin;
  const external: string[] = [];
  await page.route('**/*', route => {
    const requestURL = new URL(route.request().url());
    if (requestURL.origin === origin) return route.continue();
    external.push(requestURL.href);
    return route.abort();
  });
  await page.goto(`${productionURL!}/?debug=1`);
  await expect(page.locator('#menu-panel')).toBeVisible();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect(page.locator('#debug-panel')).toBeHidden();
  expect(await page.evaluate(() => '__cricket' in window)).toBe(false);
  await page.getByRole('button', { name: /PLAY QUICK CHASE/ }).click();
  await page.locator('[data-team="yellow"]').click();
  await page.locator('[data-difficulty="beginner"]').click();
  await expect(page.locator('#setup-target')).toHaveText('16');
  await page.locator('#start').click();
  await page.getByRole('button', { name: 'Pause match' }).click();
  await expect(page.locator('#score-team')).toHaveText('TEAM YELLOW vs BLUE');
  await expect(page.locator('#target')).toHaveText('16');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/production.png' });
  await page.locator('#pause-menu').click();
  await expect(page.locator('#menu-panel')).toBeVisible();
  expect(external).toEqual([]);
});
