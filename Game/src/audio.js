// All pitches, rhythms and transient textures are synthesized in the browser.
// Layers store frequency in hertz, duration and onset in seconds.
function tone(wave, pitch, endPitch, duration, level, delay = 0, attack = 0.008) {
  return { wave, pitch, endPitch, duration, level, delay, attack };
}
function dust(center, end, duration, level, delay = 0) {
  return tone('noise', center, end, duration, level, delay, 0.003);
}
const bell = (pitch, duration, level, delay = 0) => tone('sine', pitch, pitch, duration, level, delay, 0.008);
const effects = {
  stepStone: [dust(640, 170, 0.075, 0.13), tone('sine', 86, 45, 0.06, 0.09)],
  stepMetal: [dust(1900, 640, 0.045, 0.07), bell(364, 0.14, 0.05), bell(853, 0.08, 0.027)],
  jump: [tone('triangle', 145, 337, 0.13, 0.105), dust(760, 2200, 0.09, 0.08)],
  land: [tone('sine', 138, 42, 0.15, 0.15), dust(1280, 280, 0.12, 0.14)],
  wall: [dust(2180, 860, 0.13, 0.095), tone('triangle', 184, 93, 0.09, 0.04)],
  dash: [dust(530, 3500, 0.14, 0.27), tone('sine', 354, 71, 0.23, 0.12)],
  pulse: [
    tone('sine', 117, 391, 0.31, 0.22, 0, 0.032),
    bell(587, 0.43, 0.095, 0.09),
    bell(1174, 0.38, 0.045, 0.18),
  ],
  empty: [tone('triangle', 226, 201, 0.065, 0.065), tone('triangle', 166, 141, 0.095, 0.055, 0.095)],
  shield: [tone('sine', 679, 109, 0.31, 0.19), dust(4200, 840, 0.21, 0.20), bell(1223, 0.22, 0.07, 0.04)],
  hurt: [tone('sawtooth', 131, 44, 0.17, 0.07), dust(1580, 180, 0.17, 0.2)],
  cell: [dust(1100, 220, 0.08, 0.12), bell(494, 0.13, 0.08, 0.025)],
  socket: [tone('triangle', 90, 205, 0.19, 0.15), bell(617, 0.32, 0.10, 0.10)],
  switch: [dust(1600, 550, 0.06, 0.15), bell(440, 0.14, 0.12), bell(660, 0.18, 0.09, 0.10)],
  relay: [
    tone('sine', 73, 110, 1.1, 0.16, 0, 0.12),
    bell(293.66, 0.85, 0.14, 0.12),
    bell(440, 0.95, 0.12, 0.32),
    bell(659.25, 1.17, 0.10, 0.54),
  ],
  archive: [bell(493.88, 0.58, 0.12), bell(739.99, 0.70, 0.095, 0.15), bell(987.77, 0.79, 0.055, 0.42)],
  cache: [dust(1700, 450, 0.09, 0.12), bell(392, 0.18, 0.12), bell(493.88, 0.30, 0.095, 0.09)],
  alert: [tone('triangle', 646, 700, 0.12, 0.12), tone('triangle', 646, 755, 0.17, 0.12, 0.24)],
  stun: [tone('triangle', 432, 109, 0.22, 0.12), bell(826, 0.22, 0.06, 0.035)],
  disable: [dust(2640, 520, 0.25, 0.17), tone('triangle', 276, 40, 0.43, 0.13)],
  deflect: [bell(1038, 0.22, 0.105), bell(1440, 0.16, 0.055)],
  shutdown: [tone('triangle', 329, 48, 0.65, 0.14), dust(1040, 80, 0.36, 0.095)],
  reboot: [bell(220, 0.28, 0.115), bell(329.63, 0.32, 0.10, 0.15), bell(440, 0.45, 0.09, 0.31)],
  lift: [tone('triangle', 50, 95, 1.7, 0.1, 0.03, 0.18), dust(370, 650, 1.1, 0.08), bell(220, 0.48, 0.075)],
  finish: [
    bell(220, 1.6, 0.14),
    bell(329.63, 1.7, 0.12, 0.13),
    bell(440, 1.8, 0.10, 0.32),
    bell(554.37, 2.3, 0.085, 0.57),
  ],
  seam: [dust(3200, 900, 0.20, 0.21), bell(1317, 0.24, 0.065, 0.024), bell(782, 0.20, 0.07, 0.07)],
};

