import * as T from '../vendor/three-0.160.1.module.min.js';
import { barriers, cells, machines, objects, platforms, terrain, vents } from './level.js';
import { makeProp, makeRobot, updateProp } from './models.js';
import { buildScenery } from './scenery.js';
import { clamp, rayHit } from './simulation.js';

const cube = new T.BoxGeometry(1, 1, 1);
const materials = new Map();
function mat(color, lit = false) {
  const key = color + ':' + lit;
  if (!materials.has(key)) {
    materials.set(key, lit ? new T.MeshBasicMaterial({ color }) : new T.MeshLambertMaterial({ color }));
  }
  return materials.get(key);
}
function box(parent, x, y, z, w, h, d, color, lit = false) {
  const m = new T.Mesh(cube, mat(color, lit));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const mix = (a, b, t) => a + (b - a) * t;
export class View {
  constructor(canvas) {
    this.gl = new T.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#172e3a');
    this.camera = new T.OrthographicCamera(-12, 12, 5, -5, .1, 120);
    this.canvas = canvas;
    const hemi = new T.HemisphereLight(0xd9f9ff, 0x56697c, 1.12);
    this.scene.add(hemi);
    const sun = new T.DirectionalLight(0xffe4bb, 1.8);
    sun.position.set(-4, 9, 5);
    this.scene.add(sun);
    const rim = new T.DirectionalLight(0x8bffff, .82);
    rim.position.set(8, 4, -3);
    this.scene.add(rim);
    const lamp = new T.PointLight(0xffb267, 5.5, 9);
    lamp.position.set(3.6, 3.1, 1.3);
    this.scene.add(lamp);
    this.scenery = buildScenery(T, this.scene);
    this.chunkGroups = [];
    this.makeTerrain();
    this.robot = makeRobot(T);
    this.scene.add(this.robot.group);
    this.props = new Map();
    for (
      const o of [
        ...objects,
        ...cells.map((c) => ({ ...c, kind: 'cell' })),
        ...machines.map((m) => ({ ...m, kind: m.type })),
      ]
    ) {
      const g = makeProp(T, o.kind);
      g.position.set(o.x, o.y, o.kind === 'relay' ? -.12 : 0);
      this.scene.add(g);
      this.props.set(o.kind + o.id, g);
    }
    this.shutters = barriers.map((b) => {
      const g = new T.Group();
      g.position.set(b.x, b.y, 0);
      this.scene.add(g);
      const amber = b.type === 'seam';
      box(g, b.w / 2, b.h / 2, 0, b.w, b.h, 1.35, amber ? '#ae652e' : '#3d5057');
      for (let i = 0; i < b.h; i += .44) {
        if (amber) {
          const dx = .15 + .48 * (.5 + .5 * Math.sin(i * 5));
          const m = box(g, b.w * dx, i + .16, .69, .055, .36, .015, '#ffcb76', true);
          m.rotation.z = Math.sin(i * 6) * .55;
        } else {
          box(g, b.w / 2, i + .06, .695, b.w * .96, .085, .04, '#18292f');
          box(g, b.w * .75, i + .18, .707, .06, .11, .02, '#bd966d');
        }
      }
      return g;
    });
    this.platformMeshes = platforms.map((f) => {
      const g = new T.Group();
      this.scene.add(g);
      box(g, f.w / 2, f.h / 2, 0, f.w, f.h, 1.8, '#35484e');
      box(g, f.w / 2, f.h - .045, 0, f.w, .09, 1.9, '#9cabb1');
      for (let i = .3; i < f.w; i += .53) box(g, i, .18, .91, .24, .08, .03, '#e7b765', true);
      return g;
    });
    this.ventMeshes = vents.map((v) => {
      const g = new T.Group();
      this.scene.add(g);
      g.position.set(v.x, v.y, 0);
      box(g, v.w / 2, .03, 0, v.w, .06, 1.6, '#674e40');
      for (let x = .05; x < v.w; x += .19) box(g, x, .075, 0, .09, .04, 1.3, '#19262e');
      const jet = new T.Group();
      g.add(jet);
      for (let i = 0; i < 7; i++) {
        box(
          jet,
          v.w * (i + .5) / 7,
          .5,
          .1 * Math.sin(i),
          v.w / 7,
          1,
          .25,
          i % 2 ? '#ef9748' : '#ffcb7f',
          true,
        );
      }
      return { g, jet };
    });
    box(this.scene, 94, -.18, 0, 20.25, .45, 3.1, '#327782');
    for (let i = 0; i < 32; i++) {
      box(this.scene, 84 + i * .62, .06, Math.sin(i) * .7, .3 + (i % 3) * .06, .012, .035, '#79c6c3', true);
    }
    this.conduits = ['A', 'B', 'C'].map((id, i) => {
      const x = [58, 118, 174][i], end = [83, 147, 206][i];
      return box(this.scene, (x + end) / 2, -.22, 1.06, end - x, .055, .04, '#495455', true);
    });
    this.wires = [
      ['work', 51.8, 53.95, .1],
      ['bridge', 80, 86.95, 6.24],
      ['lower', 149.3, 151.8, .11],
      ['latch', 156.6, 162.8, 5.11],
      ['latch', 162.75, 165.4, 6.55],
      ['east', 167.8, 170, .11],
    ].map(([id, a, b, y]) => ({
      id,
      mesh: box(this.scene, (a + b) / 2, y, -.61, b - a, .05, .1, '#6c6454'),
    }));
    this.falls = [92.6, 94.1, 96.5].map((x, i) =>
      box(this.scene, x, 2.8, -4.3, .09, 8, .07, '#6ba8b3', true)
    );
    this.eye = new T.Vector3();
    this.clock = 0;
    this.prevMode = '';
    this.anchorX = 3;
    this.anchorY = 1;
    this.shadow = new T.Mesh(
      new T.CircleGeometry(.53, 16),
      new T.MeshBasicMaterial({ color: 0x0b1820, transparent: true, opacity: .55, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.focus = new T.Group();
    this.scene.add(this.focus);
    for (const x of [-1, 1]) {
      box(this.focus, x * .11, .08, .48, .18, .04, .035, '#ffe1a4', true).rotation.z = x * .65;
    }
    this.beams = machines.map(() => box(this.scene, 0, 0, 0, 1, 1, 1, '#ffa15a', true));
    this.sparks = Array.from({ length: 100 }, () => box(this.scene, 0, 0, 0, 1, 1, 1, '#8af6dc', true));
    const points = new Float32Array(129 * 3);
    this.ringGeo = new T.BufferGeometry();
    this.ringGeo.setAttribute('position', new T.BufferAttribute(points, 3));
    this.ring = new T.Line(
      this.ringGeo,
      new T.LineBasicMaterial({ color: 0x83ffe1, transparent: true, opacity: .85 }),
    );
    this.ring.frustumCulled = false;
    this.scene.add(this.ring);
    this.buildLift();
  }
  makeTerrain() {
    let seed = 763;
    const rand = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
    const palette = ['#33434f', '#3d4c56', '#384751', '#46515a', '#2e404b', '#414d55', '#35464e'];
    for (const r of terrain) {
      const g = new T.Group();
      this.scene.add(g);
      this.chunkGroups.push({ x: r.x, w: r.w, g });
      const lumps = [];
      function add(x, y, z, w, h, d, c) {
        lumps.push([x, y, z, w, h, d, c]);
      }
      const metal = r.material === 'metal', top = r.y + r.h, depth = r.id === 'work-1' ? 3.2 : 2;
      add(r.x + r.w / 2, r.y + (r.h - .11) / 2, -.3, r.w, r.h - .11, depth, metal ? '#35464e' : '#293842');
      // Mismatched masonry courses with stratified lit tops and chipped front corners.
      for (let row = 0; row < Math.min(15, Math.ceil(r.h / .48)); row++) {
        const height = Math.min(.46, r.h - row * .48), yy = top - row * .48 - height / 2;
        for (let at = r.x; at < r.x + r.w - .015;) {
          const w = Math.min(.47 + rand() * 1.46, r.x + r.w - at),
            x = at + w / 2,
            z = depth / 2 - .29 + rand() * .12;
          add(x, yy, z, w - .012, height, .12 + rand() * .16, palette[Math.floor(rand() * palette.length)]);
          if (rand() < .43) add(x - w * .13, yy + height * .23, z + .156, w * .45, .025, .012, '#53626a');
          if (metal && row % 2 === 0) add(at + .09, yy, z + .16, .047, .047, .035, '#93a4a5');
          at += w;
        }
      }
      for (let at = r.x; at < r.x + r.w - .005;) {
        const w = Math.min(.46 + rand() * .72, r.x + r.w - at), x = at + w / 2;
        const edge = ['#73858a', '#899698', '#627b82', '#788b8c'][Math.floor(rand() * 4)];
        add(x, top - .065, .02, w - .013, .13, depth + .15, edge);
        add(x, top - .12, depth / 2 + .095, w * .89, .035, .03, '#4c6269');
        // Broken slate, oxidized inset plates, and tiny surface mineral flecks.
        for (let n = 0; n < 4; n++) {
          add(
            x + (rand() - .5) * w,
            top + .004,
            (rand() - .5) * depth,
            .035 + rand() * .15,
            .009,
            .035 + rand() * .07,
            rand() < .5 ? '#a1a9a2' : '#506971',
          );
        }
        at += w;
      }
      if (r.id === 'work-1') {
        // Mineral bands and the old power cable run along the exposed rock face.
        const front = depth * .5 + .33;
        add(r.x + r.w * .5, top - .31, front, r.w, .075, .07, '#25383c');
        add(r.x + r.w * .5, top - .38, front + .012, r.w, .045, .078, '#936d4c');
        for (let x = r.x + .3; x < r.x + r.w - .2; x += 1.52) {
          add(x, top - .34, front + .042, .095, .18, .086, '#455356');
          add(x + .011, top - .27, front + .084, .048, .042, .038, '#a69678');
        }
        for (let n = 0; n < 48; n++) {
          const x = r.x + rand() * r.w, z = -.6 - rand() * .65;
          const d = .07 + rand() * .18;
          add(x, top + d * .23, z, d * 1.43, d * .46, d, palette[n % 7]);
        }
        for (const x of [1.4, 6.5, 10.6]) {
          add(x, top + .016, .73, .86, .04, .43, '#3f5156');
          for (let i = 0; i < 8; i++) add(x - .35 + i * .1, top + .039, .73, .041, .014, .32, '#24383e');
          add(x - .36, top + .044, .925, .12, .012, .035, '#b8915e');
        }
        for (let n = 0; n < 140; n++) {
          const x = r.x + rand() * r.w, y = top - .6 - rand() * 4, s = .14 + rand() * .44;
          add(x, y, depth / 2 + .12, s, s * .5 + rand() * .2, .18 + rand() * .25, palette[n % 7]);
        }
      }
      const im = new T.InstancedMesh(cube, mat('#ffffff'), lumps.length), o = new T.Object3D();
      lumps.forEach(([x, y, z, w, h, d, c], i) => {
        o.position.set(x, y, z);
        o.scale.set(w, h, d);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, new T.Color(c));
      });
      im.computeBoundingSphere();
      g.add(im);
    }
  }
  buildLift() {
    this.lift = new T.Group();
    this.scene.add(this.lift);
    this.lift.position.set(207.8, 8.25, -.08);
    box(this.lift, 0, -.08, 0, 3.65, .18, 2.1, '#697d7c');
    for (const x of [-1.65, 1.65]) {
      box(this.lift, x, 1.4, -.74, .15, 2.8, .21, '#6a7778');
      box(this.lift, x, 2.82, 0, .15, .18, 1.7, '#aab1a5');
    }
    box(this.lift, 0, 2.82, -.7, 3.6, .2, .21, '#798a8b');
    this.guard = box(this.lift, 0, .72, .85, 3.45, .13, .12, '#ce975c');
    this.dawn = new T.Group();
    this.scene.add(this.dawn);
    this.dawn.visible = false;
    box(this.dawn, 208, 21, -9, 25, 15, .5, '#e9c6a0', true);
    box(this.dawn, 214.6, 14.77, 0, 10, .66, 3.25, '#9e9582');
    for (let i = 0; i < 14; i++) {
      box(this.dawn, 210 + i * .66, 15.11, .02, .65, .08, 3.27, i % 3 ? '#c3b393' : '#b8aa90');
    }
    for (const x of [210.2, 211.8, 213.4, 215]) box(this.dawn, x, 15.67, -1.15, .12, 1.05, .16, '#707574');
    box(this.dawn, 212.6, 16.18, -1.15, 5, .09, .17, '#948c78');
    for (let i = 0; i < 5; i++) {
      box(this.dawn, 211.65, 18.6 + i * .234, -8.3, 1.4 - Math.abs(2 - i) * .23, .24, .12, '#fff0c8', true);
    }
    for (let i = 0; i < 7; i++) {
      box(
        this.dawn,
        201.8 + i * 2.8,
        18.4 + Math.sin(i) * 1.1,
        -7.7,
        1.45 + i % 3 * .54,
        .08,
        .1,
        '#f8ddba',
        true,
      );
    }
    for (let i = 0; i < 15; i++) {
      box(
        this.dawn,
        213.6 + Math.sin(i * 2.2),
        15.17 + (i % 3) * .04,
        -.94 + Math.sin(i) * .24,
        .055,
        .12 + i % 4 * .025,
        .05,
        '#849375',
      );
    }
    for (let i = 0; i < 20; i++) {
      box(
        this.dawn,
        196 + i * 1.4,
        12.2 + Math.sin(i * .7),
        -5,
        1.65,
        8,
        .7,
        i % 2 ? '#bdab93' : '#b7a68d',
        true,
      );
    }
  }
  draw(s, dt, reduced = false) {
    const { p, world: w } = s,
      mode = s.mode,
      title = mode === 'title',
      paused = ['paused', 'archive'].includes(mode);
    const t = title ? (reduced ? 0 : (this.clock += dt)) : s.time;
    if (paused) dt = 0;
    const rect = this.canvas.getBoundingClientRect(), W = Math.round(rect.width), H = Math.round(rect.height);
    if (!W || !H) return;
    if (this.W !== W || this.H !== H) {
      this.gl.setSize(W, H, false);
      this.W = W;
      this.H = H;
    }
    const aspect = W / H;
    const ending = mode === 'liftSequence' || mode === 'complete' ||
      mode === 'paused' && s.beforePause === 'liftSequence';
    const endT = ending ? clamp((5 - (mode === 'complete' ? 0 : s.transition)) / 5, 0, 1) : 0;
    const liftY = 6.9 * clamp((endT - .16) / .64, 0, 1);
    const actorX = p.x + (ending ? clamp((endT - .8) / .2, 0, 1) * 1.8 : 0), actorY = p.y + liftY;
    const vh = title ? (aspect < 1.05 ? 7.6 : 5.65) : Math.max(9.9, 12.4 / aspect);
    const targetX = title
      ? 4 - vh * aspect * (aspect < 1.05 ? .16 : .207)
      : clamp(p.x + p.facing * Math.min(2, vh * aspect * .08), 3, 208.5);
    const targetY = title ? (aspect < 1.05 ? -.68 : 1.55) : Math.max(2.6, actorY + 1.4);
    const snap = title || !this.prevMode || this.prevMode === 'title' ||
      mode === 'reboot' && this.prevMode !== 'reboot' || Math.abs(targetX - this.anchorX) > 16;
    const a = snap ? 1 : 1 - Math.exp(-6 * dt);
    this.anchorX = mix(this.anchorX, targetX, a);
    this.anchorY = mix(this.anchorY, targetY, a);
    this.camera.left = -vh * aspect / 2;
    this.camera.right = vh * aspect / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    const x = this.anchorX, y = this.anchorY;
    this.camera.position.set(x + (title ? 2.9 : 1.5), y + (title ? 3.2 : 3.0), 16.5);
    this.camera.lookAt(x, y, 0);
    this.camera.updateProjectionMatrix();
    this.scenery.update(x, t, s.region, reduced);
    this.prevMode = mode;
    for (const c of this.chunkGroups) {
      c.g.visible = c.x < x + vh * aspect * .65 + 5 && c.x + c.w > x - vh * aspect * .65 - 5;
    }
    this.robot.group.position.set(actorX, actorY, 0);
    this.robot.group.scale.setScalar(title ? 1.43 : 1);
    this.robot.animate(
      { ...p, mode, transition: s.transition, vx: ending && endT > .8 ? 3.5 : p.vx },
      ending ? endT * 5 : t,
      reduced ? 0 : dt,
    );
    this.shadow.position.set(actorX, actorY + .015, 0);
    this.shadow.visible = p.grounded;
    const visible = (o) => Math.abs(o.x - x) < vh * aspect * .66 + 3;
    const target = title ? null : s.target();
    this.focus.visible = false;
    for (const o of objects) {
      const g = this.props.get(o.kind + o.id);
      g.visible = visible(o) &&
        !(o.kind === 'archive' && w.archives.includes(o.id) ||
          o.kind === 'cache' && w.caches.includes(o.id)) &&
        !(title && o.kind === 'station');
      if (!g.visible) continue;
      updateProp(T, g, o.kind, { powered: s.power(o.id) || o.id === s.checkpoint.id, time: t });
      const highlighted = s.revealed[o.kind + o.id] > 0;
      if ((target?.o === o || highlighted) && mode === 'play') {
        this.focus.visible = true;
        this.focus.position.set(o.x, o.y + 1.5 + Math.sin(t * 5) * .06, 0);
      }
    }
    for (const c of w.cells) {
      const g = this.props.get('cell' + c.id), carry = c.id === p.carry;
      g.visible = visible(c) || carry;
      g.position.set(
        carry ? actorX + p.facing * .28 : c.x,
        carry ? actorY + .66 : c.y + (c.socket ? .34 : 0),
        carry ? .4 : 0,
      );
      if (target?.o === c && !carry) {
        this.focus.visible = true;
        this.focus.position.set(c.x, c.y + .77, 0);
      }
    }
    barriers.forEach((b, i) => {
      const g = this.shutters[i];
      g.visible = visible(b) && s.solids.includes(b);
      if (b.type === 'seam') g.children[0].material = mat(s.revealed[b.id] ? '#f4b45e' : '#ae652e');
    });
    s.platforms.forEach((f, i) => {
      this.platformMeshes[i].visible = visible(f);
      this.platformMeshes[i].position.set(f.x, f.y, 0);
    });
    vents.forEach((v, i) => {
      const { g, jet } = this.ventMeshes[i], st = s.ventState(v);
      g.visible = visible(v);
      jet.visible = st !== 'dormant';
      jet.scale.y = st === 'active' ? v.h : .12 + Math.abs(Math.sin(t * 12)) * .13;
    });
    this.wires.forEach(({ id, mesh }) => {
      mesh.material = mat(
        s.power(id) || s.revealed['socket' + id] || s.revealed['switch' + id] ? '#edb56f' : '#6c6454',
        true,
      );
    });
    this.falls.forEach((f, i) => {
      f.visible = s.region === 1;
      f.position.y = 2.6 + (reduced ? 0 : Math.sin(t * 2 + i) * .55);
    });
    this.conduits.forEach((m, i) => {
      m.material = mat(s.power(['A', 'B', 'C'][i]) ? '#e7a254' : '#495455', true);
    });
    s.machines.forEach((m, i) => {
      const g = this.props.get(m.type + m.id);
      g.visible = visible(m);
      const b = this.beams[i];
      b.visible = false;
      if (!g.visible) return;
      g.position.set(m.x, m.y, 0);
      updateProp(T, g, m.type, { state: m.state, time: t });
      if (m.type === 'skitter') g.rotation.y = m.dir < 0 ? Math.PI : 0;
      if (['warning', 'firing', 'aim'].includes(m.state)) {
        let dx = -m.beam, dy = 0;
        if (m.type === 'drone') {
          const len = 8 *
            Math.min(
              1,
              ...s.solids.map((r) => rayHit(m.x, m.y + .6, m.x + m.aimX * 8, m.y + .6 + m.aimY * 8, r)),
            );
          dx = m.aimX * len;
          dy = m.aimY * len;
        }
        b.visible = true;
        b.position.set(m.x + dx / 2, m.y + (m.type === 'drone' ? .6 : .63) + dy / 2, .14);
        b.rotation.z = Math.atan2(dy, dx);
        b.scale.set(Math.hypot(dx, dy), m.state === 'firing' ? .2 : .028, .08);
      }
    });
    let used = 0;
    const spark = (px, py, pz, w, h, d, col, rot = 0) => {
      if (used >= this.sparks.length) return;
      const q = this.sparks[used++];
      q.visible = true;
      q.position.set(px, py, pz);
      q.scale.set(w, h, d);
      q.rotation.z = rot;
      q.material = mat(col, true);
    };
    for (const b of s.bolts) spark(b.x, b.y, .18, .18, .16, .16, '#ffbb64');
    for (const e of s.effects) {
      const u = e.t / e.max, v = 1 - u, n = e.type === 'dash' ? 5 : 10;
      for (let i = 0; i < n; i++) {
        const ang = i / n * Math.PI * 2;
        if (e.type === 'dash') {
          spark(e.x - e.dir * i * .2, e.y + .09 * Math.sin(i * 4), .06, .24 * u, .23 * u, .17 * u, '#92ddc7');
        } else {spark(
            e.x + Math.cos(ang) * (.42 + .58 * v),
            e.y + Math.sin(ang) * (.52 + .64 * v),
            .35,
            .15 * u,
            .07 * u,
            .08 * u,
            e.type === 'shield' ? '#82f0ed' : '#f4b96f',
            ang,
          );}
      }
    }
    for (; used < this.sparks.length; used++) this.sparks[used].visible = false;
    this.ring.visible = s.waves.length > 0;
    if (s.waves.length) {
      const w = s.waves[0], pts = this.ringGeo.attributes.position;
      for (let i = 0; i <= 128; i++) {
        const angle = i / 128 * 2 * Math.PI, dx = Math.cos(angle) * w.r, dy = Math.sin(angle) * w.r;
        const k = Math.min(
          1,
          ...s.solids.filter((b) => b.type !== 'seam').map((b) => rayHit(w.x, w.y, w.x + dx, w.y + dy, b)),
        );
        pts.setXYZ(i, w.x + dx * k, w.y + dy * k, .5);
      }
      pts.needsUpdate = true;
    }
    this.lift.position.y = 8.25 + liftY;
    this.guard.visible = ending && endT > .02;
    this.guard.position.y = .1 + .62 * clamp((endT - .02) / .12, 0, 1);
    this.dawn.visible = endT > .68;
    this.gl.render(this.scene, this.camera);
  }
}
