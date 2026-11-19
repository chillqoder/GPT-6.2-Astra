import { View } from './renderer.js';
import { FlatView } from './fallback.js';
import { DT, Expedition } from './simulation.js';
import { SoundEngine } from './audio.js';
import { archives, regions } from './level.js';
import { clock, Records } from './records.js';
import { icon, mark, paintRegion } from './interface-art.js';

const $ = (s) => document.querySelector(s),
  game = new Expedition(),
  audio = new SoundEngine(),
  records = new Records();
const sceneCanvas = $('#world');
let view;
try {
  view = new View(sceneCanvas);
} catch (err) {
  console.warn('Using the compatibility renderer.', err);
  const next = sceneCanvas.cloneNode(false);
  sceneCanvas.replaceWith(next);
  view = new FlatView(next);
}
sceneCanvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  const replacement = sceneCanvas.cloneNode(false);
  sceneCanvas.replaceWith(replacement);
  view = new FlatView(replacement);
});
mark();
document.querySelectorAll('[data-icon]').forEach((el) => el.innerHTML = icon(el.dataset.icon));
const routeList = $('#routes');
regions.slice(0, 3).forEach((region, i) => {
  const b = document.createElement('button');
  b.className = 'route-card';
  b.innerHTML = '<canvas aria-hidden="true"></canvas><span class="card-label">REGION 0' + (i + 1) +
    '</span><strong class="card-title">' + region.name + '</strong><span class="relay-label">RELAY ' +
    ['A', 'B', 'C'][i] + '</span>';
  b.setAttribute('aria-label', 'Read ' + region.name + ' briefing');
  routeList.append(b);
  paintRegion(b.querySelector('canvas'), i);
  b.onclick = () => openInfo('region' + i);
});
const dialog = $('#panel'), panelBody = $('#panelBody'), held = new Map(), presses = {};
let lockedKeys = new Set(),
  panelKind = '',
  returnMode = '',
  lastSerial = game.serial,
  lastTime = performance.now(),
  acc = 0,
  resultSaved = null,
  lastHud = '',
  lastPrompt = '';
