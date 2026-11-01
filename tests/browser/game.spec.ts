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

test('menu and help buttons support Space activation and return keyboard focus', async ({ page }) => {
  await page.goto('/');
  await page.locator('#play').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Match setup' })).toBeVisible();
  await page.locator('#help').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#help-got-it').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#help')).toBeFocused();
});

test('help isolates gameplay shortcuts and preserves the previous pause state', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.start('blue', 'club');
    api.game.advance(1);
    api.ui.update();
  });
  await page.locator('#help').click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('s');
  const duringHelp = await page.evaluate(() => {
    const api = (window as any).__cricket;
    return { paused: api.game.paused, direction: api.input.direction, inputs: api.game.inputLog.length };
  });
  expect(duringHelp).toEqual({ paused: true, direction: 'straight', inputs: 0 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__cricket.game.paused)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.locator('#help').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect(page.locator('#pause-overlay')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__cricket.game.paused)).toBe(true);
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

test('run-up aim is retained, held shots never auto-bat, and pause blocks aiming', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.start('blue', 'beginner');
    api.game.start('blue', 'beginner', 12);
  });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('s');
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    while (api.game.phase === 'runup') api.game.advance(1 / 120);
    api.ui.update();
  });
  await page.keyboard.down('s');
  expect(await page.evaluate(() => (window as any).__cricket.game.shot)).toBeNull();
  await expect(page.locator('#direction-name')).toHaveText('Covers');
  await page.keyboard.up('s');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => (window as any).__cricket.input.direction)).toBe('cover');
  await page.locator('#resume').click();
  await page.keyboard.press('s');
  const committed = await page.evaluate(() => {
    const api = (window as any).__cricket;
    const shot = structuredClone(api.game.shot);
    for (let tick = 0; tick < 120 * 60; tick++) {
      if (api.game.phase === 'runup' && api.game.match.balls === 1) break;
      api.game.advance(1 / 120);
    }
    api.ui.update();
    return { shot, phase: api.game.phase, balls: api.game.match.balls, direction: api.input.direction, inputs: api.game.inputLog.length };
  });
  expect(committed.shot.direction).toBe('cover');
  expect(committed.inputs).toBe(1);
  expect(committed.phase).toBe('runup');
  expect(committed.balls).toBe(1);
  expect(committed.direction).toBe('cover');
  await page.keyboard.press('ArrowLeft');
  await page.evaluate(() => (window as any).__cricket.ui.update());
  await expect(page.locator('#direction-name')).toHaveText('Square leg');
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

for (const difficulty of ['beginner', 'club', 'pro'] as const) {
test(`a ${difficulty} timestamped shot and rendered frame share the scaled clock`, async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks: FrameRequestCallback[] = [];
    (window as any).__delayedFrames = callbacks;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => Boolean((window as any).__cricket));
  const result = await page.evaluate(async difficulty => {
    const api = (window as any).__cricket;
    // Keep main.ts on its real timestamp path: do not call stopRendering().
    api.start('blue', difficulty);
    api.game.start('blue', difficulty, 1);
    api.game.advance(1);
    api.game.advance(.7);
    // Other cases cover rendering. Isolate input clock behavior from a software
    // GPU frame that can itself take longer than an entire real delivery.
    api.scene.update = () => {};
    const callback = (window as any).__delayedFrames.shift();
    callback(performance.now());
    const initial = { deliveryTime: api.game.deliveryTime, phase: api.game.phase, wallTime: performance.now() };
    // Create the DOM key event in the browser after a controlled frame gap.
    // This avoids CDP keyboard delivery overhead swamping a 0.5s pace ball.
    await new Promise(resolve => setTimeout(resolve, 80));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', bubbles: true }));
    const game = api.game;
    const committed = { shot: game.shot, deliveryTime: game.deliveryTime, inputs: game.inputLog.length, phase: game.phase, paused: game.paused, wallTime: performance.now() };
    (window as any).__delayedFrames.shift()(performance.now());
    return { initial, committed, scale: game.timeScale, afterFrame: { deliveryTime: game.deliveryTime, wallTime: performance.now() } };
  }, difficulty);
  const { initial, committed } = result;
  expect(initial.phase).toBe('delivery');
  expect(committed.inputs, JSON.stringify({ initial, committed })).toBe(1);
  expect(committed.shot.type).toBe('ground');
  expect(result.scale).toBe(({ beginner: .55, club: .70, pro: .85 })[difficulty]);
  const expected = (committed.wallTime - initial.wallTime) / 1000 * result.scale;
  expect(Math.abs(committed.shot.committedAt - initial.deliveryTime - expected)).toBeLessThan(2 / 120);
  expect(committed.shot.committedAt).toBe(committed.deliveryTime);
  const total = (result.afterFrame.wallTime - initial.wallTime) / 1000 * result.scale;
  expect(Math.abs(result.afterFrame.deliveryTime - initial.deliveryTime - total)).toBeLessThan(2 / 120);
});
}

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

