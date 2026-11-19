export const regions = [
  {
    name: 'Buried Workshop',
    from: -4,
    depth: 486,
    short: 'Workshop',
    task: 'Restore the workshop circuit',
    description: 'Break the amber seam, carry the power cell to its socket, then pulse Relay A.',
  },
  {
    name: 'Crystal Reservoir',
    from: 63,
    depth: 312,
    short: 'Reservoir',
    task: 'Power the reservoir crossing',
    description:
      'Climb between the shaft walls. Engage the bridge switch, cross the water, then pulse Relay B.',
  },
  {
    name: 'Silent Foundry',
    from: 124,
    depth: 164,
    short: 'Foundry',
    task: 'Reconnect the counterweight',
    description:
      'Power the counterweight lift and latch the upper switch. Move its cell to the eastern socket, then pulse Relay C.',
  },
  {
    name: 'Ascent Shaft',
    from: 182,
    depth: 64,
    short: 'Ascent',
    task: 'Reach the ascent lift',
    description: 'Climb the shaft, cross the service platform, and board the ascent lift.',
  },
];
export const regionAt = (x) => x >= 182 ? 3 : x >= 124 ? 2 : x >= 63 ? 1 : 0;
export const archives = [
  {
    id: 'a',
    name: 'The last shift',
    text:
      'We left a lamp burning above the workbench. When the little maintenance unit wakes, it will know where to begin.',
  },
  {
    id: 'b',
    name: 'A quieter frequency',
    text: 'Below the waterline the crystals still sing. We tuned the second relay to answer them.',
  },
  {
    id: 'c',
    name: 'Surface protocol',
    text: 'The final lift has room for one. We cut a smaller handrail into its gate and marked it ILO.',
  },
];
const rock = (id, x, y, w, h, material = 'rock') => ({ id, x, y, w, h, material });
export const terrain = [
  rock('west', -6, -8, 2, 18),
  rock('work-1', -4, -7, 20, 7),
  rock('work-2', 18.65, -7, 43.85, 7),
  rock('step1', 9, 0, 3.6, .7, 'metal'),
  rock('step2', 12.6, 0, 3.4, 1.4, 'metal'),
  rock('alcove', 23, 1.55, 6.6, .5, 'metal'),
  rock('reservoir-1', 62.5, -7, 21.4, 7),
  rock('shaft-a', 71, 2.1, 2, 6.4),
  rock('shaft-b', 76.25, 0, 7.65, 6.15),
  rock('boarding', 83.9, 5.55, 3.1, .6, 'metal'),
  rock('reservoir-2', 104, -5, 7.5, 11.15),
  rock('reservoir-3', 111.5, -5, 3.2, 8.6),
  rock('east-bank', 114.7, -6, 9.3, 6),
  rock('foundry', 124, -7, 58, 7, 'metal'),
  rock('cover', 126.4, 0, 2.7, 1.75, 'metal'),
  rock('balcony', 154.4, 4.4, 8.4, .65, 'metal'),
  rock('archive-deck', 162.8, 5.95, 4.2, .55, 'metal'),
  rock('ascent-base', 182, -7, 14.2, 7, 'metal'),
  rock('service-west', 184.5, 2.1, 2, 5.8, 'metal'),
  rock('service-east', 189.8, 0, 6.4, 5.6, 'metal'),
  rock('terrace', 202.8, -4, 10, 12.25, 'metal'),
  rock('end', 212.8, -4, 1, 19, 'metal'),
];
export const barriers = [
  { id: 'training', type: 'seam', x: 31.2, y: 0, w: .7, h: 4.4 },
  { id: 'archive-seam', type: 'seam', x: 25, y: 2.05, w: .55, h: 2.55 },
  { id: 'work-shutter', type: 'shutter', x: 54, y: 0, w: .8, h: 7, requires: 'work' },
  { id: 'gate-a', type: 'shutter', x: 62, y: 0, w: .5, h: 10, requires: 'A' },
  { id: 'gate-b', type: 'shutter', x: 123.2, y: 0, w: .8, h: 10, requires: 'B' },
  { id: 'latch-gate', type: 'shutter', x: 159.6, y: 0, w: .7, h: 4.4, requires: 'latch' },
  { id: 'archive-door', type: 'shutter', x: 163.2, y: 6.5, w: .45, h: 2.6, requires: 'latch' },
  { id: 'relay-gate', type: 'shutter', x: 170, y: 0, w: .7, h: 9, requires: 'east' },
  { id: 'gate-c', type: 'shutter', x: 181.5, y: 0, w: .5, h: 10, requires: 'C' },
];
export const objects = [
  { id: 'start', kind: 'station', x: 2.1, y: 0 },
  { id: 'a', kind: 'archive', x: 27.4, y: 2.05 },
  { id: 'w-cache', kind: 'cache', x: 29.1, y: 2.05 },
  { id: 'work', kind: 'socket', cell: 'amber', x: 51.8, y: 0 },
  { id: 'A', kind: 'relay', x: 57.7, y: 0 },
  { id: 'saveA', kind: 'station', x: 60.1, y: 0 },
  { id: 'b', kind: 'archive', x: 72.1, y: 8.5 },
  { id: 'bridge', kind: 'switch', x: 80, y: 6.15 },
  { id: 'r-cache', kind: 'cache', x: 109.5, y: 6.15 },
  { id: 'B', kind: 'relay', x: 117.8, y: 0 },
  { id: 'saveB', kind: 'station', x: 120.1, y: 0 },
  { id: 'lower', kind: 'socket', cell: 'iron', x: 149.3, y: 0 },
  { id: 'latch', kind: 'switch', x: 156.6, y: 5.05 },
  { id: 'c', kind: 'archive', x: 165, y: 6.5 },
  { id: 'east', kind: 'socket', cell: 'iron', x: 167.8, y: 0 },
  { id: 'C', kind: 'relay', x: 174.1, y: 0 },
  { id: 'saveC', kind: 'station', x: 178.6, y: 0 },
  { id: 'ascent', kind: 'station', x: 183.2, y: 0 },
  { id: 'f-cache', kind: 'cache', x: 185.5, y: 7.9 },
  { id: 'exit', kind: 'liftConsole', x: 208, y: 8.25 },
];
export const cells = [{ id: 'amber', x: 45.7, y: 0, socket: null }, {
  id: 'iron',
  x: 144.5,
  y: 0,
  socket: null,
}];
export const platforms = [
  { id: 'ferry', x: 87, y: 5.7, w: 4.1, h: .45, dx: 13.1, dy: 0, period: 12, requires: 'bridge' },
  { id: 'counterweight', x: 150.8, y: -.45, w: 3.6, h: .45, dx: 0, dy: 5.05, period: 8, requires: 'lower' },
  { id: 'service', x: 196.65, y: 5.13, w: 3.4, h: .47, dx: 3.2, dy: 2.65, period: 6.5, requires: 'C' },
];
export const machines = [
  { id: 's1', type: 'skitter', x: 38.3, y: 0, min: 34.7, max: 42 },
  { id: 'd1', type: 'drone', x: 107.2, y: 7.2, min: 105, max: 110.7 },
  { id: 't1', type: 'sentinel', x: 136.5, y: .6, min: 130, max: 136.5 },
  { id: 'd2', type: 'drone', x: 193.5, y: 6.7, min: 191, max: 195.5 },
];
export const vents = [{ x: 140.2, y: 0, w: 1.1, h: 2.2, offset: .3 }, {
  x: 173,
  y: 0,
  w: 1.05,
  h: 2.1,
  offset: 2,
}, { x: 193.4, y: 5.6, w: 1, h: 2.1, offset: 1.2 }];
export const signs = [
  { x: 8, y: 0, key: 'SPACE', text: 'Hold to jump higher' },
  { x: 30, y: 0, key: 'SHIFT', text: 'Dash through amber seams' },
  { x: 36, y: 0, key: 'Q', text: 'Pulse to stun · dash to disable' },
  { x: 44, y: 0, key: 'E', text: 'Carry the power cell' },
  { x: 69.8, y: 0, key: 'JUMP', text: 'Hold toward a wall, then jump away' },
  { x: 131, y: 0, key: 'Q', text: 'Pulse the sentry when its core opens' },
  { x: 148, y: 0, key: 'E', text: 'Power the lift · engage the upper latch' },
];
export const objectBy = (id) => objects.find((o) => o.id === id);