// Sixteen-step phrases share a tonal center. Reservoir leaves room between
// higher glass notes. Foundry and ascent bring the low mechanical rhythm closer.
const scores = [
  { step: 0.58, root: 55, drum: [0, 8, 13], motif: [[2, 19], [7, 14], [12, 17]], wave: 'triangle' },
  { step: 0.67, root: 73.42, drum: [0, 10], motif: [[1, 19], [5, 24], [11, 26], [14, 21]], wave: 'sine' },
  { step: 0.47, root: 49, drum: [0, 3, 8, 11, 14], motif: [[2, 12], [6, 15], [10, 7]], wave: 'triangle' },
  {
    step: 0.43,
    root: 55,
    drum: [0, 4, 8, 10, 12],
    motif: [[1, 12], [5, 16], [9, 19], [13, 23]],
    wave: 'sine',
  },
];

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.paused = false;
    this.disposed = false;
    this.voices = new Set();
    this.lastCue = new Map();
    this.beat = 0;
    this.remaining = 0;
    this.region = -1;
    this.visibility = () => this.sync();
    globalThis.document?.addEventListener('visibilitychange', this.visibility);
  }

  gesture() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        let seed = 0x123b2;
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = seed / 2147483648 - 1;
        }
      }
      if (this.context.state === 'suspended' || this.context.state === 'interrupted') {
        this.context.resume().catch(() => {});
      }
      this.sync();
    } catch {
      // Audio initialization is optional, including on restricted browser pages.
      this.dispose();
    }
  }

  get quiet() {
    return this.muted || this.paused || this.disposed || Boolean(globalThis.document?.hidden);
  }

  setMuted(value) {
    if (this.muted === Boolean(value)) return;
    this.muted = Boolean(value);
    this.sync();
  }

  setPaused(value) {
    if (this.paused === Boolean(value)) return;
    this.paused = Boolean(value);
    this.sync();
  }

  sync() {
    if (!this.master || this.context.state === 'closed') return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.quiet ? 0 : 0.62, now, 0.009);
    if (this.quiet) {
      for (const voice of this.voices) voice.cancel(now);
      this.lastCue.clear();
      this.remaining = 0.16;
    }
  }

  voice(layer) {
    if (this.voices.size >= 32 || !this.context || this.quiet) return;
    const ctx = this.context;
    const when = ctx.currentTime + 0.003 + layer.delay;
    const stop = when + layer.duration;
    const gain = ctx.createGain();
    let source, filter, frequency;
    if (layer.wave === 'noise') {
      source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.78;
      source.connect(filter);
      filter.connect(gain);
      frequency = filter.frequency;
    } else {
      source = ctx.createOscillator();
      source.type = layer.wave;
      source.connect(gain);
      frequency = source.frequency;
    }
    frequency.setValueAtTime(layer.pitch, when);
    frequency.exponentialRampToValueAtTime(layer.endPitch, stop);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(layer.level, when + layer.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    gain.connect(this.master);

    const clean = () => {
      source.onended = null;
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    const voice = {
      clean,
      cancel: (now) => {
        // This immediately detaches scheduled layers, even in a suspended tab.
        source.stop(now);
        clean();
      },
    };
    this.voices.add(voice);
    source.onended = clean;
    source.start(when);
    source.stop(stop + 0.01);
  }

  play(name) {
    const layers = effects[name];
    if (!layers || !this.master || this.quiet || this.context.state === 'closed') return;
    const now = this.context.currentTime;
    const minimumInterval = name === 'wall' || name.startsWith('step') ? 0.10 : 0.055;
    if (now - (this.lastCue.get(name) ?? -Infinity) < minimumInterval) return;
    this.lastCue.set(name, now);
    for (const layer of layers) this.voice(layer);
  }

  update(dt, regionIndex) {
    if (!this.master || this.quiet || this.context.state !== 'running') return;
    const region = Number.isInteger(regionIndex) ? Math.max(0, Math.min(3, regionIndex)) : 0;
    if (region !== this.region) {
      this.region = region;
      this.beat = 0;
      this.remaining = 0;
    }
    this.remaining -= Math.max(0, Math.min(0.1, dt || 0));
    if (this.remaining > 0) return;
    const score = scores[region];
    this.remaining = score.step;
    const beat = this.beat++ % 16;
    if (beat === 0 || beat === 8) {
      const root = score.root * (beat === 8 ? 0.75 : 1);
      this.voice(tone('sine', root, root, score.step * 7.7, 0.075, 0, 0.65));
      this.voice(tone('triangle', root * 1.502, root * 1.5, score.step * 6.5, 0.025, 0, 0.9));
    }
    if (score.drum.includes(beat)) {
      this.voice(tone('sine', 101, 40, 0.15, 0.065));
      this.voice(dust(region === 2 ? 1770 : 850, 360, 0.11, 0.045));
    }
    const note = score.motif.find(([onset]) => onset === beat);
    if (note) {
      const hz = score.root * 2 ** (note[1] / 12);
      this.voice(tone(score.wave, hz, hz, 1.42, 0.055, 0, 0.07));
      this.voice(bell(hz * 2.003, 0.84, 0.016, 0.18));
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    globalThis.document?.removeEventListener('visibilitychange', this.visibility);
    this.sync();
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.noise = null;
  }
}
