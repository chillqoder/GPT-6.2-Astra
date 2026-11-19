// Run with playwright-cli run-code --filename=tests/browser.cjs against the local server.
(async (page) => {
  const assert = (v, why) => {
    if (!v) throw Error(why);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = new URL(page.url()).origin;
  await page.goto(base + '/?verify');
  await page.waitForFunction(() => window.expeditionCheck);
  await page.evaluate(() => {
    localStorage.removeItem('deepwake.records.v1');
    localStorage.removeItem('deepwake.settings.v1');
  });
  await page.reload();
  await page.waitForFunction(() => window.expeditionCheck);
  const state = () =>
    page.evaluate(() => ({
      mode: expeditionCheck.game.mode,
      x: expeditionCheck.game.p.x,
      elapsed: expeditionCheck.game.elapsed,
      recoveries: expeditionCheck.game.recoveries,
      relays: expeditionCheck.game.world.relays.length,
    }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Read Crystal Reservoir briefing' }).click();
  assert(await page.locator('#panelTitle').textContent() === 'Crystal Reservoir', 'region briefing');
  await page.keyboard.press('Escape');
  await page.locator('#manual').click();
  await page.getByRole('checkbox', { name: 'Reduce motion' }).check();
  await page.keyboard.press('Escape');
  await page.locator('#mute').click();
  assert(await page.locator('#mute').getAttribute('aria-pressed') === 'true', 'mute');
  await page.locator('#begin').click();
  await page.keyboard.down('d');
  await page.waitForFunction(() => expeditionCheck.game.p.x > 4.6);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => expeditionCheck.game.p.y > .2);
  await page.keyboard.up('Space');
  await page.keyboard.up('d');
  await page.keyboard.press('q');
  await page.waitForFunction(() => expeditionCheck.game.p.energy < 100);
  await page.keyboard.press('p');
  const frozen = await state();
  await page.waitForTimeout(180);
  assert((await state()).elapsed === frozen.elapsed, 'pause clock');
  await page.locator('#resume').click();
  await page.keyboard.down('a');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('a');
  assert((await state()).mode === 'paused', 'focus-loss pause');
  await page.locator('#resume').click();
  await page.keyboard.press('r');
  await page.waitForFunction(() => expeditionCheck.game.mode === 'play');
  assert((await state()).recoveries === 1, 'one checkpoint retry');
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  assert((await state()).recoveries === 0, 'full restart');
  for (const [width, height] of [[390, 844], [740, 360], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(90);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.hud,#touch button,.header-tools button')].filter((e) =>
        e.getClientRects().length
      ).some((e) => {
        const r = e.getBoundingClientRect();
        return r.left < 0 || r.right > innerWidth + .5 || r.bottom > innerHeight + .5 || r.top < 0;
      })
    );
    assert(!bad, 'control bounds ' + width + 'x' + height);
    if (width === 740) {
      const combination = await page.evaluate(() => {
        const right = document.querySelector('[data-key=right]'),
          jump = document.querySelector('[data-key=jump]');
        // Synthetic pointer IDs have no native capture. Actual multitouch follows via CDP below.
        return [right, jump].map((b) => {
          const r = b.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
      });
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      const [move, leap] = combination;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...move, id: 1 }],
      });
      await page.waitForFunction(() => expeditionCheck.game.p.vx > 1);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...move, id: 1 }, { ...leap, id: 2 }],
      });
      await page.waitForFunction(() => expeditionCheck.game.p.vx > 1 && expeditionCheck.game.p.vy > 1);
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForFunction(() => Math.abs(expeditionCheck.game.p.vx) < .05);
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await client.detach();
    }
  }
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  const runs = [];
  for (const optional of [false, true]) {
    const output = await page.evaluate(async (optional) => {
      const api = expeditionCheck;
      api.setManual(true);
      const { runRoute } = await import('/tests/route.js');
      const { Expedition } = await import('/src/simulation.js');
      // Derive inputs on a new production simulation and replay them on the loaded browser game.
      const planner = new Expedition();
      planner.restart();
      const script = [], marks = new Map();
      runRoute(planner, {
        optional,
        step: (i) => {
          script.push(i);
          planner.step(i);
        },
        milestone: (s) => marks.set(script.length, s),
      });
      const g = api.game, seen = [], width = innerWidth, height = innerHeight;
      let savedWorld = null;
      for (let i = 0; i < script.length; i++) {
        api.step(script[i]);
        if (g.mode === 'archive') document.querySelector('#continue').click();
        if (marks.has(i + 1)) seen.push(marks.get(i + 1));
        if (!savedWorld && g.world.relays.includes('A')) savedWorld = JSON.stringify(g.checkpoint.world);
        if (i % 64 === 0 || marks.has(i + 1)) {
          api.draw();
          await new Promise(requestAnimationFrame);
        }
      }
      if (!savedWorld || JSON.parse(savedWorld).cells.find((c) => c.id === 'amber').socket !== 'work') {
        throw Error('Workshop commit');
      }
      return {
        renderer: api.view.constructor.name,
        mode: g.mode,
        result: g.result,
        frames: script.length,
        milestones: seen,
        viewport: [width, height],
        records: api.records.data,
      };
    }, optional);
    assert(
      output.mode === 'complete' && output.result.archives === (optional ? 3 : 0) &&
        output.result.recoveries === 0,
      'rendered route completion',
    );
    assert(await page.locator('#panelTitle').textContent() === 'Signal Restored', 'completion overlay');
    runs.push(output);
    if (!optional) await page.locator('#newrun').click();
  }
  await page.setViewportSize({ width: 740, height: 360 });
  const fits = await page.locator('#panel').evaluate((e) =>
    e.getBoundingClientRect().height <= innerHeight && e.scrollHeight > e.clientHeight
  );
  assert(fits, 'scrolling result panel');
  await page.reload();
  await page.waitForFunction(() => window.expeditionCheck);
  assert(
    await page.evaluate(() =>
      expeditionCheck.records.data.full > 0 && expeditionCheck.records.data.fewest.n === 0
    ),
    'records reload',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#begin').click();
  await page.evaluate(async () => {
    const api = expeditionCheck;
    api.setManual(true);
    const { runRoute } = await import('/tests/route.js');
    const { Expedition } = await import('/src/simulation.js');
    const plan = new Expedition();
    plan.restart();
    const inputs = [];
    runRoute(plan, {
      optional: true,
      step: (i) => {
        inputs.push(i);
        plan.step(i);
      },
    });
    for (const i of inputs) {
      api.step(i);
      if (api.game.mode === 'archive') document.querySelector('#continue').click();
      if (api.game.world.archives.includes('b')) break;
    }
    if (api.game.checkpoint.id !== 'saveA') throw Error('Need workshop snapshot before reservoir relay');
  });
  await page.keyboard.press('r');
  await page.evaluate(() => {
    expeditionCheck.advance({}, 110);
  });
  const rollback = await page.evaluate(() => {
    const g = expeditionCheck.game;
    return g.mode === 'play' && g.recoveries === 1 && g.world.relays.join() === 'A' &&
      g.world.archives.join() === 'a' && g.world.cells[0].socket === 'work' && g.p.x === g.checkpoint.x;
  });
  assert(rollback, 'committed socket and rollback of reservoir archive after retry');
  const offline = await page.context().newPage();
  await offline.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (k, ...other) {
      return /webgl/i.test(k) ? null : get.call(this, k, ...other);
    };
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('Storage unavailable');
      },
    });
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await offline.goto(base + '/?verify');
  await offline.waitForFunction(() =>
    window.expeditionCheck?.view.constructor.name === 'FlatView' &&
    expeditionCheck.view.poster.naturalWidth > 0
  );
  await offline.locator('#begin').click();
  await offline.keyboard.down('d');
  await offline.waitForFunction(() => expeditionCheck.game.p.x > 4.5);
  await offline.keyboard.up('d');
  await offline.close();
  assert(!errors.length, 'browser errors ' + errors.join(', '));
  return {
    rollback,
    compatibility: true,
    keyboard: true,
    touch: true,
    focus: true,
    retry: true,
    restart: true,
    responsive: true,
    errors,
    runs,
  };
})