function resetInput() {
  for (const id of held.keys()) if (typeof id === 'string') lockedKeys.add(id);
  held.clear();
  for (const k in presses) delete presses[k];
  document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
}
function isHeld(action) {
  return [...held.values()].includes(action);
}
function freshInput() {
  const i = { left: isHeld('left'), right: isHeld('right'), jump: isHeld('jump'), ...presses };
  for (const k in presses) delete presses[k];
  return i;
}
const actionKeys = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  KeyZ: 'jump',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyX: 'dash',
  KeyQ: 'pulse',
  KeyE: 'interact',
};
const downs = { jump: 'jumpPress', dash: 'dashPress', pulse: 'pulsePress', interact: 'interact' };
function press(id, action) {
  if (held.has(id)) return;
  const was = isHeld(action);
  held.set(id, action);
  if (!was && downs[action]) presses[downs[action]] = true;
}
function release(id, cut = true) {
  const a = held.get(id);
  held.delete(id);
  lockedKeys.delete(id);
  if (cut && a === 'jump' && !isHeld('jump')) presses.jumpRelease = true;
}
function syncAudio() {
  audio.setMuted(records.settings.muted);
  audio.setPaused(
    ['title', 'paused'].includes(game.mode) ||
      (dialog.open && !['archive', 'complete'].includes(panelKind)) || document.hidden,
  );
}
function updateMute() {
  const muted = records.settings.muted;
  $('#mute').innerHTML = icon(muted ? 'mute' : 'sound') + '<span class="sound-label">Sound ' +
    (muted ? 'off' : 'on') + '</span>';
  $('#mute').setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  $('#mute').setAttribute('aria-pressed', String(muted));
  syncAudio();
}
updateMute();
$('#full').innerHTML = icon('full');
$('#pause').innerHTML = icon('pause');
$('#mute').onclick = () => {
  audio.gesture();
  records.set('muted', !records.settings.muted);
  updateMute();
};
$('#full').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    game.cue('Fullscreen is unavailable in this window');
  }
};
document.addEventListener(
  'fullscreenchange',
  () =>
    $('#full').setAttribute(
      'aria-label',
      document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen',
    ),
);
const row = (l, v) => '<div class="statline"><span>' + l + '</span><strong>' + v + '</strong></div>';
const primary = (id, text) => '<button class="primary" id="' + id + '">' + text + '</button>';
const secondary = (id, text) => '<button class="secondary" id="' + id + '">' + text + '</button>';
function bind(id, fn) {
  const b = document.getElementById(id);
  if (b) b.onclick = fn;
}
function show(kind, html) {
  resetInput();
  panelKind = kind;
  panelBody.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  $('#closePanel').hidden = kind === 'complete';
  const f = panelBody.querySelector('.primary');
  if (f) f.focus({ preventScroll: true });
  syncAudio();
}
function hide() {
  panelKind = '';
  if (dialog.open) dialog.close();
  resetInput();
  syncAudio();
}
function close() {
  if (panelKind === 'complete') {
    begin();
    return;
  }
  if (panelKind === 'archive') {
    hide();
    game.dismiss();
    stateChanged();
    return;
  }
  if (returnMode === 'paused' && panelKind !== 'pause') {
    returnMode = '';
    pausePanel();
    return;
  }
  hide();
  if (game.mode === 'paused') game.resume();
  returnMode = '';
  stateChanged();
}
function begin() {
  hide();
  audio.gesture();
  game.restart();
  resetInput();
  acc = 0;
  resultSaved = null;
  returnMode = '';
  lastHud = '';
  view.prevMode = '';
  stateChanged();
  document.activeElement?.blur();
  window.scrollTo(0, 0);
}
$('#begin').onclick = begin;
$('#closePanel').onclick = close;
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  if (panelKind !== 'complete') close();
});
function pausePanel() {
  show(
    'pause',
    '<div class="eyebrow">UNIT ILO–01</div><h2 id="panelTitle">Expedition Paused</h2>' +
      row('Current region', regions[game.region].name) + row('Expedition time', clock(game.elapsed)) +
      row('Recoveries', game.recoveries) + '<div class="btnrow">' + primary('resume', 'Resume') +
      secondary('retry', 'Retry Checkpoint') + secondary('restart', 'Restart Expedition') +
      '</div><div class="btnrow">' + secondary('readmanual', 'Field manual') +
      secondary('readarchives', 'Memory archives') + secondary('readrecords', 'Records') + '</div>',
  );
  bind('resume', close);
  bind('retry', () => {
    hide();
    game.resume();
    if (game.mode === 'play') game.recover();
    stateChanged();
  });
  $('#retry').disabled = game.beforePause !== 'play';
  bind('restart', begin);
  bind('readmanual', () => openInfo('manual'));
  bind('readarchives', () => openInfo('archives'));
  bind('readrecords', () => openInfo('records'));
}
function togglePause() {
  if (dialog.open) {
    if (panelKind === 'pause') close();
    return;
  }
  if (game.mode === 'title') return;
  game.pause();
  if (game.mode === 'paused') {
    pausePanel();
    stateChanged();
  }
}
$('#pause').onclick = togglePause;
function openInfo(k) {
  const heading = (t) => '<h2 id="panelTitle">' + t + '</h2>';
  returnMode = game.mode === 'paused' ? 'paused' : game.mode;
  if (!dialog.open && game.mode !== 'title') game.pause();
  let html = '';
  if (k === 'records') {
    const d = records.data;
    html = heading('Expedition records') + row('Best Completion Time', clock(d.best)) +
      row('Best Full-Archive Time', clock(d.full)) +
      row('Fewest Recoveries', d.fewest ? d.fewest.n + ' · ' + clock(d.fewest.time) : '—') +
      '<p>Complete an expedition to record a time. Recover all three memory archives to qualify for a full-archive record.</p>';
  }
  if (k === 'manual') {
    html = heading('Field manual') + '<div class="helpgrid">' +
      [
        ['Move', 'A / D or ← / →'],
        ['Jump / wall jump', 'Space or Z'],
        ['Horizontal dash', 'Shift or X'],
        ['Echo pulse', 'Q · 35 resonance'],
        ['Interact / carry', 'E'],
        ['Pause / resume', 'P or Esc'],
        ['Retry checkpoint', 'R'],
      ].map(([a, b]) => '<span>' + a + '</span><span><kbd>' + b + '</kbd></span>').join('') +
      '</div><h3>Movement & resonance</h3><p>Hold jump to climb higher. Press toward a wall to slide, then jump away. Dash through cracked amber seams. Pulse to reveal connections or stun a machine, then dash into it to disable it.</p><p>Your shield automatically spends 50 resonance to absorb a hit. Energy regenerates after a short rest. Carrying a cell leaves ordinary jumps available and suspends dash, pulse, and wall movement.</p><h3>Reboot stations</h3><p>Activate a station to repair ILO and save the surrounding machinery and discoveries. Each restored relay saves automatically.</p><label><input id="motion" type="checkbox" ' +
      (records.settings.reduced ? 'checked' : '') + '> Reduce motion</label>';
  }
  if (k === 'archives') {
    html = heading('Memory archives') +
      archives.map((a, i) =>
        game.world.archives.includes(a.id)
          ? '<h3>' + a.name + '</h3><p>' + a.text + '</p>'
          : row(regions[i].name, 'Undiscovered')
      ).join('');
  }
  if (k.startsWith('region')) {
    const i = Number(k.slice(-1)), r = regions[i];
    html = '<div class="eyebrow">REGION 0' + (i + 1) + ' / RELAY ' + ['A', 'B', 'C'][i] + '</div>' +
      heading(r.name) + '<p>' + r.description + '</p>' + row('Depth', '−' + r.depth + ' m') +
      row('Memory archives', '1');
  }
  show(
    k,
    html + '<div class="btnrow">' +
      primary('backPanel', returnMode === 'paused' ? 'Back to pause menu' : 'Return to expedition') +
      '</div>',
  );
  bind('backPanel', close);
  const motion = $('#motion');
  if (motion) motion.onchange = () => records.set('reduced', motion.checked);
  stateChanged();
}
$('#manual').onclick = $('#guideLink').onclick = () => openInfo('manual');
$('#records').onclick = () => openInfo('records');
$('#navExp').onclick = () => {
  if (dialog.open) close();
  else if (game.mode === 'play') togglePause();
  else $('#begin').focus();
};
function stateChanged() {
  resetInput();
  lastSerial = game.serial;
  document.body.dataset.mode = game.mode;
  lastPrompt = '?';
  lastHud = '';
  syncAudio();
  if (game.mode === 'archive' && panelKind !== 'archive') {
    const f = game.fragment;
    show(
      'archive',
      '<div class="eyebrow">MEMORY ARCHIVE RECOVERED</div><h2 id="panelTitle">' + f.name + '</h2><p>' +
        f.text + '</p>' + primary('continue', 'Continue'),
    );
    bind('continue', close);
  }
  if (game.mode === 'complete' && resultSaved !== game.result) {
    resultSaved = game.result;
    records.record(game.result);
    const r = game.result;
    show(
      'complete',
      '<div class="eyebrow">' + (r.archives === 3 ? 'FULL-ARCHIVE EXPEDITION' : 'EXPEDITION COMPLETE') +
        '</div><h2 id="panelTitle">Signal Restored</h2><p>At the surface, ILO hears the three relays answering from below.</p>' +
        row('Expedition time', clock(r.time)) + row('Recoveries', r.recoveries) +
        row('Archives recovered', r.archives + ' / 3') + row('Caches found', r.caches + ' / 3') +
        row('Machines disabled', r.machines + ' / 4') + row('Relays online', 'A · B · C') +
        '<div class="btnrow">' + primary('newrun', 'New Expedition') + '</div>',
    );
    bind('newrun', begin);
  }
  refreshUI();
}
function refreshUI() {
  const p = game.p, w = game.world, r = regions[game.region], play = game.mode === 'play';
  document.body.classList.toggle('carrying', !!p.carry);
  $('#hud').classList.toggle('low-energy', game.effects.some((e) => e.type === 'empty'));
  if (game.mode !== 'title') {
    const stamp = [
      game.region,
      p.integrity,
      Math.floor(p.energy),
      w.relays.length,
      w.archives.length,
      p.carry,
      clock(game.elapsed),
    ].join('|');
    if (stamp !== lastHud) {
      lastHud = stamp;
      $('#hud').innerHTML =
        '<div class="hud-cluster"><div><span class="hud-label">Integrity</span><div class="integrity" aria-label="' +
        p.integrity + ' of 3">' + [1, 2, 3].map((n) =>
          '<i class="' + (n <= p.integrity ? 'on' : '') + '"></i>'
        ).join('') +
        '</div></div><div aria-label="Pulse costs 35, shield costs 50"><span class="hud-label">Resonance ' +
        Math.floor(p.energy) + '</span><div class="meter"><i style="width:' + p.energy +
        '%"></i></div></div><div><span class="hud-label">Relays</span><div class="relays">' +
        ['A', 'B', 'C'].map((c) => '<i class="' + (w.relays.includes(c) ? 'on' : '') + '">' + c + '</i>')
          .join('') +
        '</div></div><div><span class="hud-label">Archives</span><span class="hud-stat">' +
        w.archives.length + ' / 3</span></div>' + (p.carry ? '<span class="hud-stat">▣ Cell</span>' : '') +
        '</div><div class="zone"><small>SECTOR 0' + (game.region + 1) + ' · ' + clock(game.elapsed) +
        '</small>' + r.name + '</div>';
    }
  }
  const hint = play ? game.hint() : null, txt = hint ? '<kbd>' + hint.key + '</kbd>' + hint.text : '';
  if (txt !== lastPrompt) {
    lastPrompt = txt;
    $('#prompt').innerHTML = txt;
    $('#prompt').classList.toggle('on-screen', !!txt);
  }
  const notice = $('#notice'), note = play ? game.message?.text || '' : '';
  if (notice.textContent !== note) notice.textContent = note;
  notice.classList.toggle('on-screen', !!note);
  const tr = $('#transition'),
    line = {
      shutdown: 'Signal lost',
      reboot: 'Rebooting at Station',
      relayActivation: 'Relay ' + w.relays.at(-1) + ' online',
      liftSequence: game.transition > 3.5 ? 'Ascending to the surface' : '',
    }[game.mode] || '';
  if (tr.textContent !== line) tr.textContent = line;
  tr.classList.toggle('on-screen', !!line);
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  if (dialog.open) {
    if ((k === 'KeyP' && panelKind === 'pause') || k === 'Escape') {
      e.preventDefault();
      if (!e.repeat && panelKind !== 'complete') close();
      return;
    }
    if (
      k === 'Enter' && !e.repeat &&
      (!dialog.contains(document.activeElement) || document.activeElement === dialog)
    ) {
      e.preventDefault();
      panelBody.querySelector('.primary')?.click();
    }
    return;
  }
  if (!actionKeys[k] && !['Enter', 'KeyP', 'Escape', 'KeyR'].includes(k)) return;
  if (k === 'Enter' && document.activeElement?.tagName === 'BUTTON') return;
  e.preventDefault();
  if (e.repeat || lockedKeys.has(k)) return;
  if (k === 'Enter' && game.mode === 'title') {
    begin();
    return;
  }
  if (['KeyP', 'Escape'].includes(k)) {
    togglePause();
    return;
  }
  if (game.mode !== 'play') return;
  if (k === 'KeyR') {
    game.recover();
    stateChanged();
    return;
  }
  if (actionKeys[k]) press(k, actionKeys[k]);
});
window.addEventListener('keyup', (e) => release(e.code));
for (const b of document.querySelectorAll('[data-key]')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (game.mode !== 'play') return;
    b.setPointerCapture(e.pointerId);
    press(e.pointerId, b.dataset.key);
    b.classList.add('down');
  });
  const up = (e) => {
    release(e.pointerId);
    b.classList.remove('down');
  };
  b.addEventListener('pointerup', up);
  for (const type of ['pointercancel', 'lostpointercapture']) {
    b.addEventListener(type, (e) => {
      if (held.has(e.pointerId)) resetInput();
    });
  }
}
function lostFocus() {
  resetInput();
  lockedKeys.clear();
  if (!dialog.open && game.mode !== 'title' && game.mode !== 'complete') togglePause();
  acc = 0;
  lastTime = performance.now();
  syncAudio();
}
window.addEventListener('blur', lostFocus);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lostFocus();
  else {
    lastTime = performance.now();
    syncAudio();
  }
});
function tick(input) {
  game.step(input);
  if (game.serial !== lastSerial) stateChanged();
  for (const e of game.events.splice(0)) audio.play(e);
  if (game.mode === 'play') audio.update(DT, game.region);
}
let manual = false;
function frame(now) {
  const delta = Math.min(.09, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (!document.hidden && !manual) {
    acc = Math.min(.12, acc + delta);
    while (acc >= DT) {
      tick(freshInput());
      acc -= DT;
    }
    refreshUI();
    view.draw(game, delta, records.settings.reduced);
  }
  requestAnimationFrame(frame);
}
stateChanged();
requestAnimationFrame(frame);
// Opt-in browser verification drives only the same fixed-step input path used above.
if (new URLSearchParams(location.search).has('verify')) {
  window.expeditionCheck = {
    get game() {
      return game;
    },
    get view() {
      return view;
    },
    get records() {
      return records;
    },
    step: tick,
    setManual(v) {
      manual = v;
      acc = 0;
      lastTime = performance.now();
    },
    advance(input = {}, frames = 1) {
      manual = true;
      for (let n = 0; n < frames; n++) {
        tick(n ? { left: input.left, right: input.right, jump: input.jump } : input);
      }
      refreshUI();
      view.draw(game, Math.min(.08, DT * frames), records.settings.reduced);
    },
    draw() {
      view.draw(game, 1 / 60, records.settings.reduced);
    },
  };
}