test('Home returns from a completed chase to the main menu', async ({ page }) => {
  await openDebug(page);
  await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.start('blue', 'beginner', 0);
    for (let tick = 0; tick < 120 * 200 && api.game.phase !== 'complete'; tick++) api.game.advance(1 / 120);
    api.ui.update();
  });
  await expect(page.locator('#result-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Fun Cricket home' }).click();
  await expect(page.locator('#menu-panel')).toBeVisible();
  await expect(page.locator('#result-panel')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__cricket.game.match)).toBeNull();
});

test('camera follows real outgoing flight, tracker covers its limits, and the next ball resets the view', async ({ page }) => {
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
      cameraPosition: api.scene.camera.position.toArray(),
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
    const direction = d.contact.x < 0 ? 'point' : 'leg';
    const inputAt = d.arrival - CONFIG.lead[selectStroke(d, 'loft', direction)];
    while (api.game.deliveryTime + 1e-10 < inputAt) api.game.advance(CONFIG.step);
    api.game.commit('loft', direction);
    const render = api.scene.renderer.render;
    // Exercise all presentation updates while avoiding hundreds of redundant
    // software-GPU draws. Render the captured frame once below.
    api.scene.renderer.render = () => {};
    try {
      for (let tick = 0; tick < 120 * 20; tick++) {
        api.game.advance(CONFIG.step);
        api.scene.update(api.game.frame());
        if (api.game.phase === 'outgoing' && api.game.phaseTime > .35 && !api.scene.isBallVisible(api.game.ball.position)) break;
      }
    } finally {
      api.scene.renderer.render = render;
    }
    const physicsBefore = JSON.stringify({ ball: api.game.ball, match: api.game.match, delivery: api.game.delivery });
    api.scene.update(api.game.frame());
    const physicsAfter = JSON.stringify({ ball: api.game.ball, match: api.game.match, delivery: api.game.delivery });
    api.ui.update();
    api.ui.drawTracker(!api.scene.isBallVisible(api.game.ball.position), api.game.ball.position);
    const pixels = (document.querySelector('#tracker-canvas') as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 200, 200).data;
    return {
      camera: api.scene.camera.matrixWorld.toArray(),
      cameraPosition: api.scene.camera.position.toArray(),
      phase: api.game.phase,
      visible: api.scene.isBallVisible(api.game.ball.position),
      position: { ...api.game.ball.position },
      contact: api.game.contactDebug,
      drawn: pixels.some((value: number) => value > 0),
      unchanged: physicsBefore === physicsAfter,
    };
  });
  expect(after.phase).toBe('outgoing');
  expect(after.visible).toBe(false);
  expect(after.contact).not.toBeNull();
  expect(after.drawn).toBe(true);
  expect(after.camera).not.toEqual(before.camera);
  expect(after.cameraPosition).toEqual(before.cameraPosition);
  expect(after.unchanged).toBe(true);
  await expect(page.locator('#tracker')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/gameplay-tracker.png' });
  const reset = await page.evaluate(() => {
    const api = (window as any).__cricket;
    for (let tick = 0; tick < 120 * 60 && api.game.phase !== 'runup'; tick++) api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    return { phase: api.game.phase, camera: api.scene.camera.matrixWorld.toArray() };
  });
  expect(reset.phase).toBe('runup');
  expect(reset.camera).toEqual(before.camera);
});

