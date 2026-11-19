import {
  archives,
  barriers,
  cells,
  machines,
  objectBy,
  objects,
  platforms,
  regionAt,
  signs,
  terrain,
  vents,
} from './level.js';

export const DT = 1 / 120, HALF = .375, HEIGHT = 1.5;
const EPS = .0001;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, d) => v < target ? Math.min(target, v + d) : Math.max(target, v - d);
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
const body = (p) => ({ x: p.x - HALF, y: p.y, w: HALF * 2, h: HEIGHT });
export const overlaps = (a, b) =>
  a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
const clone = (v) => JSON.parse(JSON.stringify(v));
const still = { left: false, right: false, jump: false };
function newPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    stand: null,
    wall: 0,
    coyote: .11,
    buffer: 0,
    steer: 0,
    dash: 0,
    dashDir: 1,
    dashCD: 0,
    airDash: true,
    pulse: 0,
    pulseCD: 0,
    energy: 100,
    regen: 0,
    integrity: 3,
    immune: 0,
    carry: null,
    action: '',
    actTime: 0,
    crush: 0,
    foot: 0,
  };
}
// Slab intersection gives both the pulse obstruction and the exact visible beam length.
export function rayHit(ax, ay, bx, by, r) {
  let low = 0, high = 1;
  for (
    const [origin, delta, min, max] of [[ax, bx - ax, r.x + EPS, r.x + r.w - EPS], [
      ay,
      by - ay,
      r.y + EPS,
      r.y + r.h - EPS,
    ]]
  ) {
    if (Math.abs(delta) < EPS) {
      if (origin < min || origin > max) return Infinity;
      continue;
    }
    let a = (min - origin) / delta, b = (max - origin) / delta;
    if (a > b) [a, b] = [b, a];
    low = Math.max(low, a);
    high = Math.min(high, b);
    if (low > high) return Infinity;
  }
  return low;
}
function newWorld() {
  return {
    relays: [],
    broken: [],
    archives: [],
    caches: [],
    disabled: [],
    bridge: false,
    latch: false,
    cells: clone(cells),
  };
}
const ids = ['A', 'B', 'C'];
export class Expedition {
  constructor() {
    this.restart();
    this.mode = 'title';
  }
  restart() {
    this.world = newWorld();
    this.elapsed = 0;
    this.recoveries = 0;
    this.result = null;
    this.mode = 'play';
    this.transition = 0;
    this.p = newPlayer(4, 0);
    this.message = null;
    this.fragment = null;
    this.events = [];
    this.serial = 0;
    this.resetActors();
    this.checkpoint = { id: 'start', x: 4, y: 0, world: clone(this.world) };
    this.commit('start', false);
    this.p.x = 4;
  }
  resetActors() {
    this.time = 0;
    this.effects = [];
    this.bolts = [];
    this.waves = [];
    this.revealed = {};
    this.gates = {};
    this.platforms = platforms.map((a) => ({ ...a, phase: 0 }));
    this.machines = machines.map((v) => ({
      ...v,
      homeY: v.y,
      dir: 1,
      state: this.world.disabled.includes(v.id)
        ? 'disabled'
        : v.type === 'sentinel'
        ? 'closed'
        : v.type === 'skitter'
        ? 'dormant'
        : 'patrol',
      timer: .3,
      age: 0,
      aimX: -1,
      aimY: 0,
      beam: 8,
    }));
    this.rebuildSolids();
  }
  power(id) {
    return this.world.relays.includes(id) || this.world[id] === true ||
      this.world.cells.some((c) => c.socket === id);
  }
  barrierOpen(b) {
    if (b.type === 'seam') return this.world.broken.includes(b.id);
    const on = this.power(b.requires) || (b.requires === 'work' && this.power('A')) ||
      (b.requires === 'east' && this.power('C'));
    if (
      !on && this.gates[b.id] &&
      overlaps({ ...body(this.p), x: this.p.x - (this.p.carry ? .9 : .4), w: this.p.carry ? 1.8 : .8 }, b)
    ) {
      this.shutterWaiting = true;
      return true;
    }
    this.gates[b.id] = on;
    return on;
  }
  rebuildSolids() {
    this.shutterWaiting = false;
    this.solids = [...terrain, ...barriers.filter((b) => !this.barrierOpen(b)), ...this.platforms];
  }
  emit(name) {
    this.events.push(name);
    if (this.events.length > 64) this.events.shift();
  }
  cue(text, t = 2.8) {
    this.message = { text, t };
  }
  fx(type, x, y, t = .35, dir = 1) {
    this.effects.push({ type, x, y, t, max: t, dir });
    if (this.effects.length > 40) this.effects.shift();
  }
  action(name, t) {
    this.p.action = name;
    this.p.actTime = t;
  }
  change(mode, t = 0) {
    this.mode = mode;
    this.transition = t;
    this.serial++;
  }
  pause() {
    if (['play', 'relayActivation', 'liftSequence', 'shutdown', 'reboot'].includes(this.mode)) {
      this.beforePause = this.mode;
      this.change('paused', this.transition);
    }
  }
  resume() {
    if (this.mode === 'paused') this.change(this.beforePause || 'play', this.transition);
  }
  commit(id, relocate) {
    const s = objectBy(id);
    this.p.energy = 100;
    this.p.integrity = 3;
    this.checkpoint = { id, x: id === 'start' ? 4 : s.x, y: s.y, world: clone(this.world) };
    if (relocate) {
      this.p = newPlayer(s.x, s.y);
      this.p.immune = .8;
    }
  }
  recover(cause = 'retry') {
    if (this.mode !== 'play') return;
    this.change('shutdown', cause === 'retry' ? .15 : .54);
    this.p.vx = 0;
    this.p.dash = 0;
    this.recoveries++;
    this.emit('shutdown');
  }
  restore() {
    this.world = clone(this.checkpoint.world);
    this.p = newPlayer(this.checkpoint.x, this.checkpoint.y);
    this.p.immune = 1;
    this.message = null;
    this.fragment = null;
    this.resetActors();
    this.change('reboot', .65);
    this.emit('reboot');
  }
  damage(from) {
    const p = this.p;
    if (this.mode !== 'play' || p.immune > 0) return;
    if (p.energy >= 50) {
      p.energy -= 50;
      p.regen = 1.5;
      p.immune = .8;
      this.emit('shield');
      this.fx('shield', p.x, p.y + .75, .36);
    } else {
      p.integrity--;
      p.immune = 1.2;
      this.emit('hurt');
      this.fx('hurt', p.x, p.y + .8);
    }
    p.dash = 0;
    p.vx = p.x >= from ? 4 : -4;
    p.vy = 4;
    p.steer = .14;
    p.grounded = false;
    this.action('hurt', .3);
    if (p.integrity <= 0) this.recover('integrity');
  }
  reach(ax, ay, bx, by, crystal = false) {
    return !this.solids.some((b) => (!crystal || b.type !== 'seam') && rayHit(ax, ay, bx, by, b) < 1);
  }
  ventState(v) {
    const t = (this.time + v.offset) % 4.5;
    return t < 2.5 ? 'dormant' : t < 3.35 ? 'warning' : 'active';
  }
  target() {
    const p = this.p, w = this.world;
    const nearest = (list) =>
      list.filter((o) => near(p, o, 1.4)).sort((a, b) =>
        Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y)
      )[0];
    if (p.carry) {
      const socket = nearest(
        objects.filter((o) => o.kind === 'socket' && o.cell === p.carry && !this.power(o.id)),
      );
      return socket
        ? { action: 'insert', o: socket, label: 'Insert cell' }
        : { action: 'drop', label: 'Place cell' };
    }
    const cell = nearest(w.cells.filter((c) => !c.socket));
    if (cell) return { action: 'pick', o: cell, label: 'Lift power cell' };
    const socket = nearest(
      objects.filter((o) => o.kind === 'socket' && w.cells.some((c) => c.socket === o.id)),
    );
    if (socket) return { action: 'remove', o: socket, label: 'Remove cell' };
    const o = nearest(
      objects.filter((o) =>
        o.kind === 'switch' && !this.power(o.id) || o.kind === 'archive' && !w.archives.includes(o.id) ||
        o.kind === 'cache' && !w.caches.includes(o.id) || o.kind === 'station' || o.kind === 'liftConsole'
      ),
    );
    if (!o) return null;
    return {
      action: o.kind,
      o,
      label: {
        switch: o.id === 'bridge' ? 'Power crossing' : 'Latch upper route',
        archive: 'Read memory archive',
        cache: 'Salvage cache',
        station: 'Commit checkpoint',
        liftConsole: 'Activate lift',
      }[o.kind],
    };
  }
  interact() {
    const t = this.target();
    if (!t) return;
    const { action: a, o } = t, p = this.p, w = this.world;
    if (a === 'pick' || a === 'remove') {
      const c = a === 'pick' ? o : w.cells.find((c) => c.socket === o.id);
      p.carry = c.id;
      c.socket = null;
      this.emit('cell');
      this.action('lift', .3);
      this.cue('Cell carried · E to place or insert');
    }
    if (a === 'insert') {
      const c = w.cells.find((c) => c.id === p.carry);
      Object.assign(c, { socket: o.id, x: o.x, y: o.y });
      p.carry = null;
      this.emit('socket');
      this.action('socket', .4);
      this.cue(o.id === 'lower' ? 'Counterweight powered' : 'Circuit powered · pulse the exposed relay');
    }
    if (a === 'drop') {
      const x = p.x + p.facing * .98,
        base = this.solids.filter((b) =>
          !platforms.some((f) =>
            b.id === f.id
          ) && b.x <= x - .24 && b.x + b.w >= x + .24 && b.y + b.h <= p.y + .2 && b.y + b.h >= p.y - 1.8
        ).sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
      if (!base) {
        this.cue('Find solid ground for the cell');
        return;
      }
      const y = base.y + base.h, r = { x: x - .3, y, w: .6, h: .75 };
      if (
        this.solids.some((b) => overlaps(r, b)) || vents.some((v) => overlaps(r, v)) || barriers.some((b) =>
          overlaps(r, b)
        ) || objects.some((o) => o.kind === 'socket' && near({ x, y }, o, .7))
      ) {
        this.cue('Cell placement obstructed');
        return;
      }
      Object.assign(w.cells.find((c) => c.id === p.carry), { x, y, socket: null });
      p.carry = null;
      this.emit('cell');
    }
    if (a === 'switch') {
      if (o.id === 'latch' && !this.power('lower')) {
        this.cue('Supply the lower lift socket first');
        return;
      }
      w[o.id] = true;
      this.emit('switch');
      this.cue(
        o.id === 'bridge' ? 'Reservoir crossing powered' : 'Upper route latched · transfer the cell east',
      );
    }
    if (a === 'archive') {
      w.archives.push(o.id);
      this.fragment = archives.find((f) => f.id === o.id);
      this.emit('archive');
      this.change('archive');
    }
    if (a === 'cache') {
      w.caches.push(o.id);
      const gain = Math.min(25, 100 - p.energy);
      p.energy += gain;
      this.cue('Cache salvaged · +' + Math.round(gain) + ' resonance');
      this.emit('cache');
    }
    if (a === 'station') {
      this.commit(o.id, false);
      this.cue('Checkpoint saved · integrity restored');
      this.emit('reboot');
    }
    if (a === 'liftConsole') {
      if (ids.every((id) => this.power(id)) && p.grounded && p.x >= 206.6 && p.x <= 209.4 && !this.result) {
        this.result = {
          time: this.elapsed,
          recoveries: this.recoveries,
          archives: w.archives.length,
          caches: w.caches.length,
          machines: w.disabled.length,
          relays: [...w.relays],
        };
        this.change('liftSequence', 5);
        this.emit('lift');
      } else this.cue('Board the lift with all three relays online');
    }
    this.rebuildSolids();
  }
  dismiss() {
    if (this.mode === 'archive') {
      this.fragment = null;
      this.change('play');
    }
  }
  hint() {
    const t = this.target();
    if (t) return { key: 'E', text: t.label };
    const relay = objects.find((o) => o.kind === 'relay' && !this.power(o.id) && near(this.p, o, 4.9));
    if (relay) return { key: 'Q', text: 'Pulse Relay ' + relay.id };
    const s = signs.find((o) => near(this.p, o, 3.5));
    return s || null;
  }
  relay(id) {
    const supply = { A: 'work', B: 'bridge', C: 'east' }[id];
    if (!this.power(supply) || id === 'C' && !this.power('latch')) {
      this.cue('Relay offline · connect its power supply');
      return;
    }
    if (this.power(id)) return;
    this.world.relays.push(id);
    this.commit('save' + id, false);
    this.action('relay', 1.15);
    this.rebuildSolids();
    this.change('relayActivation', 1.2);
    this.emit('relay');
    this.cue('Relay ' + id + ' online · checkpoint saved', 3.5);
  }
  pulse() {
    const p = this.p;
    if (p.carry || p.pulseCD > 0) return;
    if (p.energy < 35) {
      this.emit('empty');
      this.cue('Insufficient resonance', 1.1);
      this.fx('empty', p.x, p.y, .35);
      return;
    }
    p.energy -= 35;
    p.regen = 1.5;
    p.pulseCD = .7;
    p.pulse = .35;
    this.waves.push({ x: p.x, y: p.y + .85, r: 0, hits: new Set() });
    this.emit('pulse');
  }
  disable(m) {
    if (m.state === 'disabled') return;
    m.state = 'disabled';
    this.world.disabled.push(m.id);
    this.fx('sparks', m.x, m.y + .5);
    this.emit('disable');
  }
  updateWaves(dt) {
    for (const w of this.waves) {
      w.r = Math.min(6, w.r + 6 * dt / .35);
      const hit = (id, x, y) => {
        if (w.hits.has(id) || Math.hypot(x - w.x, y - w.y) > w.r || !this.reach(w.x, w.y, x, y, true)) {
          return false;
        }
        w.hits.add(id);
        return true;
      };
      for (const o of objects) {
        if (
          !['relay', 'archive', 'socket', 'switch'].includes(o.kind) || !hit(o.kind + o.id, o.x, o.y + .65)
        ) continue;
        this.revealed[o.kind + o.id] = 5;
        if (o.kind === 'relay') this.relay(o.id);
      }
      for (const b of barriers) {
        if (b.type === 'seam' && hit(b.id, b.x + b.w / 2, b.y + .9)) this.revealed[b.id] = 5;
      }
      for (const m of this.machines) {
        if (m.state === 'disabled' || !hit(m.id, m.x, m.y + .45)) continue;
        if (m.type === 'sentinel') {
          if (m.state === 'venting') this.disable(m);
          else {
            this.emit('deflect');
            this.fx('deflect', m.x, m.y + .6);
            this.cue('Armor closed · pulse the open core');
          }
        } else {
          m.state = 'stunned';
          m.timer = m.type === 'skitter' ? 2 : 2.5;
          this.emit('stun');
        }
      }
    }
    this.waves = this.waves.filter((w) => w.r < 6);
  }
  movePlatforms(dt) {
    const p = this.p;
    for (const f of this.platforms) {
      const orig = platforms.find((o) => o.id === f.id), oldX = f.x, oldY = f.y, oldPhase = f.phase;
      if (this.power(f.requires)) f.phase = (f.phase + dt / f.period) % 1;
      else if (f.id === 'counterweight') f.phase = approach(f.phase, f.phase > .5 ? 1 : 0, dt / f.period);
      const u = f.phase < .5 ? f.phase : 1 - f.phase;
      const pos = clamp((u - .085) / .33, 0, 1);
      f.x = orig.x + pos * f.dx;
      f.y = orig.y + pos * f.dy;
      const dx = f.x - oldX, dy = f.y - oldY;
      if (!dx && !dy) continue;
      const riding = p.stand === f.id && p.grounded;
      const riderBounds = body(p);
      if (riding) {
        riderBounds.x += dx;
        riderBounds.y += dy;
      }
      const obstruction = riding
        ? this.solids.find((s) => s !== f && overlaps(riderBounds, s))
        : overlaps(riderBounds, f);
      if (obstruction) {
        // Stop before overlap. A rising deck held against an overhead surface
        // must stay blocked for a full tenth of a second to confirm a crush.
        f.x = oldX;
        f.y = oldY;
        f.phase = oldPhase;
        if (riding && dy > 0 && obstruction.y >= p.y + HEIGHT - EPS) {
          p.crush += dt;
          if (p.crush >= .1) this.recover('crush');
        } else if (riding) p.crush = 0;
      } else if (riding) {
        p.x += dx;
        p.y += dy;
        p.crush = 0;
      }
    }
  }
  move(dt, input) {
    const p = this.p, dir = Number(!!input.right) - Number(!!input.left);
    for (const k of ['dashCD', 'pulseCD', 'pulse', 'immune', 'steer', 'buffer', 'actTime']) {
      p[k] = Math.max(0, p[k] - dt);
    }
    if (!p.actTime) p.action = '';
    if (p.regen > 0) p.regen = Math.max(0, p.regen - dt);
    else p.energy = Math.min(100, p.energy + 20 * dt);
    if (p.grounded) p.coyote = .11;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (input.jumpPress) p.buffer = .14;
    if (input.dashPress && !p.carry && p.dashCD <= 0 && p.airDash) {
      p.dash = .16;
      p.dashCD = .45;
      p.airDash = false;
      p.dashDir = p.facing;
      p.vy = 0;
      this.emit('dash');
      this.fx('dash', p.x, p.y + .6, .2, p.facing);
    }
    if (p.buffer > 0 && p.dash <= 0) {
      if (p.grounded || p.coyote > 0) {
        p.vy = 13;
        p.grounded = false;
        p.stand = null;
        p.coyote = 0;
        p.buffer = 0;
        this.emit('jump');
        this.action('takeoff', .1);
      } else if (p.wall && !p.carry) {
        p.vx = -7 * p.wall;
        p.facing = -p.wall;
        p.vy = 12.5;
        p.steer = .11;
        p.wall = 0;
        p.airDash = true;
        p.buffer = 0;
        this.emit('jump');
        this.action('wallJump', .22);
      }
    }
    if (input.jumpRelease && p.vy > 0) p.vy = Math.min(p.vy, 8.95);
    if (p.dash > 0) {
      p.vx = 15 * p.dashDir;
      p.vy = 0;
    } else {
      if (p.steer <= 0) {
        p.vx = approach(
          p.vx,
          dir * (p.carry ? 4.5 : 6.5),
          dt * (dir ? (p.grounded ? 42 : 28) : (p.grounded ? 38 : 8)),
        );
        if (dir) p.facing = dir;
      }
      p.vy = Math.max(-24, p.vy - 32 * dt);
    }
    const oldGround = p.grounded, wallBefore = p.wall;
    p.wall = 0;
    const dx = p.vx * dt;
    p.x += dx;
    for (const b of this.solids) {
      if (!overlaps(body(p), b)) continue;
      if (b.type === 'seam' && p.dash > 0) {
        this.world.broken.push(b.id);
        this.fx('seam', b.x + b.w / 2, b.y + 1, .5);
        this.emit('seam');
        this.rebuildSolids();
        continue;
      }
      if (dx > 0) p.x = b.x - HALF;
      else if (dx < 0) p.x = b.x + b.w + HALF;
      if (dx) {
        p.wall = Math.sign(dx);
        p.vx = 0;
        p.dash = 0;
        if (p.grounded) p.airDash = true;
      }
    }
    if (!p.grounded && !p.carry && dir === p.wall && p.wall && p.vy < 0) {
      p.vy = Math.max(p.vy, -3);
      if (!wallBefore) this.emit('wall');
    }
    const dy = p.vy * dt;
    p.y += dy;
    p.grounded = false;
    p.stand = null;
    for (const b of this.solids) {
      const horizontal = p.x + HALF > b.x + EPS && p.x - HALF < b.x + b.w - EPS;
      if (!horizontal) continue;
      if (dy <= 0 && p.y <= b.y + b.h + EPS && p.y - dy >= b.y + b.h - EPS) {
        p.y = b.y + b.h;
        p.vy = 0;
        p.grounded = true;
        p.stand = b.id;
      } else if (dy > 0 && p.y + HEIGHT >= b.y - EPS && p.y - dy + HEIGHT <= b.y + EPS) {
        p.y = b.y - HEIGHT;
        p.vy = 0;
      }
    }
    if (p.grounded) {
      p.wall = 0;
      if (!oldGround) {
        p.airDash = true;
        this.emit('land');
        this.action('land', .12);
      }
      if (Math.abs(p.vx) > 1) {
        p.foot += dt * Math.abs(p.vx);
        if (p.foot > .95) {
          this.emit(
            this.solids.find((b) => b.id === p.stand)?.material === 'metal' ? 'stepMetal' : 'stepStone',
          );
          p.foot = 0;
        }
      }
    } else if (p.wall && (!dir || dir !== p.wall || p.carry)) p.wall = 0;
    if (p.dash > 0) {
      p.dash = Math.max(0, p.dash - dt);
      if (!p.dash) {
        p.vx = p.dashDir * 6.5;
        if (p.grounded) p.airDash = true;
      }
    }
    if (p.y < -3.5 || (p.x > 83.9 && p.x < 104 && p.y < .1)) this.recover('fall');
  }
  updateMachines(dt) {
    const p = this.p;
    for (const m of this.machines) {
      if (m.state === 'disabled' || Math.abs(m.x - p.x) > 13) continue;
      m.age += dt;
      m.timer -= dt;
      const visible = Math.abs(p.x - m.x) < (m.type === 'skitter' ? 5 : 9) &&
        this.reach(m.x, m.y + .65, p.x, p.y + .7);
      if (m.state === 'stunned') {
        if (m.timer <= 0) {
          m.state = 'cooldown';
          m.timer = .8;
        }
      } else if (m.type === 'skitter') {
        if (m.state === 'dormant' && Math.abs(m.x - p.x) < 10) m.state = 'patrol';
        if (m.state === 'patrol' || m.state === 'lunge') {
          const ahead = m.x + m.dir * .7;
          if (
            ahead < m.min || ahead > m.max ||
            !this.solids.some((b) => b.x < ahead && b.x + b.w > ahead && Math.abs(b.y + b.h - m.y) < .1)
          ) {
            if (m.state === 'lunge') {
              m.state = 'cooldown';
              m.timer = .75;
            } else m.dir *= -1;
          }
          m.x = clamp(m.x + m.dir * (m.state === 'lunge' ? 7 : 1.4) * dt, m.min, m.max);
          if (m.state === 'patrol' && visible) {
            m.dir = Math.sign(p.x - m.x) || 1;
            m.state = 'alert';
            m.timer = .52;
            this.emit('alert');
          }
          if (m.state === 'lunge' && m.timer <= 0) {
            m.state = 'cooldown';
            m.timer = .85;
          }
        } else if (m.state === 'alert' && m.timer <= 0) {
          m.state = 'lunge';
          m.timer = .32;
        } else if (m.state === 'cooldown' && m.timer <= 0) m.state = 'patrol';
      } else if (m.type === 'drone') {
        if (m.state === 'patrol') {
          m.x += m.dir * dt;
          if (m.x >= m.max || m.x <= m.min) m.dir *= -1;
          m.y = m.homeY + .28 * Math.sin(m.age * 1.5);
          if (visible) {
            m.state = 'aim';
            m.timer = .82;
            const d = Math.hypot(p.x - m.x, p.y + .7 - m.y - .6) || 1;
            m.aimX = (p.x - m.x) / d;
            m.aimY = (p.y + .7 - m.y - .6) / d;
            this.emit('alert');
          }
        } else if (m.state === 'aim' && m.timer <= 0) {
          m.state = 'fire';
          m.timer = .1;
          this.bolts.push({ x: m.x, y: m.y + .6, vx: m.aimX * 5, vy: m.aimY * 5, t: 2.7 });
        } else if (m.state === 'fire' && m.timer <= 0) {
          m.state = 'cooldown';
          m.timer = 2.1;
        } else if (m.state === 'cooldown' && m.timer <= 0) m.state = 'patrol';
      } else {
        const laneY = m.y + .63;
        m.beam = 10 * Math.min(1, ...this.solids.map((b) => rayHit(m.x, laneY, m.x - 10, laneY, b)));
        if (m.state === 'closed' && visible && m.timer <= 0) {
          m.state = 'warning';
          m.timer = 1;
          this.emit('alert');
        } else if (m.timer <= 0 && m.state !== 'closed') {
          const next = { warning: ['firing', .9], firing: ['venting', 2], venting: ['closed', 1.2] }[m.state];
          [m.state, m.timer] = next;
        }
        if (m.state === 'firing' && overlaps(body(p), { x: m.x - m.beam, y: laneY - .1, w: m.beam, h: .2 })) {
          this.damage(m.x);
        }
      }
      if (overlaps(body(p), { x: m.x - .48, y: m.y, w: .96, h: m.type === 'skitter' ? .55 : 1 })) {
        if (m.state === 'stunned') { if (p.dash > 0) this.disable(m); }
        else if (m.state !== 'disabled') this.damage(m.x);
      }
    }
    this.bolts = this.bolts.filter((b) => {
      const x = b.x, y = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.t -= dt;
      if (b.t <= 0 || !this.reach(x, y, b.x, b.y)) return false;
      if (overlaps(body(p), { x: b.x - .09, y: b.y - .09, w: .18, h: .18 })) {
        this.damage(b.x);
        return false;
      }
      return true;
    });
  }
  step(input = still, dt = DT) {
    if (['title', 'paused', 'complete', 'archive'].includes(this.mode)) return;
    if (this.mode !== 'play') {
      this.transition -= dt;
      if (this.transition <= 0) {
        if (this.mode === 'shutdown') this.restore();
        else if (this.mode === 'liftSequence') {
          this.change('complete');
          this.emit('finish');
        } else this.change('play');
      }
      return;
    }
    this.elapsed += dt;
    this.time += dt;
    if (this.shutterWaiting) this.rebuildSolids();
    if (input.interact) this.interact();
    if (this.mode !== 'play') return;
    if (input.pulsePress) this.pulse();
    this.movePlatforms(dt);
    if (this.mode !== 'play') return;
    this.move(dt, input);
    if (this.mode !== 'play') return;
    this.updateWaves(dt);
    if (this.mode !== 'play') return;
    this.updateMachines(dt);
    for (const v of vents) if (this.ventState(v) === 'active' && overlaps(body(this.p), v)) this.damage(v.x);
    if (this.mode !== 'play') return;
    if (this.p.x >= 182 && this.checkpoint.id === 'saveC' && this.p.grounded) {
      this.commit('ascent', false);
      this.cue('Ascent station linked');
    }
    this.effects = this.effects.filter((e) => (e.t -= dt) > 0);
    for (const key in this.revealed) if ((this.revealed[key] -= dt) <= 0) delete this.revealed[key];
    if (this.message && (this.message.t -= dt) <= 0) this.message = null;
  }
  get region() {
    return regionAt(this.p.x);
  }
}
