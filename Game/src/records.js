const KEY = 'deepwake.records.v1', SETTINGS = 'deepwake.settings.v1';
const empty = () => ({ version: 1, best: null, full: null, fewest: null });
const validTime = (t) => Number.isFinite(t) && t > 0;
export function browserStorage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
export class Records {
  constructor(storage = browserStorage()) {
    this.storage = storage;
    this.data = empty();
    this.settings = {
      muted: false,
      reduced: globalThis.matchMedia?.('(prefers-reduced-motion:reduce)').matches || false,
    };
    try {
      const s = JSON.parse(storage?.getItem(SETTINGS) || 'null');
      if (s?.version === 1) {
        for (const k of ['muted', 'reduced']) if (typeof s[k] === 'boolean') this.settings[k] = s[k];
      }
    } catch {}
    try {
      const d = JSON.parse(storage?.getItem(KEY) || 'null');
      if (d?.version !== 1) return;
      if (validTime(d.best)) this.data.best = d.best;
      if (validTime(d.full)) this.data.full = d.full;
      if (Number.isInteger(d.fewest?.n) && d.fewest.n >= 0 && validTime(d.fewest.time)) {
        this.data.fewest = d.fewest;
      }
    } catch {}
  }
  set(k, v) {
    if (!['muted', 'reduced'].includes(k)) return;
    this.settings[k] = !!v;
    try {
      this.storage?.setItem(SETTINGS, JSON.stringify({ ...this.settings, version: 1 }));
    } catch {}
  }
  record(r) {
    if (
      !r || !validTime(r.time) || !Number.isInteger(r.recoveries) || r.recoveries < 0 ||
      !['A', 'B', 'C'].every((id) => r.relays?.includes(id))
    ) return;
    const d = this.data;
    d.best = d.best === null ? r.time : Math.min(d.best, r.time);
    if (r.archives === 3) d.full = d.full === null ? r.time : Math.min(d.full, r.time);
    if (!d.fewest || r.recoveries < d.fewest.n || r.recoveries === d.fewest.n && r.time < d.fewest.time) {
      d.fewest = { n: r.recoveries, time: r.time };
    }
    try {
      this.storage?.setItem(KEY, JSON.stringify(d));
    } catch {}
  }
}
export function clock(t) {
  return t == null
    ? '—'
    : [Math.floor(t / 60), Math.floor(t) % 60].map((x) => String(x).padStart(2, '0')).join(':');
}