test('visible release, historical trail and bounce/contact effects follow actual physics and pause', async ({ page }) => {
  await openDebug(page);
  const release = await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.debug = false;
    api.start('blue', 'beginner');
    api.game.start('blue', 'beginner', 0);
    while (api.game.phase === 'runup') api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    api.ui.update();
    const visual = api.scene.scene.getObjectByName('live-cricket-ball');
    return { visible: visual.visible, scale: visual.scale.x, visualPosition: visual.position.toArray(), physicalPosition: Object.values(api.game.ball.position) };
  });
  expect(release.visible).toBe(true);
  expect(release.scale).toBeGreaterThan(1);
  expect(release.visualPosition).toEqual(release.physicalPosition);
  await page.screenshot({ path: 'tests/artifacts/v03-release.png' });

  const bounce = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    const configPath = '/src/core/config.ts', battingPath = '/src/batting/batting.ts';
    const { CONFIG } = await import(configPath), { selectStroke } = await import(battingPath);
    const d = api.game.delivery;
    const direction = d.contact.x < -.12 ? 'cover' : d.contact.x > .12 ? 'longOn' : 'straight';
    const at = d.arrival - CONFIG.lead[selectStroke(d, 'loft', direction)];
    const render = api.scene.renderer.render;
    api.scene.renderer.render = () => {};
    try {
      while (api.game.deliveryTime + 1e-10 < at) { api.game.advance(CONFIG.step); api.scene.update(api.game.frame()); }
      api.game.commit('loft', direction);
      while (api.game.phase === 'delivery' && !api.game.ball.bounced) { api.game.advance(CONFIG.step); api.scene.update(api.game.frame()); }
    } finally { api.scene.renderer.render = render; }
    api.scene.update(api.game.frame());
    api.ui.update();
    const pulse = api.scene.scene.getObjectByName('actual-bounce-pulse');
    return { visible: pulse.visible, x: pulse.position.x, z: pulse.position.z, expected: d.bounce, bounced: api.game.ball.bounced,
      trailVertices: api.scene.scene.getObjectByName('observed-ball-trail').geometry.drawRange.count, radius: CONFIG.ballRadius };
  });
  expect(bounce.bounced).toBe(true);
  expect(bounce.visible).toBe(true);
  expect(bounce.x).toBeCloseTo(bounce.expected.x, 8);
  expect(bounce.z).toBeCloseTo(bounce.expected.z, 8);
  expect(bounce.trailVertices).toBeGreaterThan(0);
  expect(bounce.radius).toBe(.036);
  await page.screenshot({ path: 'tests/artifacts/v03-bounce.png' });

  const contact = await page.evaluate(() => {
    const api = (window as any).__cricket;
    while (api.game.phase === 'delivery') api.game.advance(1 / 120);
    for (let tick = 0; tick < 5; tick++) api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    api.ui.update();
    const pulse = api.scene.scene.getObjectByName('actual-contact-pulse');
    const before = { time: api.game.time, ball: structuredClone(api.game.ball), opacity: pulse.children[0].material.opacity, camera: api.scene.camera.matrixWorld.toArray() };
    api.game.togglePause();
    api.game.advanceRealTime(20);
    api.scene.update(api.game.frame());
    const after = { time: api.game.time, ball: structuredClone(api.game.ball), opacity: pulse.children[0].material.opacity, camera: api.scene.camera.matrixWorld.toArray() };
    return { visible: pulse.visible, phase: api.game.phase, point: pulse.position.toArray(), expected: Object.values(api.game.contactDebug.point), before, after };
  });
  expect(contact.phase).toBe('outgoing');
  expect(contact.visible).toBe(true);
  expect(contact.point).toEqual(contact.expected);
  expect(contact.after).toEqual(contact.before);
  await expect(page.locator('#feedback-quality')).toHaveText('PERFECT!');
  await page.screenshot({ path: 'tests/artifacts/v03-contact.png' });

  const droppedFrame = await page.evaluate(() => {
    const api = (window as any).__cricket;
    api.game.menu(); api.scene.update(api.game.frame());
    api.game.start('blue', 'beginner', 0);
    // No rendered frame between delivery preparation, release and actual bounce.
    while (api.game.phase === 'runup' || !api.game.ball?.bounced) api.game.advance(1 / 120);
    api.scene.update(api.game.frame());
    return api.scene.scene.getObjectByName('actual-bounce-pulse').visible;
  });
  expect(droppedFrame).toBe(true);
});

test('timing feedback distinguishes physical early/late contact from a perfectly timed geometric miss', async ({ page }) => {
  await openDebug(page);
  const results = await page.evaluate(async () => {
    const api = (window as any).__cricket;
    const configPath = '/src/core/config.ts', battingPath = '/src/batting/batting.ts';
    const { CONFIG } = await import(configPath), { selectStroke } = await import(battingPath);
    const results = [];
    for (const fixture of [
      { seed: 0, type: 'loft', direction: 'longOn', offset: -.13, ball: 0 },
      { seed: 5, type: 'ground', direction: 'cover', offset: .075, ball: 0 },
      { seed: 23, type: 'defend', direction: 'fineLeg', offset: 0, ball: 6 },
    ]) {
      api.start('blue', 'club');
      api.game.start('blue', 'club', fixture.seed);
      api.game.debug = false;
      for (let tick = 0; tick < 120 * 180 && api.game.match.balls <= fixture.ball; tick++) {
        const game = api.game;
        if (game.match.balls === fixture.ball && game.phase === 'delivery' && !game.shot) {
          const d = game.delivery;
          const at = d.arrival - CONFIG.lead[selectStroke(d, fixture.type, fixture.direction)] + fixture.offset;
          if (game.deliveryTime + 1e-10 >= at) game.commit(fixture.type, fixture.direction);
        }
        game.advance(CONFIG.step);
      }
      api.ui.update();
      results.push({ quality: api.game.outcome.quality, timingError: api.game.outcome.timingError, contact: !!api.game.contactDebug,
        label: document.querySelector('#feedback-quality')!.textContent, note: document.querySelector('#feedback-note')!.textContent });
    }
    api.scene.update(api.game.frame());
    return results;
  });
  expect(results[0]).toMatchObject({ quality: 'mistimed', contact: true, label: 'EARLY' });
  expect(results[0].note).toContain('later');
  expect(results[1]).toMatchObject({ quality: 'good', contact: true, label: 'LATE' });
  expect(results[1].note).toContain('sooner');
  expect(results[2]).toMatchObject({ quality: 'miss', contact: false, label: 'MISSED' });
  expect(Math.abs(results[2].timingError)).toBeLessThan(1 / 120);
  expect(results[2].note).toContain('direction or shot');
  await page.screenshot({ path: 'tests/artifacts/v03-geometric-miss.png' });
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
