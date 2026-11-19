// A lightweight side view keeps the same simulation and interaction targets on devices without WebGL.
import { objects, vents } from './level.js';
export class FlatView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.poster = new Image();
    this.poster.src = './assets/workshop.webp';
  }
  draw(s) {
    const c = this.canvas, g = this.ctx, W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    if (s.mode === 'title' && this.poster.complete && this.poster.naturalWidth) {
      const scale = Math.max(W / this.poster.width, H / this.poster.height);
      g.drawImage(
        this.poster,
        (W - this.poster.width * scale) * .5,
        (H - this.poster.height * scale) * .5,
        this.poster.width * scale,
        this.poster.height * scale,
      );
      return;
    }
    const title = s.mode === 'title',
      end = s.mode === 'liftSequence' ? Math.min(7, (5 - s.transition) * 1.7) : s.mode === 'complete' ? 7 : 0;
    const u = Math.min(H / (title ? 5.5 : 9.7), W / (title ? 9 : 13)),
      cx = title ? 4 - W / u * .22 : s.p.x + 1.7,
      cy = title ? 1.4 : Math.max(2.6, s.p.y + 1.3 + end);
    const X = (x) => W / 2 + (x - cx) * u, Y = (y) => H / 2 - (y - cy) * u;
    const rect = (x, y, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(X(x)), Math.round(Y(y + h)), Math.ceil(w * u), Math.ceil(h * u));
    };
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1b333f');
    grad.addColorStop(1, '#2d5961');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let i = -12; i < 225; i += 2) {
      rect(i, 0, 1.4, 4 + Math.sin(i) * 2, '#29424d');
      rect(i, 5 + Math.sin(i) * 2, 2.1, 4, '#223942');
      if (i % 6 === 0) {
        rect(i, 2.4, .4, 2.5, '#324b55');
        rect(i, 2.3, .45, .14, '#e7b679');
      }
    }
    for (const b of s.solids) {
      if (X(b.x + b.w) < 0 || X(b.x) > W) continue;
      rect(b.x, b.y, b.w, b.h, b.type === 'seam' ? '#b97e4c' : b.type === 'shutter' ? '#566975' : '#344651');
      rect(b.x, b.y + b.h - .12, b.w, .12, '#97a6a4');
      for (let x = b.x + .5; x < b.x + b.w; x += 1.1) rect(x, b.y + b.h - .45, .6, .06, '#556874');
    }
    for (const o of objects) {
      if (
        (o.kind === 'archive' && s.world.archives.includes(o.id)) ||
        (o.kind === 'cache' && s.world.caches.includes(o.id))
      ) continue;
      rect(o.x - .4, o.y, .8, .37, '#4d6268');
      rect(
        o.x - .27,
        o.y + .28,
        .54,
        .6,
        o.kind === 'archive' ? '#b5a7d8' : o.kind === 'socket' ? '#ae8b59' : '#75999d',
      );
      rect(o.x - .15, o.y + .61, .30, .13, s.power(o.id) ? '#ffc26f' : '#7de2d1');
    }
    for (const c of s.world.cells) {
      const x = c.id === s.p.carry ? s.p.x + .32 : c.x, y = c.id === s.p.carry ? s.p.y + .7 : c.y;
      rect(x - .22, y, .44, .46, '#edb066');
    }
    for (const m of s.machines) {
      rect(m.x - .42, m.y, .84, .48, '#59646e');
      rect(
        m.x - .2,
        m.y + .28,
        .4,
        .13,
        m.state === 'stunned' ? '#70dfdb' : m.state === 'disabled' ? '#394953' : '#f2a458',
      );
      if (m.state === 'warning' || m.state === 'firing') {
        rect(m.x - m.beam, m.y + .53, m.beam, m.state === 'firing' ? .2 : .035, '#eb9550');
      }
    }
    for (const b of s.bolts) rect(b.x - .08, b.y - .08, .16, .16, '#ffc271');
    for (const v of vents) {
      rect(
        v.x,
        v.y,
        v.w,
        s.ventState(v) === 'active' ? v.h : .1,
        s.ventState(v) === 'dormant' ? '#56656b' : '#ec9859',
      );
    }
    const { x, y: base } = s.p, y = base + end;
    rect(x - .3, y, .2, .37, '#8c9a9c');
    rect(x + .1, y, .2, .37, '#8c9a9c');
    rect(x - .29, y + .36, .58, .56, '#dedac2');
    rect(x - .15, y + .55, .3, .13, '#60dccb');
    rect(x - .24, y + .85, .47, .12, '#c37c43');
    rect(x - .47, y + .97, .94, .52, '#dedbc6');
    rect(x - .42, y + 1.06, .84, .32, '#192e36');
    rect(x + .12, y + 1.12, .16, .18, '#ffd291');
    rect(x - .24, y + 1.47, .05, .15, '#818d8e');
    for (const w of s.waves) {
      g.beginPath();
      g.arc(X(w.x), Y(w.y), w.r * u, 0, 2 * Math.PI);
      g.strokeStyle = '#8ae0d1';
      g.stroke();
    }
  }
}
