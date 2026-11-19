import test from 'node:test';
import assert from 'node:assert/strict';
import { DT, Expedition, rayHit } from '../src/simulation.js';
import { objectBy, platforms } from '../src/level.js';
import { Records } from '../src/records.js';
import { runRoute } from './route.js';

function fresh(x = 4, y = 0) {
  const g = new Expedition();
  g.restart();
  Object.assign(g.p, { x, y });
  return g;
}
function frames(g, n, input = {}) {
  for (let i = 0; i < n; i++) g.step(input);
}
function at(g, x, y) {
  Object.assign(g.p, { x, y, vx: 0, vy: 0, grounded: true, wall: 0, stand: null, coyote: .11 });
}
function close(a, b, e = .00001) {
  assert.ok(Math.abs(a - b) < e, `expected ${a} within ${e} of ${b}`);
}
function apex(short) {
  const g = fresh();
  g.step({ jumpPress: true });
  if (short) g.step({ jumpRelease: true });
  let y = 0;
  for (let i = 0; i < 115; i++) {
    g.step();
    y = Math.max(y, g.p.y);
  }
  assert.ok(g.p.grounded);
  return y;
}

test('held and tap jump heights, acceleration and braking', () => {
  const high = apex(false), low = apex(true);
  assert.ok(high > 2.55 && high < 2.65);
  assert.ok(low > 1.2 && low < 1.5);
  const g = fresh();
  frames(g, 4, { right: true });
  close(g.p.vx, 1.4);
  frames(g, 20, { right: true });
  close(g.p.vx, 6.5);
  frames(g, 25);
  close(g.p.vx, 0);
});
test('coyote window, expired coyote, no double jump, buffered landing, low ceiling', () => {
  const g = fresh(16.36, 1.4);
  g.p.vx = 6.5;
  frames(g, 5, { right: true });
  assert.ok(!g.p.grounded);
  g.step({ jumpPress: true });
  assert.ok(g.p.vy > 12);
  frames(g, 5);
  const vy = g.p.vy;
  g.step({ jumpPress: true });
  assert.ok(g.p.vy < vy);
  const b = fresh(16.36, 1.4);
  b.p.vx = 6.5;
  frames(b, 20, { right: true });
  b.step({ jumpPress: true });
  assert.ok(b.p.vy < 0);
  at(b, 5, .17);
  Object.assign(b.p, { vy: -4, grounded: false, coyote: 0 });
  b.step({ jumpPress: true });
  frames(b, 8);
  assert.ok(b.p.vy > 11);
  at(b, 24, 0);
  b.step({ jumpPress: true });
  frames(b, 3);
  assert.ok(b.p.y <= .05 + .0001 && b.p.vy <= 0);
});
test('wall contact, grounded exclusion, slide limit, wall jump lock and refresh', () => {
  const g = fresh(75.875);
  g.step({ right: true });
  assert.equal(g.p.wall, 0);
  Object.assign(g.p, { y: 3, grounded: false, coyote: 0, vy: -8, airDash: false, dashCD: .31 });
  g.step({ right: true });
  assert.equal(g.p.wall, 1);
  close(g.p.vy, -3);
  g.step({ right: true, jumpPress: true });
  assert.ok(g.p.vx < -6.9 && g.p.vy > 12 && g.p.airDash);
  frames(g, 10, { right: true });
  assert.ok(g.p.vx < 0 && g.p.steer > 0 && g.p.dashCD > 0);
});
test('dash locks direction, coasts out, blocks solid terrain, breaks seams', () => {
  const g = fresh();
  g.step({ dashPress: true });
  frames(g, 18, { left: true });
  assert.equal(g.p.facing, 1);
  close(g.p.vx, 15);
  g.step({ left: true });
  close(g.p.dash, 0);
  assert.ok(g.p.x > 6.3 && g.p.x < 6.6);
  assert.ok(g.p.dashCD > .26);
  at(g, 30.75, 0);
  g.p.dashCD = 0;
  g.step({ dashPress: true });
  frames(g, 12);
  assert.deepEqual(g.world.broken, ['training']);
  at(g, 53.5, 0);
  Object.assign(g.p, { dash: 0, dashCD: 0, airDash: true });
  g.step({ dashPress: true });
  frames(g, 10, { right: true });
  assert.ok(g.p.x <= 54 - .375 + .0001);
  assert.equal(g.p.airDash, true);
  const a = fresh();
  a.step({ jumpPress: true });
  a.step({ dashPress: true });
  frames(a, 21);
  assert.equal(a.p.airDash, false);
  frames(a, 120);
  assert.equal(a.p.airDash, true);
});
test('pulse cost, regeneration delay, recharge, radius, occlusion and unique hits', () => {
  const g = fresh(37);
  g.pulse();
  close(g.p.energy, 65);
  g.pulse();
  close(g.p.energy, 65);
  g.step();
  frames(g, 43);
  assert.equal(g.machines[0].state, 'stunned');
  assert.equal(g.events.filter((n) => n === 'stun').length, 1);
  assert.equal(g.waves.length, 0);
  frames(g, 125);
  close(g.p.energy, 65);
  frames(g, 40);
  assert.ok(g.p.energy > 68);
  g.p.energy = 20;
  g.p.pulseCD = 0;
  g.pulse();
  close(g.p.energy, 20);
  assert.equal(g.waves.length, 0);
  assert.equal(g.events.at(-1), 'empty');
  assert.ok(g.reach(30, 1, 33, 1, true));
  assert.equal(g.reach(30, 1, 33, 1), false);
  assert.equal(g.reach(53, 1, 56, 1, true), false);
  assert.ok(Number.isFinite(rayHit(0, 1, 10, 1, { x: 2, y: 0, w: 2, h: 2 })));
  at(g, 51.6, 0);
  g.world.cells[0].socket = 'work';
  g.rebuildSolids();
  g.p.energy = 100;
  g.pulse();
  frames(g, 52);
  assert.deepEqual(g.world.relays, []);
});
test('shield threshold, ordinary immunity, single shutdown and deep channel', () => {
  const g = fresh();
  g.p.energy = 50;
  g.damage(3);
  close(g.p.energy, 0);
  assert.equal(g.p.integrity, 3);
  g.damage(5);
  assert.equal(g.p.integrity, 3);
  g.p.immune = 0;
  g.p.energy = 49;
  g.damage(5);
  assert.equal(g.p.integrity, 2);
  close(g.p.energy, 49);
  g.damage(5);
  assert.equal(g.p.integrity, 2);
  g.p.immune = 0;
  g.p.integrity = 1;
  g.damage(5);
  g.damage(5);
  g.recover();
  assert.equal(g.mode, 'shutdown');
  assert.equal(g.recoveries, 1);
  frames(g, 150);
  assert.equal(g.p.integrity, 3);
  assert.equal(g.p.energy, 100);
  at(g, 95, .05);
  g.step();
  assert.equal(g.mode, 'shutdown');
  assert.equal(g.recoveries, 2);
});
test('skitter locks lunge, stunned contacts are safe, disable is recorded once', () => {
  const g = fresh(36);
  const m = g.machines[0];
  m.state = 'patrol';
  g.updateMachines(DT);
  assert.equal(m.state, 'alert');
  const dir = m.dir;
  g.p.x = 40;
  for (let i = 0; i < 64; i++) g.updateMachines(DT);
  assert.equal(m.state, 'lunge');
  assert.equal(m.dir, dir);
  m.state = 'stunned';
  m.timer = 1;
  at(g, m.x, m.y);
  g.updateMachines(DT);
  assert.equal(g.p.energy, 100);
  g.p.dash = .15;
  g.updateMachines(DT);
  g.updateMachines(DT);
  assert.deepEqual(g.world.disabled, ['s1']);
  const h = fresh(38.3);
  h.p.dash = .12;
  h.updateMachines(DT);
  assert.equal(h.p.energy, 50);
});
test('drone locks its aim, bolt expires on terrain, sentinel deflects until venting', () => {
  const g = fresh(107, 6.15), d = g.machines[1];
  g.updateMachines(DT);
  assert.equal(d.state, 'aim');
  const [ax, ay] = [d.aimX, d.aimY];
  g.p.x = 109;
  for (let i = 0; i < 100; i++) g.updateMachines(DT);
  assert.equal(d.aimX, ax);
  assert.equal(d.aimY, ay);
  const bolt = { x: 106, y: 6.18, vx: 0, vy: -8, t: 2 };
  g.bolts = [bolt];
  g.updateMachines(DT);
  assert.equal(g.bolts.length, 0);
  const sentinel = fresh(134.5, 0);
  const m = sentinel.machines[2];
  m.state = 'closed';
  sentinel.pulse();
  for (let i = 0; i < 50; i++) sentinel.updateWaves(DT);
  assert.equal(m.state, 'closed');
  assert.ok(sentinel.events.includes('deflect'));
  m.state = 'venting';
  sentinel.p.pulseCD = 0;
  sentinel.pulse();
  for (let i = 0; i < 49; i++) sentinel.updateWaves(DT);
  assert.equal(m.state, 'disabled');
  sentinel.updateMachines(DT);
  assert.ok(sentinel.world.disabled.includes('t1'));
});
test('cell ownership, carry movement restrictions, insertion priority, safe placement', () => {
  const g = fresh(45.6);
  g.interact();
  assert.equal(g.p.carry, 'amber');
  g.step({ right: true, pulsePress: true, dashPress: true, jumpPress: true });
  assert.equal(g.p.energy, 100);
  assert.equal(g.p.dash, 0);
  assert.ok(g.p.vy > 12);
  frames(g, 32, { right: true });
  close(g.p.vx, 4.5);
  at(g, 51.8, 0);
  g.interact();
  assert.equal(g.p.carry, null);
  assert.equal(g.world.cells[0].socket, 'work');
  g.interact();
  assert.equal(g.p.carry, 'amber');
  assert.equal(g.world.cells[0].socket, null);
  at(g, 15.8, 1.4);
  g.interact();
  assert.equal(g.p.carry, 'amber');
  at(g, 46, 0);
  g.interact();
  assert.equal(g.p.carry, null);
  assert.equal(g.world.cells.length, 2);
  close(g.world.cells[0].x, 46.98);
});
test('atomic checkpoint commits machinery and archives, rolls back later world changes', () => {
  const g = fresh();
  g.world.cells[0].socket = 'work';
  g.world.archives.push('a');
  g.world.broken.push('training');
  g.relay('A');
  assert.equal(g.checkpoint.id, 'saveA');
  frames(g, 160);
  g.world.cells[0].socket = null;
  g.world.archives.push('b');
  g.world.caches.push('w-cache');
  g.world.disabled.push('d1');
  g.world.broken.push('archive-seam');
  g.world.latch = true;
  g.bolts.push({ x: 0, y: 0, t: 5 });
  const t = g.elapsed;
  g.recover();
  frames(g, 105);
  assert.ok(g.elapsed >= t);
  assert.equal(g.recoveries, 1);
  assert.equal(g.world.cells[0].socket, 'work');
  assert.deepEqual(g.world.archives, ['a']);
  assert.deepEqual(g.world.relays, ['A']);
  assert.deepEqual(g.world.broken, ['training']);
  assert.equal(g.world.latch, false);
  assert.equal(g.world.caches.length + g.world.disabled.length + g.bolts.length, 0);
  assert.equal(g.p.x, objectBy('saveA').x);
});
test('timed mechanisms freeze, endpoint dwell, displacement once, jump detachment and crush', () => {
  const g = fresh(89, 6.15);
  g.world.bridge = true;
  g.p.stand = 'ferry';
  const f = g.platforms[0];
  frames(g, 60);
  close(f.x, 87);
  const offset = g.p.x - f.x;
  frames(g, 180);
  close(g.p.x - f.x, offset, .001);
  g.step({ jumpPress: true });
  assert.equal(g.p.stand, null);
  assert.ok(g.p.vy < 13);
  const frozen = JSON.stringify([g.p, g.world, g.machines, g.platforms, g.bolts, g.time, g.elapsed]);
  g.pause();
  frames(g, 120);
  assert.equal(JSON.stringify([g.p, g.world, g.machines, g.platforms, g.bolts, g.time, g.elapsed]), frozen);
  g.resume();
  const h = fresh(152, 0);
  h.world.cells[1].socket = 'lower';
  h.p.stand = 'counterweight';
  h.platforms[1].phase = .085;
  h.solids.push({ x: 151, y: 1.54, w: 2, h: 1 });
  for (let i = 0; i < 40 && h.mode === 'play'; i++) h.movePlatforms(DT);
  assert.equal(h.mode, 'shutdown');
  assert.equal(h.recoveries, 1);
});
test('restoration clears phase and transient allocations across repeated recoveries and restarts', () => {
  const g = fresh();
  for (let i = 0; i < 35; i++) {
    g.world.bridge = true;
    frames(g, 8);
    g.recover();
    frames(g, 98);
    assert.equal(g.machines.length, 4);
    assert.equal(g.world.cells.length, 2);
    assert.equal(g.platforms.length, platforms.length);
    assert.ok(g.platforms.every((f) => f.phase === 0));
    assert.equal(g.waves.length + g.bolts.length + g.effects.length, 0);
    g.restart();
    assert.equal(g.recoveries, 0);
    assert.equal(g.result, null);
  }
});
test('cache capped at 100, full-energy collection, station commit and foundry latch retention', () => {
  const g = fresh(29.1, 2.05);
  g.p.energy = 92;
  g.interact();
  assert.equal(g.p.energy, 100);
  g.interact();
  assert.deepEqual(g.world.caches, ['w-cache']);
  at(g, 109.5, 6.15);
  g.interact();
  assert.equal(g.world.caches.length, 2);
  g.world.latch = true;
  g.world.cells[1].socket = 'lower';
  g.rebuildSolids();
  at(g, 149.3, 0);
  g.interact();
  assert.equal(g.power('lower'), false);
  assert.equal(g.power('latch'), true);
  assert.ok(!g.solids.some((s) => s.id === 'latch-gate'));
});
test('boarding requires all IDs, standing in the cabin and a single result', () => {
  const g = fresh(208, 8.25);
  g.interact();
  assert.equal(g.result, null);
  g.world.relays = ['A', 'B', 'C'];
  g.p.grounded = false;
  g.interact();
  assert.equal(g.result, null);
  g.p.grounded = true;
  g.p.x = 204.9;
  g.interact();
  assert.equal(g.result, null);
  g.p.x = 208;
  g.elapsed = 42;
  g.interact();
  const result = g.result;
  assert.equal(g.mode, 'liftSequence');
  frames(g, 610);
  assert.equal(g.mode, 'complete');
  close(g.elapsed, 42);
  assert.equal(g.result, result);
});
test('validated records, reload, full archives, fewest recovery tie breaker and storage failures', () => {
  const data = new Map(), store = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
  const r = new Records(store);
  const add = (time, recoveries, archives = 0) =>
    r.record({ time, recoveries, archives, relays: ['A', 'B', 'C'] });
  r.record({ time: 12, recoveries: 0, relays: ['A'] });
  assert.equal(data.size, 0);
  add(80, 2);
  add(90, 1, 3);
  add(70, 2, 3);
  add(85, 1);
  assert.equal(r.data.best, 70);
  assert.equal(r.data.full, 70);
  assert.deepEqual(r.data.fewest, { n: 1, time: 85 });
  assert.deepEqual(new Records(store).data, r.data);
  for (
    const bad of [
      'broken',
      '{"version":2,"best":3}',
      '{"version":1,"best":-7,"full":"2","fewest":{"n":-1,"time":5}}',
    ]
  ) {
    data.set('deepwake.records.v1', bad);
    assert.equal(new Records(store).data.best, null);
  }
  const denied = new Records({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  denied.record({ time: 40, recoveries: 1, archives: 1, relays: ['A', 'B', 'C'] });
  assert.equal(denied.data.best, 40);
});
for (const optional of [false, true]) {
  test('ordinary-input completion ' + (optional ? 'with all archives' : 'without discoveries'), () => {
    const g = fresh(),
      { result } = runRoute(g, {
        optional,
        step: (i) => {
          g.events.length = 0;
          g.step(i);
          assert.ok(!g.events.some((e) => e === 'shield' || e === 'hurt'), 'route required a hit');
        },
      });
    assert.equal(result.caches, optional ? 3 : 0);
    assert.equal(result.archives, optional ? 3 : 0);
    assert.equal(result.recoveries, 0);
    assert.equal(g.mode, 'complete');
    assert.deepEqual(result.relays, ['A', 'B', 'C']);
    assert.ok(g.world.latch && g.world.bridge && g.power('work') && g.power('east'));
  });
}

test('an obstructed shutter waits for the carried cell and closes after clearance', () => {
  const g = fresh(53.4);
  const door = 'work-shutter';
  g.world.cells[0].socket = 'work';
  g.rebuildSolids();
  g.world.cells[0].socket = null;
  g.p.carry = 'amber';
  g.rebuildSolids();
  assert.ok(!g.solids.some((s) => s.id === door));
  g.p.x = 52;
  g.step();
  assert.ok(g.solids.some((s) => s.id === door));
});

test('horizontal platform obstruction holds phase without starting crush recovery', () => {
  const g = fresh(89, 6.15);
  const f = g.platforms[0];
  f.phase = .085;
  g.p.stand = f.id;
  g.world.bridge = true;
  g.solids.push({ x: 89.38, y: 6.15, w: .25, h: 2 });
  for (let i = 0; i < 40; i++) g.movePlatforms(DT);
  assert.equal(g.mode, 'play');
  close(g.p.x, 89);
  close(f.phase, .085);
  close(g.p.crush, 0);
});
